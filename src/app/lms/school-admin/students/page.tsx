"use client";

import LastSignIn from "@/components/portal/LastSignIn";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, KeyRound, Loader2, Pencil, Plus, Power, Trash2, Upload, Eye as EyeIcon } from "lucide-react";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { toast } from "@/components/ui/toast";
import { requestClose, useDirtySnapshot } from "@/hooks/useUnsavedCloseGuard";
import ConfirmModal from "@/components/portal/ConfirmModal";
import RowMenu from "@/components/portal/RowMenu";
import { ChipGroup, Pager, initialsOf } from "@/components/portal/notifications";
import GradeRun from "@/components/school-admin/GradeRun";
import StudentFormModal from "@/components/school-admin/StudentFormModal";
import StudentDetailModal from "@/components/school-admin/StudentDetailModal";
import StudentImportModal from "@/components/school-admin/StudentImportModal";
import StudentPasswordModal from "@/components/school-admin/StudentPasswordModal";
import {
  csvCell,
  displayStudentName,
  downloadText,
  emptyStudentForm,
  enrollmentMissingClassOrCode,
  formatGradeBadge,
  formatSectionLabel,
  selectChoicesFrom,
  type Student,
  type StudentForm,
} from "@/components/school-admin/student-utils";
import "@/components/school-admin/students.css";

type SchoolGrade = { id: string; name: string; sections: Array<{ id: string; name: string }> };
type Confirm =
  | { kind: "delete"; student: Student }
  | { kind: "toggle"; student: Student; next: boolean }
  | { kind: "bulk"; students: Student[] };

const COUNT_KEY = ["school-admin", "students", "count"] as const;
const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const errText = (e: unknown, fallback = "Try again.") => (e instanceof Error ? e.message : fallback);

/** The API sometimes wraps the payload in `data`; this returns the inner object either way. */
function unwrap(res: { data?: unknown }): Record<string, unknown> {
  const root = (res.data ?? {}) as Record<string, unknown>;
  return root.data != null && typeof root.data === "object" && !Array.isArray(root.data) ? (root.data as Record<string, unknown>) : root;
}

export default function StudentsManagement() {
  const queryClient = useQueryClient();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [schoolId, setSchoolId] = useState("");
  const [schoolGrades, setSchoolGrades] = useState<string[]>([]);
  const [schoolSections, setSchoolSections] = useState<string[]>([]);
  const [schoolGradesDetailed, setSchoolGradesDetailed] = useState<SchoolGrade[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [formData, setFormData] = useState<StudentForm>(emptyStudentForm());
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<Student | null>(null);
  const [resetting, setResetting] = useState<Student | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectAll = useRef<HTMLInputElement>(null);
  const latestLoad = useRef(0);

  /* ───────── school setup: grades and sections ───────── */
  const gradeList = useMemo(() => [...selectChoicesFrom(schoolGrades, false)].sort(natural), [schoolGrades]);
  const predefinedSections = useMemo(() => selectChoicesFrom(schoolSections, false), [schoolSections]);

  /** Sections that exist for a grade; falls back to the school-wide list when the grade is unknown. */
  const sectionsForGrade = useCallback(
    (grade: string) => {
      if (!grade) return predefinedSections;
      const g = schoolGradesDetailed.find((x) => x.name === grade);
      if (!g || g.sections.length === 0) return predefinedSections;
      return selectChoicesFrom(g.sections.map((s) => s.name), false);
    },
    [schoolGradesDetailed, predefinedSections],
  );

  /** Keeps a student's real section selectable even if it is no longer in the grade's configured list. */
  const formSections = useMemo(() => {
    const options = sectionsForGrade(formData.grade);
    const current = formData.section?.trim();
    return !current || options.includes(current) ? options : [...options, current];
  }, [sectionsForGrade, formData.grade, formData.section]);

  const loadSchool = useCallback(async () => {
    try {
      const res = await schoolAdminApi.school.get();
      const school = ((res.data ?? {}) as {
        school?: { id?: string; grades_offered?: string[]; sections_offered?: string[]; grades?: SchoolGrade[] };
      }).school;
      if (school) {
        setSchoolId(school.id ?? "");
        if (school.sections_offered?.length) setSchoolSections(school.sections_offered);
        setSchoolGrades(Array.isArray(school.grades_offered) ? selectChoicesFrom(school.grades_offered, true) : []);
        setSchoolGradesDetailed(Array.isArray(school.grades) ? school.grades : []);
      }
    } catch (err) {
      console.error("Error fetching school info:", err);
    }
  }, []);

  useEffect(() => {
    void loadSchool();
  }, [loadSchool]);

  /* ───────── the list ───────── */
  const filterParams = useCallback(
    () => ({
      q: searchTerm || undefined,
      grade: gradeFilter !== "all" ? gradeFilter : undefined,
      section: sectionFilter !== "all" ? sectionFilter : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
    }),
    [searchTerm, gradeFilter, sectionFilter, statusFilter],
  );

  const loadStudents = useCallback(async () => {
    const req = ++latestLoad.current; // a slower, older response must not overwrite a newer filter's rows
    try {
      setLoading(true);
      setLoadFailed(false);
      const data = unwrap(await schoolAdminApi.students.list({ limit: pageSize, page, ...filterParams() }));
      if (req !== latestLoad.current) return;
      type Api = {
        id?: string;
        profile?: { id?: string; full_name?: string; email?: string; created_at?: string; parent_name?: string; parent_phone?: string };
        student_id?: string;
        school_id?: string;
        grade?: string;
        section?: string;
        joining_code?: string;
        is_active?: boolean;
        enrolled_at?: string;
        last_login?: string | null;
        parent_name?: string;
        parent_phone?: string;
      };
      const raw = ((data as { students?: unknown[] }).students ?? (Array.isArray(data) ? data : [])) as Api[];
      const rows = raw.map((s) => ({
        id: String(s.id ?? s.student_id ?? ""),
        profile_id: s.profile?.id || s.student_id,
        student_id: s.student_id,
        school_id: s.school_id,
        grade: s.grade ?? "",
        section: s.section ?? "",
        joining_code: s.joining_code ?? "",
        is_active: s.is_active ?? true,
        enrolled_at: s.enrolled_at ?? "",
        last_login: s.last_login ?? null,
        profile: {
          full_name: s.profile?.full_name ?? "",
          email: s.profile?.email ?? "",
          created_at: s.profile?.created_at ?? "",
          parent_name: s.profile?.parent_name || s.parent_name || "",
          parent_phone: s.profile?.parent_phone || s.parent_phone || "",
        },
      })) as unknown as Student[];
      setStudents(rows);
      const t = (data as { total?: number }).total;
      setTotal(typeof t === "number" ? t : rows.length);
    } catch (error) {
      if (req !== latestLoad.current) return;
      console.error("Error loading students:", error);
      setLoadFailed(true);
    } finally {
      if (req === latestLoad.current) setLoading(false);
    }
  }, [pageSize, page, filterParams]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  // search waits for a pause in typing so each keystroke is not a request
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, gradeFilter, sectionFilter, statusFilter, pageSize]);

  // a selection belongs to the page it was made on
  useEffect(() => {
    setSelected(new Set());
  }, [page, pageSize, searchTerm, gradeFilter, sectionFilter, statusFilter]);

  const afterChange = useCallback(async () => {
    await loadStudents();
    void queryClient.invalidateQueries({ queryKey: COUNT_KEY });
  }, [loadStudents, queryClient]);

  /* ───────── counts for the grade track and the status strip ───────── */
  const countOf = useCallback(async (params: { grade?: string; section?: string; status?: string }) => {
    const data = unwrap(await schoolAdminApi.students.list({ limit: 1, page: 1, ...params }));
    const t = (data as { total?: number }).total;
    return typeof t === "number" ? t : ((data as { students?: unknown[] }).students ?? []).length;
  }, []);

  const gradeCounts = useQueries({
    queries: gradeList.map((g) => ({
      queryKey: [...COUNT_KEY, "grade", g, statusFilter],
      queryFn: () => countOf({ grade: g, status: statusFilter !== "all" ? statusFilter : undefined }),
      staleTime: 60_000,
    })),
  });
  const scope = { grade: gradeFilter !== "all" ? gradeFilter : undefined, section: sectionFilter !== "all" ? sectionFilter : undefined };
  const activeQ = useQuery({ queryKey: [...COUNT_KEY, "status", "active", gradeFilter, sectionFilter], queryFn: () => countOf({ ...scope, status: "active" }), staleTime: 60_000 });
  const inactiveQ = useQuery({ queryKey: [...COUNT_KEY, "status", "inactive", gradeFilter, sectionFilter], queryFn: () => countOf({ ...scope, status: "inactive" }), staleTime: 60_000 });
  const allCount = activeQ.data != null && inactiveQ.data != null ? activeQ.data + inactiveQ.data : undefined;

  /* ───────── add and edit ───────── */
  const formDirty = useDirtySnapshot(formOpen, formData);
  const closeForm = () =>
    void requestClose(formDirty, () => {
      setFormOpen(false);
      setEditing(null);
    });

  const openAdd = () => {
    setEditing(null);
    setFormData(emptyStudentForm());
    setFormOpen(true);
  };

  const openEdit = (s: Student) => {
    setViewing(null);
    setEditing(s);
    setFormData({
      full_name: s.profile?.full_name || "",
      email: s.profile?.email || "",
      grade: s.grade || "",
      section: s.section || "",
      joining_code: s.joining_code || "",
      password: "",
      parent_name: s.profile?.parent_name || "",
      parent_phone: s.profile?.parent_phone || "",
    });
    setFormOpen(true);
  };

  const canSubmit = editing
    ? !!formData.full_name && !!formData.email && !!formData.section
    : !!(formData.full_name && formData.email && formData.grade && formData.password && formData.section && formData.parent_name && formData.parent_phone);

  const handleAdd = async () => {
    if (!schoolId) {
      toast.error("Your school details have not loaded. Refresh the page and try again.");
      return;
    }
    if (!canSubmit) {
      toast.warning("Fill in every field: name, email, grade, section, password, and the parent's name and number.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.warning("Enter a valid email address.");
      return;
    }
    const { validatePasswordClient } = await import("@/lib/password-validation");
    const pwError = validatePasswordClient(formData.password);
    if (pwError) {
      toast.warning(pwError);
      return;
    }
    setSaving(true);
    try {
      const response = await schoolAdminApi.students.create({
        full_name: formData.full_name,
        email: formData.email,
        grade: formData.grade,
        section: formData.section || undefined,
        password: formData.password,
        parent_name: formData.parent_name || undefined,
        parent_phone: formData.parent_phone || undefined,
      });
      const result = response.data as { success?: boolean; error?: string };
      if (result.success) {
        const { full_name, email } = formData;
        setFormData(emptyStudentForm());
        setFormOpen(false);
        await afterChange();
        toast.success(`Added ${full_name}. They can log in with ${email} and the password you set.`);
      } else {
        toast.error(`Could not add the student: ${result.error || "Try again."}`);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; details?: string } } };
      toast.error(`Could not add the student: ${err?.response?.data?.error || err?.response?.data?.details || errText(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await schoolAdminApi.students.update(editing.id, {
        full_name: formData.full_name,
        email: formData.email,
        grade: formData.grade,
        section: formData.section || null,
        joining_code: formData.joining_code || null,
        parent_name: formData.parent_name || null,
        parent_phone: formData.parent_phone || null,
      });
      setFormOpen(false);
      setEditing(null);
      await afterChange();
      toast.success(`Saved changes to ${formData.full_name}.`);
    } catch (error) {
      toast.error(`Could not save the changes: ${errText(error)}`);
    } finally {
      setSaving(false);
    }
  };

  /* ───────── reset password ───────── */
  const handleResetPassword = async (password: string) => {
    if (!resetting) return;
    const { validatePasswordClient } = await import("@/lib/password-validation");
    const pwError = validatePasswordClient(password);
    if (pwError) {
      toast.warning(pwError);
      return;
    }
    setResetBusy(true);
    try {
      await schoolAdminApi.students.changePassword(resetting.id, { password });
      toast.success(`Password updated for ${displayStudentName(resetting)}.`);
      setResetting(null);
    } catch (error) {
      toast.error(`Could not change the password: ${errText(error)}`);
    } finally {
      setResetBusy(false);
    }
  };

  /* ───────── delete, activate, bulk delete ───────── */
  const runConfirm = async () => {
    if (!confirm || confirmBusy) return;
    setConfirmBusy(true);
    try {
      if (confirm.kind === "delete") {
        await schoolAdminApi.students.delete(confirm.student.id, { hard: true });
        toast.success(`Deleted ${displayStudentName(confirm.student)}.`);
      } else if (confirm.kind === "toggle") {
        const { student, next } = confirm;
        await schoolAdminApi.students.update(student.id, { is_active: next });
        const repair = enrollmentMissingClassOrCode(student) || !(student.profile?.full_name ?? "").trim()
          ? " Their class or name looks blank. Use Edit to fill it in."
          : "";
        toast.success(`${displayStudentName(student)} is now ${next ? "active" : "inactive"}.${repair}`);
      } else {
        const results = await Promise.allSettled(confirm.students.map((s) => schoolAdminApi.students.delete(s.id, { hard: true })));
        const ok = results.filter((r) => r.status === "fulfilled").length;
        const bad = results.length - ok;
        if (ok > 0) toast.success(`Deleted ${plural(ok, "student")}.`);
        if (bad > 0) toast.error(`Could not delete ${plural(bad, "student")}.`);
        setSelected(new Set());
      }
      setViewing(null);
      setConfirm(null);
      await afterChange();
    } catch (error) {
      toast.error(`That did not work: ${errText(error)}`);
    } finally {
      setConfirmBusy(false);
    }
  };

  /* ───────── export ───────── */
  const handleExport = async () => {
    if (total === 0) {
      toast.warning("There are no students to export.");
      return;
    }
    setExporting(true);
    try {
      // The list only holds one page, so walk every page of the same filtered query.
      const size = 200;
      const params = filterParams();
      const grab = async (p: number) => {
        const d = unwrap(await schoolAdminApi.students.list({ limit: size, page: p, ...params }));
        return { students: ((d.students as Student[]) ?? []), total: (d.total as number) ?? 0 };
      };
      const first = await grab(1);
      const all = [...first.students];
      const pages = Math.min(Math.ceil(first.total / size), 25); // up to 5,000 students
      for (let p = 2; p <= pages; p++) all.push(...(await grab(p)).students);
      if (all.length === 0) {
        toast.warning("There are no students to export.");
        return;
      }
      const headers = ["Name", "Email", "Grade", "Section", "Parent name", "Parent phone", "Joining code", "Status", "Enrolled date"];
      const rows = all.map((s) => [
        s?.profile?.full_name?.trim() || displayStudentName(s),
        s?.profile?.email || "",
        s.grade || "",
        s.section || "",
        s?.profile?.parent_name || "",
        s?.profile?.parent_phone || "",
        s.joining_code || "",
        s.is_active ? "Active" : "Inactive",
        s.enrolled_at ? new Date(s.enrolled_at).toLocaleDateString() : "",
      ]);
      downloadText(`students_export_${new Date().toISOString().split("T")[0]}.csv`, [headers.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n"));
      toast.success(`Exported ${plural(all.length, "student")} to CSV.`);
    } catch (error) {
      console.error("Error exporting students:", error);
      toast.error("The export did not finish. Try again.");
    } finally {
      setExporting(false);
    }
  };

  /* ───────── selection ───────── */
  const allOnPage = students.length > 0 && students.every((s) => selected.has(s.id));
  const someOnPage = students.some((s) => selected.has(s.id));
  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = someOnPage && !allOnPage;
  }, [someOnPage, allOnPage]);
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectedStudents = students.filter((s) => selected.has(s.id));

  /* ───────── copy ───────── */
  const hasFilters = !!searchTerm || gradeFilter !== "all" || sectionFilter !== "all" || statusFilter !== "all";
  const clearFilters = () => {
    setSearchInput("");
    setGradeFilter("all");
    setSectionFilter("all");
    setStatusFilter("all");
  };
  const describe = [
    gradeFilter !== "all" && gradeFilter,
    sectionFilter !== "all" && formatSectionLabel(sectionFilter),
    statusFilter !== "all" && statusFilter,
    searchTerm && `“${searchTerm}”`,
  ].filter(Boolean) as string[];

  let status: React.ReactNode;
  if (loadFailed) status = "The students did not load. Check your connection and try again.";
  else if (loading && students.length === 0) status = "Loading students…";
  else if (hasFilters) status = <><strong>{plural(total, "student")}</strong> {total === 1 ? "matches" : "match"} {describe.join(", ")}.</>;
  else status = <><strong>{plural(total, "student")}</strong> in your school.</>;

  const sectionChoices = sectionsForGrade(gradeFilter !== "all" ? gradeFilter : "");
  const gradeStrengths = gradeList.map((name, i) => ({ name, count: gradeCounts[i]?.data }));
  const statusButtons = [
    { id: "all", label: "All students", value: allCount, hint: "Active and inactive" },
    { id: "active", label: "Active", value: activeQ.data, hint: "Can log in" },
    { id: "inactive", label: "Inactive", value: inactiveQ.data, hint: "Locked out" },
  ];

  const rowMenu = (s: Student) => [
    { label: "View details", icon: EyeIcon, onClick: () => setViewing(s) },
    { label: "Edit", icon: Pencil, onClick: () => openEdit(s) },
    { label: "Reset password", icon: KeyRound, onClick: () => setResetting(s) },
    { label: s.is_active ? "Deactivate" : "Activate", icon: Power, onClick: () => setConfirm({ kind: "toggle", student: s, next: !s.is_active }) },
    { label: "Delete", icon: Trash2, danger: true, separatorBefore: true, onClick: () => setConfirm({ kind: "delete", student: s }) },
  ];

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="sm-title">
        <div className="sd-hero-copy">
          <h1 id="sm-title" className="mc-hero-title">Students</h1>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            <button className="sd-btn sd-btn--amber" onClick={openAdd}><Plus aria-hidden="true" />Add student</button>
            <button className="sd-btn sd-btn--ghost-dark" onClick={() => setImportOpen(true)}><Upload aria-hidden="true" />Import CSV</button>
            <button className="sd-btn sd-btn--ghost-dark" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}Export
            </button>
          </div>
        </div>
        <GradeRun
          grades={gradeStrengths}
          selected={gradeFilter}
          onSelect={(g) => { setGradeFilter(g); setSectionFilter("all"); }}
          total={allCount}
          matching={loading && students.length === 0 ? undefined : total}
        />
      </section>

      <div className="sd-ledger sm-ledger" data-cols="3" role="group" aria-label="Show students by status">
        {statusButtons.map((b) => (
          <button key={b.id} type="button" aria-pressed={statusFilter === b.id} onClick={() => setStatusFilter(b.id)}>
            <span className="sd-l">{b.label}</span>
            {b.value == null ? <span className="sd-skel" style={{ height: "2.2rem", width: "4rem" }} /> : <b className="sd-n">{b.value.toLocaleString("en-IN")}</b>}
            <small>{b.hint}</small>
          </button>
        ))}
      </div>

      <div className="nt-bar">
        <input
          type="search"
          className="sd-field"
          placeholder="Search by name, email or parent"
          aria-label="Search students"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {gradeList.length > 0 && (
          <ChipGroup
            label="Grade"
            value={gradeFilter}
            options={[["all", "All grades"] as const, ...gradeList.map((g) => [g, g] as const)]}
            onChange={(g) => { setGradeFilter(g); setSectionFilter("all"); }}
          />
        )}
        {sectionChoices.length > 0 && (
          <ChipGroup
            label="Section"
            value={sectionFilter}
            options={[["all", "All sections"] as const, ...sectionChoices.map((s) => [s, formatSectionLabel(s)] as const)]}
            onChange={setSectionFilter}
          />
        )}
        {hasFilters && <button className="sd-btn sd-btn--line" onClick={clearFilters}>Clear filters</button>}
      </div>

      {loading && students.length === 0 ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : loadFailed ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>We could not load your students</b>
            <p>Check your connection, then try again.</p>
            <button className="sd-btn sd-btn--amber" onClick={() => void loadStudents()}>Try again</button>
          </div>
        </section>
      ) : students.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>{hasFilters ? "No students match" : "No students yet"}</b>
            <p>{hasFilters ? "Try a different search, or clear the filters." : "Add students one at a time, or import a whole class from a CSV file."}</p>
            {hasFilters ? (
              <button className="sd-btn sd-btn--line" onClick={clearFilters}>Clear filters</button>
            ) : (
              <div className="sd-hero-actions" style={{ marginTop: 0 }}>
                <button className="sd-btn sd-btn--amber" onClick={openAdd}><Plus aria-hidden="true" />Add student</button>
                <button className="sd-btn sd-btn--line" onClick={() => setImportOpen(true)}><Upload aria-hidden="true" />Import CSV</button>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="sd-panel as-list mc-swap" aria-label="Students" aria-busy={loading}>
          {selectedStudents.length > 0 && (
            <div className="sm-bulk" role="status">
              <b>{selectedStudents.length} selected</b>
              <div>
                <button className="sd-btn sd-btn--line" onClick={() => setSelected(new Set())}>Clear</button>
                <button className="sd-btn sd-btn--danger" onClick={() => setConfirm({ kind: "bulk", students: selectedStudents })}><Trash2 aria-hidden="true" />Delete</button>
              </div>
            </div>
          )}
          <div className="sm-head" aria-hidden={false}>
            <input ref={selectAll} type="checkbox" className="sm-check" checked={allOnPage} onChange={() => setSelected(allOnPage ? new Set() : new Set(students.map((s) => s.id)))} aria-label="Select everyone on this page" />
            <span />
            <span>Student</span>
            <span>Class</span>
            <span>Parent or guardian</span>
            <span>Status</span>
            <span>Last sign-in</span>
            <span />
          </div>
          {students.map((s) => {
            const name = displayStudentName(s);
            const grade = formatGradeBadge(s.grade);
            return (
              <article key={s.id} className="sm-row" data-selected={selected.has(s.id)}>
                <input type="checkbox" className="sm-check" checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} aria-label={`Select ${name}`} />
                <span className="sd-avatar" aria-hidden="true">{initialsOf(name)}</span>
                <button className="sm-who" onClick={() => setViewing(s)}>
                  <b>{name}</b>
                  <small>{s.profile?.email || "No email"}</small>
                </button>
                <div className="sm-class">
                  {grade || s.section ? (
                    <>
                      {grade && <span className="sm-chip" data-class="true">{grade}</span>}
                      {s.section && <span className="sm-chip">{formatSectionLabel(s.section)}</span>}
                    </>
                  ) : (
                    <span className="sm-chip" data-warn="true">No class</span>
                  )}
                </div>
                <div className="sm-parent">
                  {s.profile?.parent_name || s.profile?.parent_phone ? (
                    <>
                      {s.profile.parent_name && <b>{s.profile.parent_name}</b>}
                      {s.profile.parent_phone && <a href={`tel:${s.profile.parent_phone}`}>{s.profile.parent_phone}</a>}
                    </>
                  ) : (
                    <span className="sm-muted">Not provided</span>
                  )}
                </div>
                <span className="sm-status"><span className="sm-chip" data-on={s.is_active}>{s.is_active ? "Active" : "Inactive"}</span></span>
                <span className="sm-seen"><LastSignIn at={s.last_login} /></span>
                <div className="sm-acts">
                  <button className="pl-ico" onClick={() => openEdit(s)} aria-label={`Edit ${name}`} title="Edit"><Pencil /></button>
                  <RowMenu label={`More actions for ${name}`} items={rowMenu(s)} />
                </div>
              </article>
            );
          })}
          <Pager
            offset={(page - 1) * pageSize}
            count={students.length}
            total={total}
            pageSize={pageSize}
            busy={loading}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
            sizes={[25, 50, 100]}
            onSize={setPageSize}
            noun="Students"
          />
        </section>
      )}

      <StudentFormModal
        open={formOpen}
        mode={editing ? "edit" : "add"}
        form={formData}
        onChange={setFormData}
        grades={gradeList}
        sections={formSections}
        busy={saving}
        canSubmit={canSubmit}
        onClose={closeForm}
        onSubmit={() => void (editing ? handleEdit() : handleAdd())}
      />

      <StudentDetailModal
        student={viewing}
        onClose={() => setViewing(null)}
        onEdit={() => viewing && openEdit(viewing)}
        onResetPassword={() => { if (viewing) { setResetting(viewing); setViewing(null); } }}
        onToggle={() => viewing && setConfirm({ kind: "toggle", student: viewing, next: !viewing.is_active })}
        onDelete={() => viewing && setConfirm({ kind: "delete", student: viewing })}
      />

      <StudentPasswordModal
        key={resetting?.id ?? "none"}
        open={!!resetting}
        name={resetting ? displayStudentName(resetting) : ""}
        busy={resetBusy}
        onClose={() => setResetting(null)}
        onSubmit={(pw) => void handleResetPassword(pw)}
        onCopied={(err) => (err ? toast.error(err) : toast.success("Password copied."))}
      />

      <StudentImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={() => void afterChange()} />

      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        busy={confirmBusy}
        danger={confirm?.kind !== "toggle" || !confirm.next}
        onConfirm={() => void runConfirm()}
        title={
          confirm?.kind === "delete" ? "Delete this student?"
          : confirm?.kind === "bulk" ? `Delete ${plural(confirm.students.length, "student")}?`
          : confirm?.next ? "Activate this student?" : "Deactivate this student?"
        }
        subtitle={
          confirm?.kind === "toggle"
            ? confirm.next ? "They will be able to log in again." : "They will not be able to log in until you activate them again."
            : "They move to the Trash, where the platform admin can restore them. Until then they cannot sign in."
        }
        confirmLabel={
          confirm?.kind === "delete" ? "Delete student"
          : confirm?.kind === "bulk" ? "Delete students"
          : confirm?.next ? "Activate" : "Deactivate"
        }
      >
        {confirm?.kind === "bulk" ? (
          <ul className="sm-bulklist">
            {confirm.students.slice(0, 20).map((s) => <li key={s.id}>{displayStudentName(s)}</li>)}
            {confirm.students.length > 20 && <li>…and {confirm.students.length - 20} more</li>}
          </ul>
        ) : confirm ? (
          <p><strong>{displayStudentName(confirm.student)}</strong></p>
        ) : null}
      </ConfirmModal>
    </div>
  );
}
