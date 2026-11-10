"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Eye, KeyRound, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import ConfirmModal from "@/components/portal/ConfirmModal";
import RowMenu from "@/components/portal/RowMenu";
import { ChipGroup, Pager, ago, initialsOf } from "@/components/portal/notifications";
import CoverageRun, { COVERAGE_LABEL, type Coverage } from "@/components/admin/school-admins/CoverageRun";
import { AdminFormModal, ResetPasswordModal, type AdminFormValues } from "@/components/admin/school-admins/AdminModals";
import { mapApiSchoolToSchool, placeOf } from "@/components/admin/schools/utils";
import { adminApi } from "@/lib/api/admin.api";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm";
import { loadFormData } from "@/lib/form-persistence";
import { useAdminSchools } from "@/hooks/useAdminSchools";
import { toast } from "@/components/ui/toast";
import { validatePasswordClient } from "@/lib/password-validation";
import { requestClose, useDirtySnapshot } from "@/hooks/useUnsavedCloseGuard";
import "@/components/school-admin/overview.css"; // hero meta
import "@/components/teacher/overview/overview.css"; // track
import "@/components/school-admin/students.css"; // sm- chips and forms
import "@/components/school-admin/teachers.css"; // tm- track nodes
import "@/components/admin/school-admins/school-admins.css";

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

const PAGE_SIZE = 15;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
type Sort = "name" | "newest" | "school" | "seen";
const SORTS: [Sort, string][] = [["name", "Name, A to Z"], ["newest", "Newest first"], ["school", "School, A to Z"], ["seen", "Longest since sign-in"]];
type Status = "all" | "active" | "inactive";
const serverError = (error: unknown, fallback: string) => {
  const err = error as { response?: { data?: { error?: string; details?: string; message?: string } } };
  const d = err.response?.data;
  return d?.details ? `${d.error ?? "Error"}: ${d.details}` : d?.error ?? d?.message ?? fallback;
};

export default function SchoolAdminManagement() {
  const router = useRouter();
  const [schoolAdmins, setSchoolAdmins] = useState<SchoolAdmin[]>([]);
  const { schools: rawSchools } = useAdminSchools();
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<SchoolAdmin[] | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
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

  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [neverOnly, setNeverOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("name");
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [now] = useState(() => Date.now());

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

  // Fetch school admins (full list; this page searches and filters client-side)
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
      console.error('Error fetching school admins:', error);
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

  const schools = useMemo(
    () => (rawSchools ?? []).map((s) => mapApiSchoolToSchool(s as Record<string, unknown>)).filter((s) => s.id),
    [rawSchools],
  );
  const schoolChoices = useMemo(
    () => schools.map((s) => ({ id: s.id, name: s.name, place: placeOf(s) })).sort((a, b) => a.name.localeCompare(b.name)),
    [schools],
  );

  /* ───────── coverage: does each school have someone running it? ───────── */
  const coverageBySchool = useMemo(() => {
    const by = new Map<string, { active: number; total: number }>();
    schoolAdmins.forEach((a) => {
      const cur = by.get(a.school_id) ?? { active: 0, total: 0 };
      cur.total += 1;
      if (a.is_active) cur.active += 1;
      by.set(a.school_id, cur);
    });
    return by;
  }, [schoolAdmins]);
  const coverageOfSchool = (id: string): Coverage => {
    const c = coverageBySchool.get(id);
    return !c ? "none" : c.active > 0 ? "covered" : "inactive";
  };
  const counts = useMemo(() => {
    const c: Record<Coverage, number> = { covered: 0, inactive: 0, none: 0 };
    schools.forEach((s) => { c[coverageOfSchool(s.id)] += 1; });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- coverageOfSchool reads coverageBySchool
  }, [schools, coverageBySchool]);
  const schoolsWithoutAdmin = useMemo(
    () => schools.filter((s) => !coverageBySchool.has(s.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [schools, coverageBySchool],
  );

  const activeCount = schoolAdmins.filter((a) => a.is_active).length;
  const neverCount = schoolAdmins.filter((a) => !a.last_login).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = schoolAdmins.filter((a) => {
      if (status === "active" && !a.is_active) return false;
      if (status === "inactive" && a.is_active) return false;
      if (neverOnly && a.last_login) return false;
      if (schoolFilter && a.school_id !== schoolFilter) return false;
      if (coverage && coverage !== "none" && coverageOfSchool(a.school_id) !== coverage) return false;
      if (!q) return true;
      return [a.full_name, a.email, a.phone, a.schools?.name, a.schools?.city].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
    return list.sort((a, b) => {
      if (sort === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sort === "school") return (a.schools?.name ?? "").localeCompare(b.schools?.name ?? "") || a.full_name.localeCompare(b.full_name);
      if (sort === "seen") return (a.last_login ? new Date(a.last_login).getTime() : 0) - (b.last_login ? new Date(b.last_login).getTime() : 0);
      return a.full_name.localeCompare(b.full_name);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- coverageOfSchool reads coverageBySchool
  }, [schoolAdmins, search, schoolFilter, status, coverage, neverOnly, sort, coverageBySchool]);

  const hasFilters = !!search.trim() || !!schoolFilter || status !== "all" || coverage !== null || neverOnly;
  const showingGaps = coverage === "none";
  const lastPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
  const at = Math.min(page, lastPage);
  const visible = filtered.slice(at * PAGE_SIZE, at * PAGE_SIZE + PAGE_SIZE);
  const selected = schoolAdmins.filter((a) => picked.has(a.id));
  const allOnPage = visible.length > 0 && visible.every((a) => picked.has(a.id));

  const clearFilters = () => { setSearch(""); setSchoolFilter(""); setStatus("all"); setCoverage(null); setNeverOnly(false); setPage(0); };
  const pickCoverage = (c: Coverage | null) => { setCoverage(c); setPage(0); };
  const toggleOne = (id: string) => setPicked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const togglePage = () => setPicked((prev) => {
    const next = new Set(prev);
    visible.forEach((a) => (allOnPage ? next.delete(a.id) : next.add(a.id)));
    return next;
  });

  /* ───────── add, edit, reset, delete ───────── */
  const isAddAdminDirty =
    formData.full_name.trim() !== "" ||
    formData.email.trim() !== "" ||
    formData.phone.trim() !== "" ||
    formData.school_id !== "" ||
    formData.temp_password.trim() !== "";

  const isEditAdminDirty = useDirtySnapshot(isEditDialogOpen, {
    full_name: formData.full_name,
    email: formData.email,
    phone: formData.phone,
    school_id: formData.school_id,
  });

  const discardAddAdminDialog = () => {
    setIsAddDialogOpen(false);
    setFormErrors({});
    setFormData(DEFAULT_FORM_DATA);
  };

  const discardEditAdminDialog = () => {
    setIsEditDialogOpen(false);
    setEditingAdmin(null);
    setFormErrors({});
    setFormData(DEFAULT_FORM_DATA);
  };

  const requestCloseAddAdmin = () => {
    void requestClose(isAddAdminDirty, discardAddAdminDialog);
  };

  const requestCloseEditAdmin = () => {
    void requestClose(isEditAdminDirty, discardEditAdminDialog);
  };

  const validateAdminForm = (isEdit: boolean): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.full_name.trim()) errors.full_name = "Enter their full name.";
    if (!formData.email.trim()) errors.email = "Enter their email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = "That email does not look right.";
    }
    if (!formData.phone.trim()) errors.phone = "Enter their phone number.";
    if (!formData.school_id.trim()) errors.school_id = "Choose a school.";
    if (!isEdit) {
      if (!formData.temp_password.trim()) {
        errors.temp_password = "Set a temporary password.";
      } else {
        const passwordError = validatePasswordClient(formData.temp_password);
        if (passwordError) errors.temp_password = passwordError;
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openAdd = (schoolId = "") => {
    setFormErrors({});
    setFormData((prev) => ({ ...prev, school_id: schoolId || prev.school_id }));
    setIsAddDialogOpen(true);
  };

  const handleAddAdmin = async () => {
    if (!validateAdminForm(false)) return;
    try {
      setActionLoading('add');
      await adminApi.schoolAdmins.create(formData);
      toast.success(`${formData.full_name.trim()} was added as a school admin.`);
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
      toast.error(serverError(error, 'Could not add the school admin.'));
    } finally {
      setActionLoading(null);
    }
  };

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
    setIsEditDialogOpen(true);
  };

  const handleChangePassword = async () => {
    if (!passwordTarget) return;

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
      toast.success(`Password reset for ${passwordTarget.full_name}.`);
      setNewPassword("");
      setPasswordTarget(null);
      fetchSchoolAdmins();
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(`Could not reset the password: ${serverError(error, 'Unknown error')}`);
    } finally {
      setActionLoading(null);
    }
  };

  const copyNewPassword = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Password copied.');
    } catch (err) {
      console.error('Failed to copy password:', err);
      toast.error('Could not copy the password.');
    }
  };

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
      toast.success(`${formData.full_name.trim()} was updated.`);
      setIsEditDialogOpen(false);
      setEditingAdmin(null);
      setFormErrors({});
      fetchSchoolAdmins();
    } catch (error) {
      console.error('Error updating school admin:', error);
      toast.error(`Could not update the school admin: ${serverError(error, 'Unknown error')}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteAdmin = async (admin: SchoolAdmin) => {
    try {
      setActionLoading(admin.id);
      await adminApi.schoolAdmins.delete(admin.id);
      toast.success(`${admin.full_name} was deleted.`);
      setDeleteTarget(null);
      fetchSchoolAdmins();
    } catch (error) {
      console.error('Error deleting school admin:', error);
      toast.error(serverError(error, 'Could not delete the school admin.'));
    } finally {
      setActionLoading(null);
    }
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
        toast.success(`Deleted ${plural(succeededIds.length, "school admin")}.`);
        setPicked((prev) => { const next = new Set(prev); succeededIds.forEach((id) => next.delete(id)); return next; });
        await fetchSchoolAdmins();
      }
      if (failedLabels.length > 0) {
        toast.error(
          `Could not delete ${plural(failedLabels.length, "school admin")}: ${failedLabels.slice(0, 5).join(", ")}${failedLabels.length > 5 ? "…" : ""}`,
        );
      }
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error("Bulk delete failed unexpectedly.");
    } finally {
      setIsBulkDeleting(false);
      setBulkDeleteTargets(null);
    }
  };

  const handleToggleStatus = async (admin: SchoolAdmin, newStatus?: boolean) => {
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
      toast.success(statusToSet ? `${admin.full_name} can sign in again.` : `${admin.full_name} can no longer sign in.`);
    } catch (error) {
      setSchoolAdmins(prev => prev.map((a: SchoolAdmin) =>
        a.id === admin.id ? { ...a, is_active: admin.is_active } : a
      ));
      console.error('Error updating school admin status:', error);
      toast.error(serverError(error, 'Could not change the account. Try again.'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleInputChange = (field: keyof AdminFormValues, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  /* ───────── copy ───────── */
  let statusLine: React.ReactNode;
  if (connectionError) statusLine = "The school admins did not load. Try again.";
  else if (isLoading && schoolAdmins.length === 0) statusLine = "Loading school admins…";
  else if (showingGaps) statusLine = schoolsWithoutAdmin.length > 0 ? <><strong>{plural(schoolsWithoutAdmin.length, "school")}</strong> {schoolsWithoutAdmin.length === 1 ? "has" : "have"} no school admin yet.</> : <strong>Every school has a school admin.</strong>;
  else if (hasFilters) statusLine = <><strong>{filtered.length} of {plural(schoolAdmins.length, "school admin")}</strong> match your filters.</>;
  else if (schools.length === 0 && schoolAdmins.length === 0) statusLine = "No school admins yet. Add a school first, then add its admin.";
  else if (counts.none > 0) statusLine = <><strong>{plural(counts.none, "school")}</strong> {counts.none === 1 ? "has" : "have"} no school admin yet.</>;
  else if (counts.inactive > 0) statusLine = <><strong>{plural(counts.inactive, "school")}</strong> only {counts.inactive === 1 ? "has" : "have"} inactive admins.</>;
  else statusLine = <><strong>Every school has a school admin.</strong> {plural(activeCount, "account")} {activeCount === 1 ? "is" : "are"} active.</>;

  const runCaption = isLoading ? "Loading…" : counts.none + counts.inactive > 0 ? `${plural(counts.none + counts.inactive, "school")} to sort out` : schools.length ? "Every school is covered" : "No schools yet";
  const dash = connectionError;

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="sa-title">
        <div className="sd-hero-copy">
          <h1 id="sa-title" className="mc-hero-title">School admins</h1>
          <p className="sd-where">Who runs each school</p>
          <p className="sd-status">{statusLine}</p>
          <div className="sd-hero-actions">
            <button className="sd-btn sd-btn--amber" onClick={() => openAdd()}><Plus aria-hidden="true" />Add school admin</button>
            {counts.none > 0 && !showingGaps && (
              <button className="sd-btn sd-btn--ghost-dark" onClick={() => pickCoverage("none")}>Show {plural(counts.none, "school")} without one</button>
            )}
          </div>
          <div className="so-meta">
            <button className="so-refresh" onClick={() => void fetchSchoolAdmins()} disabled={isLoading} aria-label={isLoading ? "Refreshing" : "Refresh"} title="Refresh">
              <RefreshCw className={isLoading ? "animate-spin" : ""} aria-hidden="true" />
            </button>
          </div>
        </div>
        {isLoading && schoolAdmins.length === 0 ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : (
          <CoverageRun counts={counts} selected={coverage} onSelect={pickCoverage} caption={runCaption} />
        )}
      </section>

      <div className="sd-ledger" role="group" aria-label="School admin numbers">
        <button type="button" aria-pressed={!hasFilters} onClick={clearFilters}>
          <span className="sd-l">School admins</span><b className="sd-n">{dash ? "–" : schoolAdmins.length}</b><small>{dash ? "Not loaded" : plural(schools.length, "school") + " on the platform"}</small>
        </button>
        <button type="button" aria-pressed={status === "active"} onClick={() => { setStatus(status === "active" ? "all" : "active"); setCoverage(null); setPage(0); }}>
          <span className="sd-l">Active accounts</span><b className="sd-n">{dash ? "–" : activeCount}</b><small>{dash ? "Not loaded" : schoolAdmins.length - activeCount > 0 ? `${schoolAdmins.length - activeCount} inactive` : "Everyone can sign in"}</small>
        </button>
        <button type="button" aria-pressed={neverOnly} className={neverCount > 0 ? "sa-hot" : undefined} onClick={() => { setNeverOnly(!neverOnly); setCoverage(null); setPage(0); }}>
          <span className="sd-l">Never signed in</span><b className="sd-n">{dash ? "–" : neverCount}</b><small>{neverCount > 0 ? "Still on the temporary password" : "Everyone has signed in"}</small>
        </button>
        <button type="button" aria-pressed={showingGaps} className={counts.none > 0 ? "sa-hot" : undefined} onClick={() => pickCoverage(showingGaps ? null : "none")}>
          <span className="sd-l">Schools without an admin</span><b className="sd-n">{dash ? "–" : counts.none}</b><small>{counts.none > 0 ? "Tap to see which" : "Every school has one"}</small>
        </button>
      </div>

      {schoolAdmins.length > 0 && !showingGaps && (
        <div className="sa-bar">
          <div className="sd-search" style={{ flex: "1 1 18rem", maxWidth: "30rem", width: "auto" }}>
            <Search aria-hidden="true" />
            <input type="search" placeholder="Search admins or schools" aria-label="Search school admins" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          </div>
          {schoolChoices.length > 1 && (
            <select className="sd-field" aria-label="Show admins of one school" value={schoolFilter} onChange={(e) => { setSchoolFilter(e.target.value); setPage(0); }}>
              <option value="">All schools</option>
              {schoolChoices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <select className="sd-field" aria-label="Sort school admins" value={sort} onChange={(e) => { setSort(e.target.value as Sort); setPage(0); }}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <ChipGroup label="Account status" value={status} options={[["all", "All"], ["active", "Active"], ["inactive", "Inactive"]] as const} onChange={(v) => { setStatus(v); setPage(0); }} />
          {coverage && <span className="sm-chip" data-class="true">{COVERAGE_LABEL[coverage]}</span>}
          {neverOnly && <span className="sm-chip" data-class="true">Never signed in</span>}
          {hasFilters && <button className="sd-btn sd-btn--line" onClick={clearFilters}>Clear filters</button>}
        </div>
      )}

      {isLoading && schoolAdmins.length === 0 ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : connectionError ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>We could not load the school admins</b>
            <p>Check your connection, then try again.</p>
            <button className="sd-btn sd-btn--amber" onClick={() => void fetchSchoolAdmins()}>Try again</button>
          </div>
        </section>
      ) : showingGaps ? (
        schoolsWithoutAdmin.length === 0 ? (
          <section className="sd-panel">
            <div className="sd-empty">
              <b>Every school has a school admin</b>
              <p>Nothing to assign right now.</p>
              <button className="sd-btn sd-btn--line" onClick={() => pickCoverage(null)}>Show all school admins</button>
            </div>
          </section>
        ) : (
          <section className="sd-panel sa-list mc-swap" aria-label="Schools without a school admin">
            <div className="sa-gaps">
              {schoolsWithoutAdmin.map((s) => (
                <div key={s.id} className="sa-gap">
                  <span><b>{s.name}</b><small>{[s.school_code, placeOf(s)].filter(Boolean).join(" · ") || "No location yet"}</small></span>
                  <button className="sd-btn sd-btn--amber" onClick={() => openAdd(s.id)}><Plus aria-hidden="true" />Assign a school admin</button>
                </div>
              ))}
            </div>
          </section>
        )
      ) : schoolAdmins.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>No school admins yet</b>
            <p>A school admin runs one school: its teachers, students, classes and reports. Add one for each school.</p>
            <button className="sd-btn sd-btn--amber" onClick={() => openAdd()}><Plus aria-hidden="true" />Add school admin</button>
          </div>
        </section>
      ) : filtered.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>No school admins match</b>
            <p>Try a different search, or clear the filters.</p>
            <button className="sd-btn sd-btn--line" onClick={clearFilters}>Clear filters</button>
          </div>
        </section>
      ) : (
        <section className="sd-panel sa-list mc-swap" aria-label="School admins">
          <div className="sa-head">
            <input type="checkbox" className="sa-check" aria-label="Select every school admin on this page" checked={allOnPage} onChange={togglePage} />
            <span />
            <span>School admin</span>
            <span>School</span>
            <span>Account</span>
            <span>Last sign-in</span>
            <span />
          </div>
          {visible.map((a) => {
            const place = a.schools ? [a.schools.city, a.schools.state].filter(Boolean).join(", ") : "";
            return (
              <div key={a.id} className="sa-row" data-picked={picked.has(a.id)} data-off={!a.is_active}>
                <input type="checkbox" className="sa-check" aria-label={`Select ${a.full_name}`} checked={picked.has(a.id)} onChange={() => toggleOne(a.id)} />
                <span className="sd-avatar" aria-hidden="true">{initialsOf(a.full_name)}</span>
                <span className="sa-who"><b>{a.full_name}</b><small>{a.email}</small>{a.phone && <small>{a.phone}</small>}</span>
                <span className="sa-school"><b>{a.schools?.name ?? "No school"}</b>{place && <small>{place}</small>}</span>
                <span className="sa-status">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={a.is_active}
                    aria-label={`${a.full_name} can sign in`}
                    className="st-switch"
                    disabled={actionLoading === a.id}
                    onClick={() => void handleToggleStatus(a, !a.is_active)}
                  />
                  {a.is_active ? "Active" : "Inactive"}
                </span>
                <span className="sa-seen">
                  {a.last_login ? <>{ago(a.last_login, now)}</> : <span className="sm-chip" data-warn="true">Never signed in</span>}
                  <small>Added {new Date(a.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</small>
                </span>
                <span className="sa-menu">
                  <RowMenu
                    label={`Actions for ${a.full_name}`}
                    items={[
                      { label: "Edit details", icon: Pencil, onClick: () => handleEditAdmin(a) },
                      { label: "Reset password", icon: KeyRound, onClick: () => { setNewPassword(""); setPasswordTarget(a); } },
                      { label: "Open school", icon: Eye, onClick: () => router.push(`/lms/admin/schools/${a.school_id}`) },
                      { label: "Delete school admin", icon: Trash2, onClick: () => setDeleteTarget(a), danger: true, separatorBefore: true },
                    ]}
                  />
                </span>
              </div>
            );
          })}
          <Pager offset={at * PAGE_SIZE} count={visible.length} total={filtered.length} pageSize={PAGE_SIZE} noun="school admins" onPrev={() => setPage(Math.max(0, at - 1))} onNext={() => setPage(at + 1)} />
        </section>
      )}

      {selected.length > 0 && (
        <div className="sa-selbar" role="region" aria-label="Selected school admins">
          <b>{plural(selected.length, "school admin")} selected</b>
          <div>
            <button className="sd-btn sd-btn--line" onClick={() => setPicked(new Set())}>Clear</button>
            <button className="sd-btn sd-btn--danger" onClick={() => setBulkDeleteTargets(selected)}><Trash2 aria-hidden="true" />Delete</button>
          </div>
        </div>
      )}

      <AdminFormModal
        mode="add"
        open={isAddDialogOpen}
        values={formData}
        errors={formErrors}
        schools={schoolChoices}
        busy={actionLoading === "add"}
        onChange={handleInputChange}
        onCopyPassword={() => void copyNewPassword(formData.temp_password)}
        onSubmit={() => void handleAddAdmin()}
        onClose={requestCloseAddAdmin}
      />
      <AdminFormModal
        mode="edit"
        open={isEditDialogOpen}
        values={formData}
        errors={formErrors}
        schools={schoolChoices}
        busy={actionLoading === "edit"}
        onChange={handleInputChange}
        onCopyPassword={() => undefined}
        onSubmit={() => void handleUpdateAdmin()}
        onClose={requestCloseEditAdmin}
      />
      <ResetPasswordModal
        name={passwordTarget?.full_name ?? ""}
        open={passwordTarget !== null}
        password={newPassword}
        busy={actionLoading === "change-password"}
        onPassword={setNewPassword}
        onCopy={() => void copyNewPassword(newPassword)}
        onClose={() => { setPasswordTarget(null); setNewPassword(""); }}
        onConfirm={() => void handleChangePassword()}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete this school admin?"
        subtitle={deleteTarget ? `${deleteTarget.full_name}, ${deleteTarget.schools?.name ?? "no school"}` : undefined}
        confirmLabel="Delete school admin"
        danger
        busy={actionLoading !== null && actionLoading === deleteTarget?.id}
        onConfirm={() => deleteTarget && void handleDeleteAdmin(deleteTarget)}
      >
        <p>This cannot be undone. Their account and permissions are removed. The school will have no admin until you add one.</p>
      </ConfirmModal>

      <ConfirmModal
        open={bulkDeleteTargets !== null}
        onClose={() => setBulkDeleteTargets(null)}
        title={`Delete ${plural(bulkDeleteTargets?.length ?? 0, "school admin")}?`}
        confirmLabel="Delete school admins"
        danger
        busy={isBulkDeleting}
        onConfirm={() => void confirmBulkDeleteAdmins()}
      >
        <p>This cannot be undone. Their accounts and permissions are removed, according to server policy.</p>
        <ul className="sa-names">
          {(bulkDeleteTargets ?? []).slice(0, 20).map((t) => <li key={t.id}>{t.full_name} ({t.email})</li>)}
          {(bulkDeleteTargets?.length ?? 0) > 20 && <li style={{ listStyle: "none" }}>…and {(bulkDeleteTargets?.length ?? 0) - 20} more</li>}
        </ul>
      </ConfirmModal>
    </div>
  );
}
