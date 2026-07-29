"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { 
  Label 
} from "@/components/ui/label";
import {
  Plus,
  Trash2,
  Shield,
  Eye,
  EyeOff,
  RefreshCw,
  Copy,
  Briefcase,
  Loader2,
} from "lucide-react";
import { adminApi } from '@/lib/api/admin.api';
import { useSmartRefresh } from '@/hooks/useSmartRefresh';
import { useAutoSaveForm } from '@/hooks/useAutoSaveForm';
import { loadFormData } from '@/lib/form-persistence';
import { useAdminSchools } from '@/hooks/useAdminSchools';
import { toast } from "@/components/ui/toast";
import { validatePasswordClient } from "@/lib/password-validation";
import {
  SchoolAdminManagementTable,
  type SchoolAdminManagementRow,
} from "@/components/ui/school-admin-management-table";

interface SchoolAdmin {
  id: string;
  profile_id: string | null;
  school_id: string;
  full_name: string;
  email: string;
  phone: string;
  temp_password: string;
  is_active: boolean;
   
  permissions?: Record<string, unknown>;
  last_login: string | null;
  created_at: string;
  updated_at: string;
  schools?: {
    id: string;
    name: string;
    city: string;
    state: string;
  };
}

const DEFAULT_FORM_DATA = {
  full_name: "",
  email: "",
  phone: "",
  school_id: "",
  temp_password: "",
  permissions: {} as Record<string, unknown>,
};

type SchoolAdminTableRow = SchoolAdmin &
  Pick<SchoolAdminManagementRow, "schoolDisplay" | "createdDisplay" | "statusLabel">;

function mapSchoolAdminToRow(admin: SchoolAdmin): SchoolAdminTableRow {
  return {
    ...admin,
    schoolDisplay: admin.schools?.name ?? "N/A",
    createdDisplay: admin.created_at
      ? new Date(admin.created_at).toLocaleDateString()
      : "—",
    statusLabel: admin.is_active ? "Active" : "Inactive",
  };
}

export default function SchoolAdminManagement() {
  const [schoolAdmins, setSchoolAdmins] = useState<SchoolAdmin[]>([]);
  const { schools } = useAdminSchools();
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<SchoolAdminTableRow[] | null>(null);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkSelectionResetKey, setBulkSelectionResetKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<SchoolAdmin | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SchoolAdmin | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<SchoolAdmin | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [formDataLoaded, setFormDataLoaded] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showTempPassword, setShowTempPassword] = useState(false);

  // Load saved form data in useEffect to avoid setState during render (which would update AdminLayout)
  useEffect(() => {
    if (formDataLoaded) return;
    try {
      const saved = loadFormData<typeof DEFAULT_FORM_DATA>('admin-school-admins-form');
      if (saved && Object.keys(saved).length > 0) {
        setFormData(_prev => ({
          ...DEFAULT_FORM_DATA,
          ...saved,
          temp_password: "",
        }));
      }
      setFormDataLoaded(true);
    } catch {
      setFormDataLoaded(true);
    }
  }, [formDataLoaded]);

  // Auto-save form
  const safeFormDataForAutosave = {
    ...formData,
    temp_password: "",
  };
  const { isDirty: isFormDirty, clearSavedData: _clearSavedData } = useAutoSaveForm({
    formId: 'admin-school-admins-form',
    formData: safeFormDataForAutosave,
    autoSave: true,
    autoSaveInterval: 2000,
    debounceDelay: 500,
    useSession: false,
    onLoad: (data) => {
      if (data && Object.keys(data).length > 0 && !formDataLoaded) {
        setFormData(prev => ({ ...prev, ...data, temp_password: "" }));
      }
    },
    markDirty: true,
  });

  // Fetch school admins (full list; table handles search/filters client-side)
  const fetchSchoolAdmins = useCallback(async () => {
    try {
      setIsLoading(true);
      setConnectionError(false);

      const { data } = await adminApi.schoolAdmins.list({});
      const body = data as { data?: { items?: unknown[] }; items?: unknown[]; schoolAdmins?: unknown[] };
      const raw = body.data?.items ?? body.items ?? body.schoolAdmins ?? body;
      const list = Array.isArray(raw) ? raw : [];
      const admins = list.filter(
        (admin): admin is SchoolAdmin =>
          typeof admin === "object" &&
          admin !== null &&
          "id" in admin &&
          "email" in admin &&
          Boolean((admin as SchoolAdmin).id) &&
          Boolean((admin as SchoolAdmin).email),
      );

      setSchoolAdmins(admins);
    } catch (error) {
      console.error('❌ Error fetching school admins:', error);
      setConnectionError(true);
      setSchoolAdmins([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load school admins on mount (schools list comes from useAdminSchools cache)
  useEffect(() => {
    setSchoolAdmins([]);
    setConnectionError(false);
    fetchSchoolAdmins();
  }, [fetchSchoolAdmins]);
  
  // Use smart refresh hook for tab switching
  useSmartRefresh({
    customRefresh: async () => {
      await fetchSchoolAdmins();
    },
    minRefreshInterval: 60000, // 1 minute minimum between refreshes
    hasUnsavedData: () => {
      // Check if any dialog is open (indicating unsaved changes)
      // Also check if form has unsaved data via Zustand store
      return isAddDialogOpen || isEditDialogOpen || isFormDirty;
    },
  });

  const adminTableRows = useMemo(
    () => schoolAdmins.map(mapSchoolAdminToRow),
    [schoolAdmins],
  );

  // Handle add admin
  const validateAdminForm = (isEdit: boolean): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.full_name.trim()) errors.full_name = "Full name is required";
    if (!formData.email.trim()) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = "Enter a valid email";
    }
    if (!formData.phone.trim()) errors.phone = "Phone is required";
    if (!formData.school_id.trim()) errors.school_id = "School is required";
    if (!isEdit) {
      if (!formData.temp_password.trim()) {
        errors.temp_password = "Temporary password is required";
      } else {
        const passwordError = validatePasswordClient(formData.temp_password);
        if (passwordError) errors.temp_password = passwordError;
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddAdmin = async () => {
    if (!validateAdminForm(false)) return;
    try {
      setActionLoading('add');
      await adminApi.schoolAdmins.create(formData);
      toast.success('School admin added successfully');
      setIsAddDialogOpen(false);
      setFormErrors({});
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        school_id: "",
        temp_password: "",
        permissions: {}
      });
      fetchSchoolAdmins();
    } catch (error) {
      console.error('Error adding school admin:', error);
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error ?? 'Error adding school admin');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle edit admin
  const handleEditAdmin = (admin: SchoolAdmin) => {
    setEditingAdmin(admin);
    setFormErrors({});
    setFormData({
      full_name: admin.full_name ?? "",
      email: admin.email ?? "",
      phone: admin.phone ?? "",
      school_id: admin.school_id ?? "",
      temp_password: (admin as { temp_password?: string }).temp_password ?? "",
      permissions: admin.permissions ?? {}
    });
    setNewPassword(""); // Reset new password
    setShowNewPassword(false); // Reset new password visibility
    setIsEditDialogOpen(true);
  };

  // Handle change password
  const handleChangePassword = async () => {
    if (!passwordTarget) return;

    if (!newPassword) {
      toast.error('Please enter a new password');
      return;
    }

    const passwordError = validatePasswordClient(newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    try {
      setActionLoading('change-password');
      await adminApi.schoolAdmins.update({
        id: passwordTarget.id,
        temp_password: newPassword,
        change_password: true
      });
      toast.success(`Password changed for "${passwordTarget.full_name}"`);
      setNewPassword("");
      setShowNewPassword(false);
      setPasswordTarget(null);
      fetchSchoolAdmins();
    } catch (error) {
      console.error('Error changing password:', error);
      const err = error as { response?: { data?: { error?: string; details?: string } } };
      const msg = err.response?.data?.details ? `${err.response.data.error ?? ''}: ${err.response.data.details}` : err.response?.data?.error ?? (error instanceof Error ? error.message : 'Unknown error');
      toast.error(`Error changing password: ${msg}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Generate new password
  const generateNewPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
  };

  // Copy new password to clipboard
  const copyNewPassword = async () => {
    try {
      await navigator.clipboard.writeText(newPassword);
      toast.success('Password copied');
    } catch (err) {
      console.error('Failed to copy password:', err);
      toast.error('Failed to copy password');
    }
  };

  // Handle update admin
  const handleUpdateAdmin = async () => {
    if (!editingAdmin) return;
    if (!validateAdminForm(true)) return;

    try {
      setActionLoading('edit');
      const { temp_password: _tempPassword, ...updateData } = formData;
      void _tempPassword;
      await adminApi.schoolAdmins.update({
        id: editingAdmin.id,
        ...updateData
      });
      toast.success('School admin updated successfully');
      setIsEditDialogOpen(false);
      setEditingAdmin(null);
      setFormErrors({});
      setNewPassword("");
      setShowNewPassword(false);
      fetchSchoolAdmins();
    } catch (error) {
      console.error('Error updating school admin:', error);
      const err = error as { response?: { data?: { error?: string; details?: string; message?: string } } };
      const msg = err.response?.data?.details
        ? `${err.response.data.error ?? 'Error'}: ${err.response.data.details}`
        : err.response?.data?.error ?? err.response?.data?.message ?? (error instanceof Error ? error.message : 'Unknown error occurred');
      toast.error(`Error updating school admin: ${msg}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle delete admin
  const handleDeleteAdmin = async (adminId: string) => {
    try {
      setActionLoading(adminId);
      await adminApi.schoolAdmins.delete(adminId);
      toast.success('School admin deleted successfully');
      setDeleteTarget(null);
      fetchSchoolAdmins();
    } catch (error) {
      console.error('Error deleting school admin:', error);
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error ?? 'Error deleting school admin');
    } finally {
      setActionLoading(null);
    }
  };

  const requestDeleteAdminRow = (row: SchoolAdminTableRow) => {
    setDeleteTarget(row);
  };

  const requestBulkDeleteAdmins = (rows: SchoolAdminTableRow[]) => {
    if (rows.length === 0) return;
    setBulkDeleteTargets(rows);
    setIsBulkDeleteDialogOpen(true);
  };

  const confirmBulkDeleteAdmins = async () => {
    if (!bulkDeleteTargets?.length || isBulkDeleting) return;
    setIsBulkDeleting(true);
    try {
      const targets = bulkDeleteTargets;
      const results = await Promise.allSettled(
        targets.map((t) => adminApi.schoolAdmins.delete(t.id)),
      );
      const succeededIds: string[] = [];
      const failedLabels: string[] = [];
      results.forEach((result, i) => {
        const row = targets[i];
        if (result.status === "fulfilled") {
          succeededIds.push(row.id);
        } else {
          failedLabels.push(row.full_name || row.email || row.id);
        }
      });
      if (succeededIds.length > 0) {
        setSchoolAdmins((prev) => prev.filter((a) => !succeededIds.includes(a.id)));
        toast.success(
          `Deleted ${succeededIds.length} administrator${succeededIds.length !== 1 ? "s" : ""}.`,
        );
        setBulkSelectionResetKey((k) => k + 1);
        await fetchSchoolAdmins();
      }
      if (failedLabels.length > 0) {
        toast.error(
          `Could not delete ${failedLabels.length} record(s): ${failedLabels.slice(0, 5).join(", ")}${failedLabels.length > 5 ? "…" : ""}`,
        );
      }
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error("Bulk delete failed unexpectedly.");
    } finally {
      setIsBulkDeleting(false);
      setIsBulkDeleteDialogOpen(false);
      setBulkDeleteTargets(null);
    }
  };

  // Handle toggle status
  const handleToggleStatus = async (admin: SchoolAdmin, newStatus?: boolean) => {
    // Use the provided newStatus or toggle from current status
    const statusToSet = newStatus !== undefined ? newStatus : !admin.is_active;
    
    // Optimistically update the UI
    setSchoolAdmins(prev => prev.map((a: SchoolAdmin) => 
      a.id === admin.id ? { ...a, is_active: statusToSet } : a
    ));
    
    try {
      setActionLoading(admin.id);
      const { data } = await adminApi.schoolAdmins.update({
        id: admin.id,
        is_active: statusToSet
      });

      const schoolAdmin = data?.schoolAdmin as { is_active?: boolean } | undefined;
      if (schoolAdmin) {
        setSchoolAdmins(prev =>
          prev.map((a: SchoolAdmin) =>
            a.id === admin.id ? { ...a, is_active: schoolAdmin.is_active ?? statusToSet } : a
          )
        );
      }
    } catch (error) {
      setSchoolAdmins(prev => prev.map((a: SchoolAdmin) =>
        a.id === admin.id ? { ...a, is_active: admin.is_active } : a
      ));
      console.error('❌ Error updating school admin status:', error);
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error ?? 'Error updating school admin status. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle input change
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="p-6 space-y-6 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">School Admin Management</h1>
          <p className="text-gray-600 mt-1">Manage school administrators and their access</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => fetchSchoolAdmins()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add School Admin
          </Button>
        </div>
      </div>

      {/* School Admins Table */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>School Administrators ({schoolAdmins.length})</CardTitle>
          <CardDescription>
            Manage school administrators and their permissions — use the table search and column filters to narrow the list.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
              <p className="text-gray-600 mt-2">Loading school admins...</p>
            </div>
          ) : connectionError ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold text-red-600 mb-2">Connection Error</h3>
              <p className="text-gray-600 mb-4">
                Failed to load school admins. Ensure the backend server is running and <code className="text-xs bg-gray-100 px-1 rounded">BACKEND_URL</code> is set in your env.
              </p>
              <Button onClick={() => void fetchSchoolAdmins()}>Retry</Button>
            </div>
          ) : schoolAdmins.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No School Admins Found</h3>
              <p className="text-gray-600 mb-4">Get started by adding a new school administrator.</p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add School Admin
              </Button>
            </div>
          ) : (
            <SchoolAdminManagementTable<SchoolAdminTableRow>
              rows={adminTableRows}
              loading={false}
              onEdit={handleEditAdmin}
              onDelete={requestDeleteAdminRow}
              onToggleActive={(row, checked) => void handleToggleStatus(row, checked)}
              actionLoadingId={actionLoading}
              onBulkDeleteSelected={requestBulkDeleteAdmins}
              resetSelectionKey={bulkSelectionResetKey}
              searchPlaceholder="Search by name, email, phone, school…"
              itemsPerPage={15}
              emptyMessage="No school administrators match your filters or search."
              className="shadow-sm"
            />
          )}
        </CardContent>
      </Card>

      {/* Add Admin Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Add School Admin</DialogTitle>
            <DialogDescription>
              Create a new school administrator account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name ?? ""}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                placeholder="Enter full name"
              />
              {formErrors.full_name && <p className="text-sm text-red-600 mt-1">{formErrors.full_name}</p>}
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email ?? ""}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Enter email address"
              />
              {formErrors.email && <p className="text-sm text-red-600 mt-1">{formErrors.email}</p>}
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone ?? ""}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="Enter phone number"
              />
              {formErrors.phone && <p className="text-sm text-red-600 mt-1">{formErrors.phone}</p>}
            </div>
            <div>
              <Label htmlFor="school_id">School</Label>
              <Select value={formData.school_id ?? ""} onValueChange={(value) => handleInputChange('school_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a school" />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.school_id && <p className="text-sm text-red-600 mt-1">{formErrors.school_id}</p>}
            </div>
            <div>
              <Label htmlFor="temp_password">Temporary Password</Label>
              <div className="relative">
                <Input
                  id="temp_password"
                  type={showTempPassword ? "text" : "password"}
                  value={formData.temp_password ?? ""}
                  onChange={(e) => handleInputChange('temp_password', e.target.value)}
                  placeholder="Enter temporary password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowTempPassword(!showTempPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showTempPassword ? "Hide password" : "Show password"}
                >
                  {showTempPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {formErrors.temp_password && <p className="text-sm text-red-600 mt-1">{formErrors.temp_password}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddAdmin}
              disabled={actionLoading === 'add'}
            >
              {actionLoading === 'add' ? 'Adding...' : 'Add Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Admin Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Edit School Admin</DialogTitle>
            <DialogDescription>
              Update school administrator information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_full_name">Full Name</Label>
              <Input
                id="edit_full_name"
                value={formData.full_name ?? ""}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                placeholder="Enter full name"
              />
              {formErrors.full_name && <p className="text-sm text-red-600 mt-1">{formErrors.full_name}</p>}
            </div>
            <div>
              <Label htmlFor="edit_email">Email</Label>
              <Input
                id="edit_email"
                type="email"
                value={formData.email ?? ""}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Enter email address"
              />
              {formErrors.email && <p className="text-sm text-red-600 mt-1">{formErrors.email}</p>}
            </div>
            <div>
              <Label htmlFor="edit_phone">Phone</Label>
              <Input
                id="edit_phone"
                value={formData.phone ?? ""}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="Enter phone number"
              />
              {formErrors.phone && <p className="text-sm text-red-600 mt-1">{formErrors.phone}</p>}
            </div>
            <div>
              <Label htmlFor="edit_school_id">School</Label>
              <Select value={formData.school_id ?? ""} onValueChange={(value) => handleInputChange('school_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a school" />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.school_id && <p className="text-sm text-red-600 mt-1">{formErrors.school_id}</p>}
            </div>
            <div>
              <Label>Change Current Password</Label>
              <div className="space-y-2">
                <p className="text-sm text-gray-500">
                  Use this to reset the password if the school admin has forgotten it. A new password will be generated and assigned.
                </p>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="new_password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword ?? ""}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 8: uppercase, lowercase, number)"
                    className="pl-10 pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generateNewPassword}
                    className="flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Generate
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyNewPassword}
                    disabled={!newPassword}
                    className="flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => setPasswordTarget(editingAdmin)}
                    disabled={!newPassword || newPassword.length < 8 || actionLoading === 'change-password'}
                    className="flex items-center gap-1"
                  >
                    {actionLoading === 'change-password' ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        Changing...
                      </>
                    ) : (
                      <>
                        <Shield className="h-3 w-3" />
                        Change Password
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateAdmin}
              disabled={actionLoading === 'edit'}
            >
              {actionLoading === 'edit' ? 'Updating...' : 'Update Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsBulkDeleteDialogOpen(open);
          if (!open) setBulkDeleteTargets(null);
        }}
      >
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Delete selected administrators</DialogTitle>
            <DialogDescription>
              This cannot be undone. Accounts and permissions for these school administrators will be removed according to server policy.
            </DialogDescription>
          </DialogHeader>
          {bulkDeleteTargets && bulkDeleteTargets.length > 0 && (
            <div className="space-y-2 py-2">
              <p className="text-sm text-gray-700">
                Delete{" "}
                <span className="font-semibold">{bulkDeleteTargets.length}</span>{" "}
                administrator{bulkDeleteTargets.length !== 1 ? "s" : ""}?
              </p>
              <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-sm text-muted-foreground">
                {bulkDeleteTargets.slice(0, 20).map((t) => (
                  <li key={t.id}>
                    {t.full_name} ({t.email})
                  </li>
                ))}
                {bulkDeleteTargets.length > 20 && (
                  <li className="list-none pl-0 text-muted-foreground/80">
                    …and {bulkDeleteTargets.length - 20} more
                  </li>
                )}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsBulkDeleteDialogOpen(false);
                setBulkDeleteTargets(null);
              }}
              disabled={isBulkDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isBulkDeleting || !bulkDeleteTargets?.length}
              onClick={() => void confirmBulkDeleteAdmins()}
            >
              {isBulkDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete {bulkDeleteTargets?.length ?? 0} administrator
                  {(bulkDeleteTargets?.length ?? 0) !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Delete School Admin</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Are you sure you want to delete "${deleteTarget.full_name}"? This action cannot be undone.`
                : "Are you sure you want to delete this school admin?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDeleteAdmin(deleteTarget.id)}
              disabled={!deleteTarget || actionLoading === deleteTarget.id}
            >
              {deleteTarget && actionLoading === deleteTarget.id ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordTarget !== null} onOpenChange={(open) => !open && setPasswordTarget(null)}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Confirm Password Change</DialogTitle>
            <DialogDescription>
              {passwordTarget
                ? `Change password for "${passwordTarget.full_name}"? They will need this new password for the next login.`
                : "Confirm password reset"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={actionLoading === 'change-password'}
            >
              {actionLoading === 'change-password' ? "Changing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
