"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Trash2,
  School,
  RefreshCw,
  AlertCircle,
  Loader2,
  Users,
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import AddSchoolDialog from "@/components/AddSchoolDialog";
import JoiningCodesDialog from "@/components/JoiningCodesDialog";
import { adminApi, setAuthToken } from "@/lib/api";
import { getSession } from "@/lib/session-utils";
import { useAdminSchools, useInvalidateAdminSchools } from "@/hooks/useAdminSchools";
import { toast } from "@/components/ui/toast";
import { validatePasswordClient } from "@/lib/password-validation";
import {
  SchoolManagementTable,
  type SchoolManagementRow,
} from "@/components/ui/school-management-table";

/** Join code from API (school.joinCodes) */
export interface JoinCodeItem {
  id?: string;
  schoolId?: string;
  grade?: string;
  code?: string;
  usageType?: string;
  maxUses?: number;
  usedCount?: number;
  isActive?: boolean;
  expiresAt?: string;
  createdAt?: string;
}

interface School {
  id: string;
  name: string;
  school_code?: string;
  join_code?: string;
  school_email?: string;
  school_admin_id?: string;
  school_admin_name?: string;
  school_admin_email?: string;
  address: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  contact_email: string;
  contact_phone: string;
  principal_name: string;
  affiliation_type?: string;
  school_type?: string;
  established_year?: number;
  logo_url?: string;
  grades_offered?: string[];
  total_students_estimate?: number;
  total_teachers_estimate?: number;
  status?: string;
  /** Join codes from backend school.joinCodes; preserved for UI */
  joining_codes?: JoinCodeItem[] | null;
  /** Rolled-up count when flat joinCodes not mapped */
  join_code_count?: number;
  teacher_count?: number;
  student_count?: number;
  is_active: boolean;
  created_at: string;
  created_by?: string;
}

function countJoinCodesInGrades(item: Record<string, unknown>): number {
  const grades = item.grades;
  if (!Array.isArray(grades)) return 0;
  let n = 0;
  for (const g of grades as { sections?: { joinCodes?: unknown[] }[] }[]) {
    for (const sec of g.sections ?? []) {
      n += (sec.joinCodes ?? []).length;
    }
  }
  return n;
}

/** Map API school (EdTech flat shape or legacy tenant+school) to UI School type */
function mapApiSchoolToSchool(item: Record<string, unknown>): School {
  const legacy = (item.school ?? {}) as Record<string, unknown>;
  const flat = item.grades != null || item.gradesOffered != null ? item : legacy;
  const v = (key: string) => (flat as Record<string, unknown>)[key] ?? (legacy as Record<string, unknown>)[key] ?? item[key];
  const emailOnly = v("email") ?? v("contact_email");
  const flatJoin = (v("joinCodes") ?? v("joining_codes")) as JoinCodeItem[] | null | undefined;
  const joinList = Array.isArray(flatJoin) ? flatJoin : null;
  const join_code_count =
    joinList != null
      ? joinList.length
      : typeof v("join_code_count") === "number"
        ? (v("join_code_count") as number)
        : countJoinCodesInGrades(item as Record<string, unknown>);
  return {
    id: String(v("id") ?? ""),
    name: String(v("name") ?? ""),
    school_code: (v("schoolCode") ?? v("school_code")) as string | undefined,
    join_code: (v("joinCode") ?? v("join_code")) as string | undefined,
    school_email: (v("email") ?? v("school_email")) as string | undefined,
    school_admin_id:
      (v("school_admin_user_id") as string | number | undefined) != null
        ? String(v("school_admin_user_id"))
        : (item.school_admin_id as string | undefined),
    school_admin_name: (v("school_admin_name") as string | undefined) ?? undefined,
    school_admin_email: (v("school_admin_email") as string | undefined) ?? undefined,
    address: String(v("address") ?? ""),
    city: v("city") as string | undefined,
    state: v("state") as string | undefined,
    country: v("country") as string | undefined,
    pincode: v("pincode") as string | undefined,
    contact_email:
      emailOnly != null && String(emailOnly).trim() !== ""
        ? String(emailOnly)
        : "",
    contact_phone: String(v("phone") ?? v("contact_phone") ?? ""),
    principal_name: String(v("principalName") ?? v("principal_name") ?? ""),
    affiliation_type: (v("affiliationType") ?? v("affiliation_type")) as string | undefined,
    school_type: (v("schoolType") ?? v("school_type")) as string | undefined,
    established_year: (v("establishedYear") ?? v("established_year")) as number | undefined,
    logo_url: (v("logoUrl") ?? v("logo_url")) as string | undefined,
    grades_offered: (v("gradesOffered") ?? v("grades_offered")) as string[] | undefined,
    total_students_estimate: (v("totalStudentsEstimate") ?? v("total_students_estimate")) as number | undefined,
    total_teachers_estimate: (v("totalTeachersEstimate") ?? v("total_teachers_estimate")) as number | undefined,
    status: v("status") as string | undefined,
    joining_codes: joinList,
    join_code_count,
    teacher_count:
      typeof v("teacherCount") === "number"
        ? (v("teacherCount") as number)
        : typeof v("teacher_count") === "number"
          ? (v("teacher_count") as number)
          : undefined,
    student_count:
      typeof v("studentCount") === "number"
        ? (v("studentCount") as number)
        : typeof v("student_count") === "number"
          ? (v("student_count") as number)
          : undefined,
    is_active: typeof v("isActive") === "boolean" ? (v("isActive") as boolean) : typeof v("is_active") === "boolean" ? (v("is_active") as boolean) : false,
    created_at: String(v("createdAt") ?? v("created_at") ?? new Date().toISOString()),
    created_by: item.created_by as string | undefined,
  };
}

type SchoolTableRow = School &
  Pick<
    SchoolManagementRow,
    | "searchBlob"
    | "adminBlob"
    | "addressLine"
    | "teachersCount"
    | "studentsCount"
    | "statusLabel"
    | "peopleLine"
    | "statusCodesBlob"
    | "joinCodeCount"
  >;

function mapSchoolToRow(school: School): SchoolTableRow {
  const teachersCount = school.teacher_count ?? 0;
  const studentsCount = school.student_count ?? 0;
  const joinCodeCount = school.join_code_count ?? 0;
  const searchBlob = [
    school.name,
    school.contact_email,
    school.contact_phone,
    school.school_admin_name,
    school.school_admin_email,
    school.city,
    school.state,
    school.address,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const adminBlob = [school.school_admin_name, school.school_admin_email]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const addressLine = [school.address, school.city, school.state].filter(Boolean).join(", ");
  const peopleLine = `Teachers: ${teachersCount} Students: ${studentsCount}`;
  const statusLabel = school.is_active ? "Active" : "Inactive";
  const statusCodesBlob = `${statusLabel} ${joinCodeCount}`;
  return {
    ...school,
    searchBlob,
    adminBlob,
    addressLine,
    teachersCount,
    studentsCount,
    joinCodeCount,
    statusLabel,
    peopleLine,
    statusCodesBlob,
  };
}

export default function SchoolsManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [joiningCodesDialog, setJoiningCodesDialog] = useState<{isOpen: boolean, schoolId: string, schoolName: string}>({
    isOpen: false,
    schoolId: '',
    schoolName: ''
  });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<
    Partial<School> & { school_admin_new_password?: string }
  >({});
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<SchoolTableRow[] | null>(null);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkSelectionResetKey, setBulkSelectionResetKey] = useState(0);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Auto-open Add School dialog when navigated with ?action=add
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setIsDialogOpen(true);
      router.replace('/lms/admin/schools');
    }
  }, [searchParams, router]);

  const { schools: rawSchools, isLoading, error, refetch } = useAdminSchools();
  const invalidateSchools = useInvalidateAdminSchools();

  const schools = useMemo(
    () => (rawSchools ?? []).map((item) => mapApiSchoolToSchool(item as Record<string, unknown>)),
    [rawSchools],
  );
  const schoolTableRows = useMemo(() => schools.map(mapSchoolToRow), [schools]);
  const connectionError = !!error;

  // Sync session to token storage on mount so mutations (toggle, delete, update) have the token
  // even when useAdminSchools() serves cached data and its queryFn doesn't run
  useEffect(() => {
    let mounted = true;
    getSession().then(({ data }) => {
      if (mounted && data?.session?.access_token) {
        setAuthToken(data.session.access_token);
      }
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (error && typeof (error as Error)?.message === "string" && (error as Error).message.includes("Not authenticated")) {
      router.push("/lms/login");
    }
  }, [error, router]);

  const confirmDeleteSchool = async () => {
    if (!deleteTargetId) return;
    const schoolId = deleteTargetId;
    try {
      setActionLoading(schoolId);
      await adminApi.schools.delete(schoolId);
      await invalidateSchools();
      toast.success("School deleted successfully.");
      setDeleteTargetId(null);
    } catch (error) {
      console.error("Error deleting school:", error);
      toast.error("Failed to delete school. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleSchoolStatus = async (schoolId: string, currentStatus: boolean) => {
    try {
      setActionLoading(schoolId);
      await adminApi.schools.update(schoolId, { is_active: !currentStatus });
      await invalidateSchools();
      toast.success("School status updated.");
    } catch (error) {
      console.error("Error updating school status:", error);
      toast.error("Failed to update school status.");
    } finally {
      setActionLoading(null);
    }
  };

  const validateEditSchool = (): boolean => {
    const err: Record<string, string> = {};
    if (!editFormData.name?.trim()) err.name = "School name is required";
    if (!editFormData.contact_email?.trim()) err.contact_email = "School email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editFormData.contact_email.trim())) {
      err.contact_email = "Enter a valid email";
    }
    if (!editFormData.contact_phone?.trim()) err.contact_phone = "Phone is required";
    if (!editFormData.address?.trim()) err.address = "Address is required";

    const hadAdmin = !!(editingSchool?.school_admin_email?.trim());
    const adminEmail = editFormData.school_admin_email?.trim() ?? "";
    const adminName = editFormData.school_admin_name?.trim() ?? "";
    const newPw = editFormData.school_admin_new_password?.trim() ?? "";
    const touchingAdmin =
      adminEmail !== "" || adminName !== "" || newPw !== "";
    const adminIntent = hadAdmin || touchingAdmin;

    if (adminIntent) {
      if (!adminName) err.school_admin_name = "School admin name is required";
      if (!adminEmail) err.school_admin_email = "School admin email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
        err.school_admin_email = "Enter a valid admin email";
      }
      if (!hadAdmin && touchingAdmin && !newPw) {
        err.school_admin_new_password = "Temporary password is required to create the first school admin";
      }
      if (newPw) {
        const pe = validatePasswordClient(newPw);
        if (pe) err.school_admin_new_password = pe;
      }
    }
    setEditFieldErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleEditSchool = (school: School) => {
    setEditingSchool(school);
    setEditFieldErrors({});
    setEditFormData({
      name: school.name,
      contact_email: school.contact_email,
      contact_phone: school.contact_phone,
      address: school.address,
      city: school.city || "",
      state: school.state || "",
      pincode: school.pincode || "",
      affiliation_type: school.affiliation_type || "",
      school_type: school.school_type || "",
      established_year: school.established_year || new Date().getFullYear(),
      total_students_estimate: school.total_students_estimate || 0,
      total_teachers_estimate: school.total_teachers_estimate || 0,
      grades_offered: school.grades_offered || [],
      school_admin_name: school.school_admin_name || "",
      school_admin_email: school.school_admin_email || "",
      school_admin_new_password: "",
    });
    setEditDialogOpen(true);
  };

  const handleUpdateSchool = async () => {
    if (!editingSchool) return;
    if (!validateEditSchool()) return;

    try {
      setActionLoading(editingSchool.id);
      const payload: Record<string, unknown> = {
        name: editFormData.name,
        contact_email: editFormData.contact_email,
        contact_phone: editFormData.contact_phone,
        address: editFormData.address,
        city: editFormData.city,
        state: editFormData.state,
        pincode: editFormData.pincode,
        affiliation_type: editFormData.affiliation_type,
        school_type: editFormData.school_type,
        established_year: editFormData.established_year,
        total_students_estimate: editFormData.total_students_estimate,
        total_teachers_estimate: editFormData.total_teachers_estimate,
        grades_offered: editFormData.grades_offered,
      };
      const adminEmail = editFormData.school_admin_email?.trim();
      const adminName = editFormData.school_admin_name?.trim();
      const newPw = editFormData.school_admin_new_password?.trim();
      if (adminEmail || adminName || newPw) {
        payload.school_admin_email = adminEmail;
        payload.school_admin_name = adminName;
        if (newPw) payload.school_admin_new_password = newPw;
      }

      await adminApi.schools.update(editingSchool.id, payload);
      await invalidateSchools();
      setEditDialogOpen(false);
      setEditingSchool(null);
      setEditFormData({});
      setEditFieldErrors({});
      toast.success("School updated successfully.");
    } catch (error) {
      console.error("Error updating school:", error);
      toast.error("Failed to update school. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const requestDeleteSchoolRow = (row: SchoolTableRow) => {
    setDeleteTargetId(row.id);
  };

  const requestBulkDeleteSchools = (rows: SchoolTableRow[]) => {
    if (rows.length === 0) return;
    setBulkDeleteTargets(rows);
    setIsBulkDeleteDialogOpen(true);
  };

  const confirmBulkDeleteSchools = async () => {
    if (!bulkDeleteTargets?.length || isBulkDeleting) return;
    setIsBulkDeleting(true);
    try {
      const targets = bulkDeleteTargets;
      const results = await Promise.allSettled(
        targets.map((t) => adminApi.schools.delete(t.id)),
      );
      const succeededIds: string[] = [];
      const failedLabels: string[] = [];
      results.forEach((result, i) => {
        const row = targets[i];
        if (result.status === "fulfilled") {
          succeededIds.push(row.id);
        } else {
          failedLabels.push(row.name || row.id);
        }
      });
      if (succeededIds.length > 0) {
        toast.success(
          `Deleted ${succeededIds.length} school${succeededIds.length !== 1 ? "s" : ""}.`,
        );
        setBulkSelectionResetKey((k) => k + 1);
        await invalidateSchools();
      }
      if (failedLabels.length > 0) {
        toast.error(
          `Could not delete ${failedLabels.length} school(s): ${failedLabels.slice(0, 5).join(", ")}${failedLabels.length > 5 ? "…" : ""}`,
        );
      }
    } catch (e) {
      console.error(e);
      toast.error("Bulk delete failed unexpectedly.");
    } finally {
      setIsBulkDeleting(false);
      setIsBulkDeleteDialogOpen(false);
      setBulkDeleteTargets(null);
    }
  };

  if (connectionError) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Connection Error</h3>
            <p className="text-gray-600 mb-4">Unable to connect to the database. Please check your connection and try again.</p>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Schools Management</h1>
          <p className="text-gray-600 mt-1">Manage schools, school admins, and joining codes</p>
        </div>
        <Button className="shrink-0" onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add School
        </Button>
      </div>

      {/* Schools Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <School className="h-5 w-5" />
            Schools ({schools.length})
          </CardTitle>
          <CardDescription>
            Manage all registered schools and their joining codes — use the table search and column filters to narrow the list.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isLoading && schools.length === 0 ? (
            <div className="text-center py-12">
              <School className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No schools registered</h3>
              <p className="text-gray-600 mb-4">Get started by adding your first school.</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add School
              </Button>
            </div>
          ) : (
            <SchoolManagementTable<SchoolTableRow>
              rows={schoolTableRows}
              loading={isLoading}
              onView={(row) => router.push(`/lms/admin/schools/${row.id}`)}
              onManageJoinCodes={(row) =>
                setJoiningCodesDialog({
                  isOpen: true,
                  schoolId: row.id,
                  schoolName: row.name,
                })
              }
              onEdit={handleEditSchool}
              onToggleActive={(row) => void handleToggleSchoolStatus(row.id, row.is_active)}
              onDelete={requestDeleteSchoolRow}
              onBulkDeleteSelected={requestBulkDeleteSchools}
              resetSelectionKey={bulkSelectionResetKey}
              actionLoadingId={actionLoading}
              searchPlaceholder="Search schools by name, email, admin, city, or state…"
              itemsPerPage={15}
              emptyMessage="No schools match your filters or search."
              className="shadow-sm"
            />
          )}
        </CardContent>
      </Card>

      {/* Add School Dialog */}
      <AddSchoolDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={() => {
          void invalidateSchools();
        }}
      />

      {/* Joining Codes Dialog */}
      <JoiningCodesDialog
        isOpen={joiningCodesDialog.isOpen}
        onClose={() => setJoiningCodesDialog({isOpen: false, schoolId: '', schoolName: ''})}
        schoolId={joiningCodesDialog.schoolId || ''}
        schoolName={joiningCodesDialog.schoolName}
      />

      {/* Edit School Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
                <DialogHeader>
            <DialogTitle>Edit School Details</DialogTitle>
                  <DialogDescription>
              Update the school information and settings
                  </DialogDescription>
                </DialogHeader>
            
          <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                <Label htmlFor="edit-name">School Name *</Label>
                    <Input
                  id="edit-name"
                  value={editFormData.name || ''}
                  onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                      placeholder="Enter school name"
                    />
                  {editFieldErrors.name && <p className="text-sm text-red-500">{editFieldErrors.name}</p>}
                  </div>
                  <div className="space-y-2">
                <Label htmlFor="edit-email">School Email *</Label>
                    <Input
                  id="edit-email"
                      type="email"
                  value={editFormData.contact_email || ''}
                  onChange={(e) => setEditFormData({...editFormData, contact_email: e.target.value})}
                      placeholder="info@school.edu"
                    />
                  {editFieldErrors.contact_email && <p className="text-sm text-red-500">{editFieldErrors.contact_email}</p>}
                  </div>
                  <div className="space-y-2">
                <Label htmlFor="edit-phone">Contact Phone *</Label>
                    <Input
                  id="edit-phone"
                  value={editFormData.contact_phone || ''}
                  onChange={(e) => setEditFormData({...editFormData, contact_phone: e.target.value})}
                      placeholder="+91 9876543210"
                    />
                  {editFieldErrors.contact_phone && <p className="text-sm text-red-500">{editFieldErrors.contact_phone}</p>}
                  </div>
                  <div className="space-y-2">
                <Label htmlFor="edit-year">Established Year</Label>
                    <Input
                  id="edit-year"
                      type="number"
                  value={editFormData.established_year || ''}
                  onChange={(e) => setEditFormData({...editFormData, established_year: parseInt(e.target.value) || new Date().getFullYear()})}
                  placeholder="2024"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
              <Label htmlFor="edit-address">Address *</Label>
                  <Textarea
                id="edit-address"
                value={editFormData.address || ''}
                onChange={(e) => setEditFormData({...editFormData, address: e.target.value})}
                placeholder="Enter complete address"
                    rows={3}
                  />
                {editFieldErrors.address && <p className="text-sm text-red-500">{editFieldErrors.address}</p>}
                </div>

                <div className="border-t pt-6 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    School administrator
                  </h3>
                  <p className="text-xs text-gray-500">
                    Leave the new password blank to keep the current password. To add the first admin, fill name, email, and a temporary password.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-admin-name">Admin name</Label>
                      <Input
                        id="edit-admin-name"
                        value={editFormData.school_admin_name || ""}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, school_admin_name: e.target.value })
                        }
                        placeholder="Administrator name"
                      />
                      {editFieldErrors.school_admin_name && (
                        <p className="text-sm text-red-500">{editFieldErrors.school_admin_name}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-admin-email">Admin email</Label>
                      <Input
                        id="edit-admin-email"
                        type="email"
                        value={editFormData.school_admin_email || ""}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, school_admin_email: e.target.value })
                        }
                        placeholder="admin@school.edu"
                      />
                      {editFieldErrors.school_admin_email && (
                        <p className="text-sm text-red-500">{editFieldErrors.school_admin_email}</p>
                      )}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="edit-admin-password">New password (optional)</Label>
                      <Input
                        id="edit-admin-password"
                        type="password"
                        value={editFormData.school_admin_new_password || ""}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            school_admin_new_password: e.target.value,
                          })
                        }
                        placeholder="Only if resetting admin password"
                        autoComplete="new-password"
                      />
                      {editFieldErrors.school_admin_new_password && (
                        <p className="text-sm text-red-500">{editFieldErrors.school_admin_new_password}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                <Label htmlFor="edit-city">City</Label>
                    <Input
                  id="edit-city"
                  value={editFormData.city || ''}
                  onChange={(e) => setEditFormData({...editFormData, city: e.target.value})}
                  placeholder="Enter city"
                    />
                  </div>
                  <div className="space-y-2">
                <Label htmlFor="edit-state">State</Label>
                    <Input
                  id="edit-state"
                  value={editFormData.state || ''}
                  onChange={(e) => setEditFormData({...editFormData, state: e.target.value})}
                  placeholder="Enter state"
                    />
                  </div>
                  <div className="space-y-2">
                <Label htmlFor="edit-pincode">Pincode</Label>
                  <Input
                  id="edit-pincode"
                  value={editFormData.pincode || ''}
                  onChange={(e) => setEditFormData({...editFormData, pincode: e.target.value})}
                  placeholder="123456"
                  />
                </div>
            </div>
              
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                <Label htmlFor="edit-affiliation">Affiliation Type</Label>
                    <Input
                  id="edit-affiliation"
                  value={editFormData.affiliation_type || ''}
                  onChange={(e) => setEditFormData({...editFormData, affiliation_type: e.target.value})}
                  placeholder="CBSE, ICSE, etc."
                    />
                  </div>
                  <div className="space-y-2">
                <Label htmlFor="edit-type">School Type</Label>
                    <Input
                  id="edit-type"
                  value={editFormData.school_type || ''}
                  onChange={(e) => setEditFormData({...editFormData, school_type: e.target.value})}
                  placeholder="Private, Public, etc."
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                <Label htmlFor="edit-students">Total Students (Estimate)</Label>
                    <Input
                  id="edit-students"
                      type="number"
                  value={editFormData.total_students_estimate || ''}
                  onChange={(e) => setEditFormData({...editFormData, total_students_estimate: parseInt(e.target.value) || 0})}
                  placeholder="100"
                    />
                  </div>
                  <div className="space-y-2">
                <Label htmlFor="edit-teachers">Total Teachers (Estimate)</Label>
                    <Input
                  id="edit-teachers"
                      type="number"
                  value={editFormData.total_teachers_estimate || ''}
                  onChange={(e) => setEditFormData({...editFormData, total_teachers_estimate: parseInt(e.target.value) || 0})}
                  placeholder="10"
                    />
                  </div>
                </div>
          </div>
            
                <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                    Cancel
                  </Button>
              <Button 
              onClick={handleUpdateSchool}
              disabled={actionLoading === editingSchool?.id}
              >
              {actionLoading === editingSchool?.id ? 'Updating...' : 'Update School'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

      <Dialog open={deleteTargetId !== null} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <DialogContent className="bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete school</DialogTitle>
            <DialogDescription>
              This cannot be undone. All associated school admins, teachers, and students for this tenant will be removed. Course content is kept but school links may be cleared.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTargetId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!deleteTargetId || actionLoading === deleteTargetId}
              onClick={() => void confirmDeleteSchool()}
            >
              {actionLoading === deleteTargetId ? "Deleting…" : "Delete school"}
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
            <DialogTitle>Delete selected schools</DialogTitle>
            <DialogDescription>
              This cannot be undone. Associated school admins, teachers, and students for these tenants may be removed according to server policy.
            </DialogDescription>
          </DialogHeader>
          {bulkDeleteTargets && bulkDeleteTargets.length > 0 && (
            <div className="space-y-2 py-2">
              <p className="text-sm text-gray-700">
                Delete{" "}
                <span className="font-semibold">{bulkDeleteTargets.length}</span>{" "}
                school{bulkDeleteTargets.length !== 1 ? "s" : ""}?
              </p>
              <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-sm text-muted-foreground">
                {bulkDeleteTargets.slice(0, 20).map((t) => (
                  <li key={t.id}>{t.name}</li>
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
              onClick={() => void confirmBulkDeleteSchools()}
            >
              {isBulkDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete schools
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
