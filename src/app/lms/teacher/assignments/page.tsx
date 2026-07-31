"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { teacherApi } from "@/lib/api/teacher.api";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { useTeacherSchools } from "@/hooks/useTeacherData";
import { useTeacherSchool } from "../context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssignmentBuilder, type Assignment as BuilderAssignment } from "@/components/admin/AssignmentBuilder";
import AssignmentAnalyticsPanel, { type AssignmentAnalyticsData } from "@/components/teacher/AssignmentAnalyticsPanel";
import TeacherRetakeRequestsPanel from "@/components/teacher/TeacherRetakeRequestsPanel";
import { AssignmentAudiencePicker, type TeacherClass } from "@/components/teacher/AssignmentAudiencePicker";
import {
  BookOpen,
  ClipboardList,
  Users,
  RotateCcw,
  CheckCircle,
  Clock,
  Plus,
  AlertCircle,
  BarChart2,
  Globe,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  Target,
  Layers,
  Search,
  Send,
  X,
  Star,
  FileText,
  Zap,
  ArrowLeft,
} from "lucide-react";

/* ─── types ─── */
type TeacherAssignment = {
  id: string;
  title: string;
  subject?: string | null;
  due_date?: string | null;
  total_marks?: number | null;
  retake_enabled?: boolean;
  retake_rule?: string;
  assignment_type?: string;
  avg_score?: number;
  submission_count?: number;
  grade_name?: string;
  course_name?: string;
  is_published?: boolean;
  academic_year?: string;
};

type Submission = {
  id: string;
  student_id: number;
  student_name: string;
  attempt_number: number;
  status: string;
  score: number | null;
  max_score: number | null;
  feedback?: string | null;
  submitted_at?: string | null;
  is_retake?: boolean;
  grade?: string | null;
  section?: string | null;
  school_name?: string | null;
};

// Attempts grouped per student — the view key structure
type StudentRow = {
  student_id: number;
  student_name: string;
  grade: string | null;
  section: string | null;
  school_name: string | null;
  attempts: Submission[];
  best: Submission | null;   // highest-score graded attempt
  latest: Submission;        // most recent attempt
};

// Analytics payload types live with the extracted panel component.
type AnalyticsData = AssignmentAnalyticsData;

/* ─── tiny helpers ─── */
function StatusPill({ published }: { published?: boolean }) {
  return published ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
      Live
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />
      Draft
    </span>
  );
}

function Avatar({ name, color = "blue" }: { name: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700",
    indigo: "bg-indigo-100 text-indigo-700",
    green: "bg-emerald-100 text-emerald-700",
  };
  return (
    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${colors[color] ?? colors.blue}`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

/* ─── main page ─── */
export default function TeacherAssignmentsPage() {
  const { data: schools = [] } = useTeacherSchools();
  // Follow the active school chosen in the dashboard topbar so assignments,
  // analytics, and new-assignment defaults all stay scoped to one school.
  const { selectedSchool } = useTeacherSchool();
  const activeSchoolId = selectedSchool?.id;
  const [tab, setTab] = useState<"daily" | "course" | "requests" | "analytics">("daily");
  const [dailyAssignments, setDailyAssignments] = useState<TeacherAssignment[]>([]);
  const [courseAssignments, setCourseAssignments] = useState<TeacherAssignment[]>([]);
  const [pendingRetakeRequestCount, setPendingRetakeRequestCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string>("");
  const [detailTab, setDetailTab] = useState<"submissions" | "retake">("submissions");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [grading, setGrading] = useState<Record<string, { score: string; feedback: string }>>({});
  const [grantingStudentId, setGrantingStudentId] = useState<number | null>(null);
  const [grantSearch, setGrantSearch] = useState("");
  const [grantFilter, setGrantFilter] = useState<"all" | "graded" | "pending">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [builderAssignment, setBuilderAssignment] = useState<BuilderAssignment | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [subSearch, setSubSearch] = useState("");
  const [subFilter, setSubFilter] = useState<"all" | "graded" | "pending">("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [createPayload, setCreatePayload] = useState({
    dueDate: "",
    schoolId: "",
    subject: "",
    isPublished: false,
    academicYear: "2024-25",
    publishScope: "grade",
    gradeIds: [] as string[],
    sectionIds: [] as string[],
  });

  const assignments = tab === "daily" ? dailyAssignments : courseAssignments;
  const selectedAssignment = useMemo(
    () => assignments.find((a) => a.id === selectedId),
    [assignments, selectedId]
  );

  const filteredAssignments = useMemo(() => {
    if (!searchQuery.trim()) return assignments;
    const q = searchQuery.toLowerCase();
    return assignments.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.subject ?? "").toLowerCase().includes(q) ||
        (a.grade_name ?? "").toLowerCase().includes(q)
    );
  }, [assignments, searchQuery]);

  const gradedSubmissions = useMemo(() => submissions.filter((s) => s.status === "graded"), [submissions]);
  const pendingSubmissions = useMemo(() => submissions.filter((s) => s.status !== "graded"), [submissions]);

  // Group all submission rows by student, pick best and latest attempt.
  // "Best" honors the assignment's own retakeScoringRule ('highest' vs
  // 'latest') — same tie-break as the canonical StudentRankingService and
  // this page's own Analytics tab (getTeacherAssignmentAnalytics). This
  // table used to always pick the highest-scoring graded attempt regardless
  // of the rule, so a 'latest'-rule assignment where a retake scored lower
  // than an earlier attempt showed the wrong (higher, stale) score here
  // while the Analytics tab correctly showed the real latest score for the
  // identical student+assignment.
  const retakeRule = (selectedAssignment?.retake_rule ?? "latest").toLowerCase();
  const studentRows = useMemo((): StudentRow[] => {
    const map = new Map<number, StudentRow>();
    for (const s of submissions) {
      const row = map.get(s.student_id) ?? {
        student_id: s.student_id,
        student_name: s.student_name,
        grade: s.grade ?? null,
        section: s.section ?? null,
        school_name: s.school_name ?? null,
        attempts: [],
        best: null,
        latest: s,
      };
      row.attempts.push(s);
      // latest = highest attempt_number
      if (s.attempt_number >= row.latest.attempt_number) row.latest = s;
      if (s.status === "graded" && s.score != null) {
        if (retakeRule === "highest") {
          if (!row.best || (row.best.score ?? -1) < s.score) row.best = s;
        } else {
          // 'latest': the most recently attempted graded submission wins,
          // regardless of whether an earlier attempt scored higher.
          if (!row.best || s.attempt_number >= row.best.attempt_number) row.best = s;
        }
      }
      map.set(s.student_id, row);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.student_name.localeCompare(b.student_name)
    );
  }, [submissions, retakeRule]);

  const filteredStudentRows = useMemo(() => {
    let rows = studentRows;
    if (subFilter === "graded") rows = rows.filter((r) => r.best !== null);
    if (subFilter === "pending") rows = rows.filter((r) => r.best === null);
    if (subSearch.trim()) {
      const q = subSearch.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.student_name.toLowerCase().includes(q) ||
          (r.grade ?? "").toLowerCase().includes(q) ||
          (r.section ?? "").toLowerCase().includes(q) ||
          (r.school_name ?? "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [studentRows, subFilter, subSearch]);

  const filteredGrantRows = useMemo(() => {
    let rows = studentRows;
    if (grantFilter === "graded") rows = rows.filter((r) => r.best !== null);
    if (grantFilter === "pending") rows = rows.filter((r) => r.best === null);
    if (grantSearch.trim()) {
      const q = grantSearch.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.student_name.toLowerCase().includes(q) ||
          (r.grade ?? "").toLowerCase().includes(q) ||
          (r.section ?? "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [studentRows, grantFilter, grantSearch]);

  const statsBar = useMemo(() => {
    const total = assignments.length;
    const published = assignments.filter((a) => a.is_published).length;
    const totalSubs = assignments.reduce((acc, a) => acc + (a.submission_count ?? 0), 0);
    return { total, published, drafts: total - published, totalSubs };
  }, [assignments]);

  /* ─── data loaders ─── */
  const loadAssignments = useCallback(async (type: "DAILY" | "COURSE") => {
    try {
      const { data } = await teacherApi.assignments.list({ type, school_id: activeSchoolId });
      const list = (data as { assignments?: TeacherAssignment[] }).assignments ?? [];
      if (type === "DAILY") setDailyAssignments(list);
      else setCourseAssignments(list);
      setError(null);
    } catch {
      setError("Failed to load assignments");
    }
  }, [activeSchoolId]);

  const loadSubmissions = useCallback(async (assignmentId: string) => {
    if (!assignmentId) return;
    const { data } = await teacherApi.assignments.submissions(assignmentId);
    setSubmissions((data as { submissions?: Submission[] }).submissions ?? []);
  }, []);

  const loadClasses = useCallback(async (schoolId: string) => {
    if (!schoolId) return;
    try {
      const { data } = await teacherApi.classes.list(schoolId);
      setTeacherClasses((data as { classes?: TeacherClass[] }).classes ?? []);
    } catch { setTeacherClasses([]); }
  }, []);

  useEffect(() => { void loadAssignments("DAILY"); void loadAssignments("COURSE"); }, [loadAssignments]);

  // Pending-request badge on the tab itself — fetched independently of which
  // tab is active so it's visible before the teacher ever opens the tab.
  useEffect(() => {
    teacherApi.retakeRequests
      .list({ status: "pending" })
      .then(({ data }) => setPendingRetakeRequestCount(((data as { requests?: unknown[] })?.requests ?? []).length))
      .catch(() => setPendingRetakeRequestCount(0));
  }, [tab]);

  useEffect(() => {
    if (tab === "analytics" && !analyticsData) {
      setAnalyticsLoading(true);
      teacherApi.assignments.analytics({ school_id: activeSchoolId })
        .then(({ data }) => setAnalyticsData((data as { analytics?: AnalyticsData }).analytics ?? null))
        .catch(() => setAnalyticsData(null))
        .finally(() => setAnalyticsLoading(false));
    }
  }, [tab, analyticsData, activeSchoolId]);

  // When the active school changes, drop school-specific selections and cached
  // analytics so everything reloads scoped to the newly selected school.
  useEffect(() => {
    setSelectedId("");
    setSubmissions([]);
    setAnalyticsData(null);
  }, [activeSchoolId]);

  useEffect(() => { if (selectedId) void loadSubmissions(selectedId); else setSubmissions([]); }, [selectedId, loadSubmissions]);

  useEffect(() => { setSelectedId(""); setSubmissions([]); setSearchQuery(""); }, [tab]);

  useEffect(() => {
    const sid = createPayload.schoolId || activeSchoolId || (Array.isArray(schools) && schools.length > 0 ? String((schools[0] as { id?: string }).id ?? "") : "");
    if (sid) void loadClasses(sid);
  }, [createPayload.schoolId, activeSchoolId, schools, loadClasses]);

  /* ─── actions ─── */
  // The modal's own "School" field is independent of the header's "Active
  // School" switcher — left unseeded, a teacher who doesn't explicitly
  // re-pick a school can end up creating the assignment under whatever
  // school happened to be selected last (or the first in the list), not the
  // one they're actually looking at, and it then silently doesn't show up
  // in the (activeSchoolId-filtered) list. Seed it from the active school
  // every time the modal opens so the two stay in sync by default.
  const openCreateModal = () => {
    setCreatePayload((p) => ({ ...p, schoolId: activeSchoolId || p.schoolId }));
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const effectiveSchoolId = createPayload.schoolId || activeSchoolId || (Array.isArray(schools) && schools.length > 0 ? String((schools[0] as { id?: string }).id ?? "") : "");
      if (!effectiveSchoolId) { setError("No school found. Please contact admin."); return; }
      await teacherApi.assignments.create({
        title: builderAssignment?.title || "Daily Assignment",
        description: builderAssignment?.description || undefined,
        dueDate: createPayload.dueDate || undefined,
        schoolId: effectiveSchoolId,
        subject: createPayload.subject || undefined,
        totalMarks: builderAssignment?.max_score ? Number(builderAssignment.max_score) : undefined,
        questions: (builderAssignment?.questions ?? []).map((q) => ({
          question_type: q.question_type,
          question_text: q.question_text,
          options: q.options ?? [],
          correct_answer: q.correct_answer,
          marks: q.marks,
        })),
        isPublished: createPayload.isPublished,
        assignmentType: "DAILY",
        academicYear: createPayload.academicYear,
        publishScope: createPayload.publishScope,
        // Legacy singular field, kept in sync for backward-compatible
        // grade-name display when exactly one grade is targeted.
        gradeId:
          createPayload.publishScope === "grade" && createPayload.gradeIds.length === 1
            ? createPayload.gradeIds[0]
            : undefined,
        publishedGradeIds: createPayload.publishScope === "grade" ? createPayload.gradeIds : [],
        publishedSectionIds: createPayload.publishScope === "section" ? createPayload.sectionIds : [],
      });
      setCreatePayload({ dueDate: "", schoolId: "", subject: "", isPublished: false, academicYear: "2024-25", publishScope: "grade", gradeIds: [], sectionIds: [] });
      setBuilderAssignment(null);
      setShowCreateModal(false);
      await loadAssignments("DAILY");
      setError(null);
    } catch (e: unknown) {
      setError(typeof e === "object" && e !== null && "message" in e ? String((e as { message?: unknown }).message) : "Failed to create assignment");
    } finally { setLoading(false); }
  };

  const handleTogglePublish = async (a: TeacherAssignment) => {
    setLoading(true);
    try {
      await teacherApi.assignments.update(a.id, { isPublished: !a.is_published });
      await loadAssignments(tab === "daily" ? "DAILY" : "COURSE");
      setError(null);
    } catch { setError("Failed to update assignment"); }
    finally { setLoading(false); }
  };

  const handleGrade = async (submissionId: string) => {
    if (!selectedId) return;
    const payload = grading[submissionId] ?? { score: "", feedback: "" };
    setLoading(true);
    try {
      await teacherApi.assignments.grade(selectedId, submissionId, {
        score: payload.score ? Number(payload.score) : undefined,
        feedback: payload.feedback || undefined,
        status: "graded",
      });
      await loadSubmissions(selectedId);
      if (tab === "daily") await loadAssignments("DAILY"); else await loadAssignments("COURSE");
    } finally { setLoading(false); }
  };

  const handleOpenRetakeForAll = async () => {
    if (!selectedId) return;
    if (!(await confirmDialog({
      title: 'Open retake for all?',
      description: 'Open the retake window for all students who have already submitted.',
      confirmText: 'Open Retake',
    }))) return;
    setLoading(true);
    try {
      await teacherApi.assignments.openRetakeForAll(selectedId);
      await loadSubmissions(selectedId);
      setError(null);
    } catch { setError("Failed to open retake window"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (assignmentId: string) => {
    const target = assignments.find((a) => a.id === assignmentId);
    const submissionCount = target?.submission_count ?? 0;
    if (!(await confirmDialog({
      title: 'Delete this assignment?',
      description:
        submissionCount > 0
          ? `This will permanently delete ${submissionCount} existing student submission${submissionCount === 1 ? '' : 's'} (including any grades/feedback already given) along with the assignment. This action cannot be undone.`
          : 'This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
    }))) return;
    setLoading(true);
    try {
      await teacherApi.assignments.delete(assignmentId);
      if (selectedId === assignmentId) { setSelectedId(""); setSubmissions([]); }
      await loadAssignments("DAILY");
    } catch { setError("Failed to delete assignment"); }
    finally { setLoading(false); }
  };

  /* ══════════════════════════════════════
     RENDER
  ══════════════════════════════════════ */
  return (
    <div className="bg-[#f4f6f9]">

      {/* ── Top navigation bar ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="px-6 flex items-center gap-4 h-14">
          {/* Page title */}
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <ClipboardList className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 leading-none">Assignments</h1>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-none">Manage and grade</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 ml-2">
            {(["daily", "course", "requests", "analytics"] as const).map((t) => {
              const icons = { daily: ClipboardList, course: BookOpen, requests: RotateCcw, analytics: BarChart2 };
              const labels = {
                daily: `Daily${dailyAssignments.length ? ` (${dailyAssignments.length})` : ""}`,
                course: `Course${courseAssignments.length ? ` (${courseAssignments.length})` : ""}`,
                requests: `Retake Requests${pendingRetakeRequestCount ? ` (${pendingRetakeRequestCount})` : ""}`,
                analytics: "Analytics",
              };
              const Icon = icons[t];
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {labels[t]}
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-4">
            {/* Stats chips */}
            {tab !== "analytics" && tab !== "requests" && (
              <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                  {statsBar.published} live
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
                  {statsBar.drafts} draft{statsBar.drafts !== 1 ? "s" : ""}
                </span>
                <span className="text-gray-300">·</span>
                <span>{statsBar.totalSubs} submissions</span>
              </div>
            )}

            {/* New assignment button */}
            {tab === "daily" && (
              <button
                onClick={openCreateModal}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                New Assignment
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* ══ ANALYTICS TAB ══ */}
      {tab === "analytics" && (
        <div className="px-6 py-5 max-w-6xl mx-auto">
          <AssignmentAnalyticsPanel loading={analyticsLoading} data={analyticsData} />
        </div>
      )}

      {/* ══ RETAKE REQUESTS TAB ══ */}
      {tab === "requests" && (
        <div className="px-6 py-5 max-w-4xl mx-auto">
          <TeacherRetakeRequestsPanel />
        </div>
      )}

      {/* ══ DAILY / COURSE TABS ══ */}
      {tab !== "analytics" && tab !== "requests" && (
        <div className="flex h-[calc(100vh-56px)]">

          {/* ── Left sidebar: Assignment list ── */}
          <div className="w-80 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
            {/* Search */}
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Search ${tab} assignments…`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {filteredAssignments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
                  {tab === "daily" ? (
                    <ClipboardList className="h-10 w-10 text-gray-200 mb-3" />
                  ) : (
                    <BookOpen className="h-10 w-10 text-gray-200 mb-3" />
                  )}
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    {searchQuery ? "No matches found" : `No ${tab} assignments`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {searchQuery ? "Try a different search" : tab === "daily" ? "Create your first assignment" : "Course assignments are created by admins"}
                  </p>
                  {!searchQuery && tab === "daily" && (
                    <button
                      onClick={openCreateModal}
                      className="mt-4 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Plus className="h-3.5 w-3.5" /> New Assignment
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filteredAssignments.map((a) => {
                    const isSelected = a.id === selectedId;
                    const dueDate = a.due_date ? new Date(a.due_date) : null;
                    const isOverdue = dueDate ? dueDate < new Date() : false;

                    return (
                      <button
                        key={a.id}
                        onClick={() => { setSelectedId(a.id === selectedId ? "" : a.id); setDetailTab("submissions"); }}
                        className={`w-full text-left px-4 py-3.5 transition-all border-l-[3px] ${
                          isSelected
                            ? "bg-blue-600 border-l-blue-400 shadow-sm"
                            : "hover:bg-gray-50 border-l-transparent"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className={`text-sm font-semibold leading-snug truncate ${isSelected ? "text-white" : "text-gray-900"}`}>
                            {a.title}
                          </p>
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white/20 text-white px-2 py-0.5 rounded-full shrink-0">
                              <CheckCircle className="h-3 w-3" /> Viewing
                            </span>
                          ) : (
                            <StatusPill published={a.is_published} />
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {a.subject && (
                            <span className={`text-[11px] px-1.5 py-0.5 rounded ${isSelected ? "bg-white/15 text-blue-100" : "text-gray-500 bg-gray-100"}`}>
                              {a.subject}
                            </span>
                          )}
                          {a.grade_name && (
                            <span className={`text-[11px] ${isSelected ? "text-blue-200" : "text-gray-500"}`}>{a.grade_name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-[11px]">
                          <span className={`flex items-center gap-1 ${isSelected ? "text-blue-200" : "text-gray-400"}`}>
                            <Users className="h-3 w-3" />
                            {a.submission_count ?? 0}
                          </span>
                          {(a.avg_score ?? 0) > 0 && (
                            <span className={`font-medium flex items-center gap-1 ${isSelected ? "text-green-300" : "text-emerald-600"}`}>
                              <Star className="h-3 w-3" />
                              {a.avg_score?.toFixed(1)}%
                            </span>
                          )}
                          {dueDate && (
                            <span className={`flex items-center gap-1 ${isOverdue ? (isSelected ? "text-red-300" : "text-red-500") : isSelected ? "text-blue-200" : "text-gray-400"}`}>
                              <Clock className="h-3 w-3" />
                              {isOverdue ? "Overdue" : dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* List footer count */}
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
              <p className="text-[11px] text-gray-400">
                {filteredAssignments.length} of {assignments.length} assignment{assignments.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* ── Right: Detail panel ── */}
          <div className="flex-1 overflow-y-auto">
            {!selectedAssignment ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center mb-5">
                  <FileText className="h-9 w-9 text-gray-300" />
                </div>
                <h3 className="text-base font-semibold text-gray-600 mb-1.5">
                  Select an assignment
                </h3>
                <p className="text-sm text-gray-400 max-w-xs">
                  Choose an assignment from the list to view submissions, grade students, and manage retakes.
                </p>
                {tab === "daily" && (
                  <button
                    onClick={openCreateModal}
                    className="mt-6 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Create New Assignment
                  </button>
                )}
              </div>
            ) : (
              /* Assignment detail */
              <div className="p-6 max-w-4xl">

                {/* Detail header */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <StatusPill published={selectedAssignment.is_published} />
                        <span className="text-[11px] text-gray-400 capitalize">
                          {selectedAssignment.assignment_type?.toLowerCase() ?? tab} assignment
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-gray-900 leading-snug mb-1">
                        {selectedAssignment.title}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {selectedAssignment.subject ?? "General"}
                        {selectedAssignment.grade_name ? ` · ${selectedAssignment.grade_name}` : ""}
                        {selectedAssignment.total_marks ? ` · ${selectedAssignment.total_marks} marks` : ""}
                        {selectedAssignment.due_date ? ` · Due ${new Date(selectedAssignment.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => void handleTogglePublish(selectedAssignment)}
                        disabled={loading}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                          selectedAssignment.is_published
                            ? "border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100"
                            : "border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                        }`}
                      >
                        {selectedAssignment.is_published ? <><EyeOff className="h-3.5 w-3.5" /> Unpublish</> : <><Eye className="h-3.5 w-3.5" /> Publish</>}
                      </button>
                      {tab === "daily" && (
                        <button
                          onClick={() => void handleDelete(selectedAssignment.id)}
                          disabled={loading}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stat strip */}
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {[
                      { label: "Submissions", value: submissions.length, color: "bg-gray-50 text-gray-900" },
                      { label: "Graded", value: gradedSubmissions.length, color: "bg-emerald-50 text-emerald-700" },
                      { label: "Pending", value: pendingSubmissions.length, color: "bg-amber-50 text-amber-700" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className={`rounded-xl px-4 py-3 text-center ${color}`}>
                        <p className="text-2xl font-bold">{value}</p>
                        <p className="text-xs mt-0.5 opacity-70">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Detail tabs */}
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-4">
                  {([
                    { key: "submissions", label: "Submissions", icon: Users },
                    { key: "retake", label: "Retake Settings", icon: RotateCcw },
                  ] as const).map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setDetailTab(key)}
                      className={`flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-medium transition-colors ${
                        detailTab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* ── Submissions tab ── */}
                {detailTab === "submissions" && (
                  <div className="space-y-3">
                    {/* Controls bar */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <input
                          placeholder="Search student, grade, section…"
                          value={subSearch}
                          onChange={(e) => setSubSearch(e.target.value)}
                          className="w-full h-8 pl-8 pr-3 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        />
                      </div>
                      {(["all", "graded", "pending"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setSubFilter(f)}
                          className={`h-8 px-3 text-xs font-medium rounded-lg border transition-colors ${
                            subFilter === f
                              ? "bg-gray-900 text-white border-gray-900"
                              : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          {f.charAt(0).toUpperCase() + f.slice(1)}
                          <span className={`ml-1.5 ${subFilter === f ? "text-gray-400" : "text-gray-400"}`}>
                            {f === "all" ? studentRows.length : f === "graded" ? studentRows.filter(r => r.best).length : studentRows.filter(r => !r.best).length}
                          </span>
                        </button>
                      ))}
                      <span className="text-xs text-gray-400 ml-auto">
                        {submissions.length} total submission{submissions.length !== 1 ? "s" : ""}
                        {submissions.length !== studentRows.length && ` · ${studentRows.length} student${studentRows.length !== 1 ? "s" : ""}`}
                      </span>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      {studentRows.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                          <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                          <p className="text-sm font-medium text-gray-500">No submissions yet</p>
                          <p className="text-xs text-gray-400 mt-1">Students haven&apos;t submitted this assignment</p>
                        </div>
                      ) : filteredStudentRows.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                          <Search className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          <p className="text-sm">No students match your search</p>
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-100">
                              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-8" />
                              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Student</th>
                              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Grade</th>
                              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Section</th>
                              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">School</th>
                              <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Attempts</th>
                              <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Best Score</th>
                              <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {filteredStudentRows.map((row) => {
                              const isExpanded = expanded.has(row.student_id);
                              const best = row.best;
                              const latest = row.latest;
                              const pct = best && best.max_score ? Math.round((best.score! / best.max_score) * 100) : null;
                              const scoreColor = pct == null ? "" : pct >= 75 ? "text-emerald-700" : pct >= 50 ? "text-amber-600" : "text-red-600";

                              return [
                                /* ── Student summary row ── */
                                <tr
                                  key={`row-${row.student_id}`}
                                  className="hover:bg-gray-50/60 transition-colors cursor-pointer"
                                  onClick={() =>
                                    setExpanded((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(row.student_id)) next.delete(row.student_id);
                                      else next.add(row.student_id);
                                      return next;
                                    })
                                  }
                                >
                                  <td className="px-4 py-3.5 text-gray-400 text-xs select-none">
                                    {row.attempts.length > 1 ? (isExpanded ? "▾" : "▸") : ""}
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-2.5">
                                      <Avatar name={row.student_name} color={tab === "course" ? "indigo" : "blue"} />
                                      <span className="font-semibold text-gray-900 text-sm">{row.student_name}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3.5 hidden md:table-cell text-xs text-gray-500">{row.grade ?? "—"}</td>
                                  <td className="px-4 py-3.5 hidden md:table-cell text-xs text-gray-500">{row.section ?? "—"}</td>
                                  <td className="px-4 py-3.5 hidden lg:table-cell text-xs text-gray-500 max-w-[140px] truncate">{row.school_name ?? "—"}</td>
                                  <td className="px-4 py-3.5 text-center">
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600">
                                      {row.attempts.length > 1 && <RotateCcw className="h-3 w-3 text-amber-500" />}
                                      {row.attempts.length}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3.5 text-right">
                                    {best ? (
                                      <span className={`text-sm font-bold ${scoreColor}`}>
                                        {best.score}/{best.max_score}
                                        {pct != null && <span className="text-xs font-normal text-gray-400 ml-1">({pct}%)</span>}
                                      </span>
                                    ) : latest.status !== "graded" ? (
                                      <span className="text-xs text-gray-400">Pending</span>
                                    ) : (
                                      <span className="text-xs text-gray-400">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3.5 text-right">
                                    {best ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                                        <CheckCircle className="h-3 w-3" /> Graded
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                        <Clock className="h-3 w-3" /> Pending
                                      </span>
                                    )}
                                  </td>
                                </tr>,

                                /* ── Expanded: all attempts with grade controls ── */
                                ...(isExpanded
                                  ? [
                                      <tr key={`exp-${row.student_id}`} className="bg-gray-50/40">
                                        <td colSpan={8} className="px-6 pb-4 pt-2">
                                          <div className="border border-gray-100 rounded-xl overflow-hidden bg-white">
                                            <table className="w-full text-xs">
                                              <thead>
                                                <tr className="bg-gray-50 border-b border-gray-100">
                                                  <th className="px-3 py-2 text-left font-semibold text-gray-400 uppercase tracking-wide">Attempt</th>
                                                  <th className="px-3 py-2 text-left font-semibold text-gray-400 uppercase tracking-wide">Submitted</th>
                                                  <th className="px-3 py-2 text-center font-semibold text-gray-400 uppercase tracking-wide">Type</th>
                                                  <th className="px-3 py-2 text-right font-semibold text-gray-400 uppercase tracking-wide">Score</th>
                                                  <th className="px-3 py-2 text-left font-semibold text-gray-400 uppercase tracking-wide">Feedback</th>
                                                  <th className="px-3 py-2 font-semibold text-gray-400 uppercase tracking-wide">Action</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-gray-50">
                                                {row.attempts.map((att) => (
                                                  <tr key={att.id} className={att.id === best?.id ? "bg-emerald-50/40" : ""}>
                                                    <td className="px-3 py-2.5 font-medium text-gray-700">#{att.attempt_number}</td>
                                                    <td className="px-3 py-2.5 text-gray-500">
                                                      {att.submitted_at ? new Date(att.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center">
                                                      {att.is_retake ? (
                                                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                                          <RotateCcw className="h-2.5 w-2.5" /> Retake
                                                        </span>
                                                      ) : (
                                                        <span className="text-gray-400">Initial</span>
                                                      )}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-medium text-gray-700">
                                                      {att.status === "graded" ? `${att.score}/${att.max_score}` : "—"}
                                                      {att.id === best?.id && (
                                                        <span className="ml-1.5 text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">Best</span>
                                                      )}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-gray-500 max-w-[200px] truncate">{att.feedback ?? "—"}</td>
                                                    <td className="px-3 py-2.5">
                                                      {att.status !== "graded" && (
                                                        <div className="flex items-center gap-1.5">
                                                          <input
                                                            type="number"
                                                            placeholder="Score"
                                                            className="w-16 h-6 px-2 text-[11px] border border-gray-200 rounded outline-none focus:ring-1 focus:ring-blue-500"
                                                            value={grading[att.id]?.score ?? ""}
                                                            onChange={(e) => setGrading((prev) => ({ ...prev, [att.id]: { score: e.target.value, feedback: prev[att.id]?.feedback ?? "" } }))}
                                                          />
                                                          <input
                                                            type="text"
                                                            placeholder="Feedback"
                                                            className="w-28 h-6 px-2 text-[11px] border border-gray-200 rounded outline-none focus:ring-1 focus:ring-blue-500"
                                                            value={grading[att.id]?.feedback ?? ""}
                                                            onChange={(e) => setGrading((prev) => ({ ...prev, [att.id]: { score: prev[att.id]?.score ?? "", feedback: e.target.value } }))}
                                                          />
                                                          <button
                                                            onClick={() => void handleGrade(att.id)}
                                                            disabled={loading}
                                                            className="h-6 px-2.5 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors disabled:opacity-50"
                                                          >
                                                            Grade
                                                          </button>
                                                        </div>
                                                      )}
                                                      {att.status === "graded" && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                                                          <CheckCircle className="h-3 w-3" /> Graded
                                                        </span>
                                                      )}
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </td>
                                      </tr>,
                                    ]
                                  : []),
                              ];
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Retake tab ── */}
                {detailTab === "retake" && (
                  <div className="space-y-4">
                    {/* Open for all */}
                    <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="h-7 w-7 rounded-lg bg-purple-100 flex items-center justify-center">
                              <Zap className="h-3.5 w-3.5 text-purple-600" />
                            </div>
                            <h3 className="text-sm font-semibold text-gray-900">Open Retake for All</h3>
                          </div>
                          <p className="text-xs text-gray-500 ml-9">
                            Allow every student who has submitted to retake this assignment. Useful after reviewing class performance.
                          </p>
                        </div>
                        <button
                          onClick={() => void handleOpenRetakeForAll()}
                          disabled={loading}
                          className="flex items-center gap-1.5 shrink-0 text-xs font-semibold px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Open Window
                        </button>
                      </div>
                    </div>

                    {/* Grant to specific student — tabular */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      {/* Card header */}
                      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
                        <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                          <Users className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">Grant to Specific Student</h3>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Grant an individual retake to any student who has already submitted.
                          </p>
                        </div>
                      </div>

                      {studentRows.length === 0 ? (
                        <div className="px-5 py-10 text-center text-gray-400">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          <p className="text-xs">No submissions yet — students must submit before you can grant a retake.</p>
                        </div>
                      ) : (
                        <>
                        {/* Search + filter bar */}
                        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-50 bg-gray-50/40">
                          <div className="relative flex-1 min-w-[180px]">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <input
                              placeholder="Search by name, grade or section…"
                              value={grantSearch}
                              onChange={(e) => setGrantSearch(e.target.value)}
                              className="w-full h-8 pl-8 pr-3 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            {(["all", "graded", "pending"] as const).map((f) => (
                              <button
                                key={f}
                                onClick={() => setGrantFilter(f)}
                                className={`h-8 px-3 text-xs font-medium rounded-lg border transition-colors ${
                                  grantFilter === f
                                    ? "bg-gray-900 text-white border-gray-900"
                                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                                }`}
                              >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                                <span className="ml-1 text-gray-400">
                                  {f === "all" ? studentRows.length
                                    : f === "graded" ? studentRows.filter((r) => r.best).length
                                    : studentRows.filter((r) => !r.best).length}
                                </span>
                              </button>
                            ))}
                          </div>
                          {filteredGrantRows.length !== studentRows.length && (
                            <span className="text-xs text-gray-400 ml-auto">
                              {filteredGrantRows.length} of {studentRows.length} students
                            </span>
                          )}
                        </div>

                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50/60 border-b border-gray-100">
                              <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Student</th>
                              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Grade</th>
                              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Section</th>
                              <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Attempts</th>
                              <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Best Score</th>
                              <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {filteredGrantRows.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="px-5 py-10 text-center text-xs text-gray-400">
                                  No students match your search
                                </td>
                              </tr>
                            ) : null}
                            {filteredGrantRows.map((row) => {
                              const isGranting = grantingStudentId === row.student_id;
                              const pct = row.best && row.best.max_score
                                ? Math.round((row.best.score! / row.best.max_score) * 100)
                                : null;
                              const scoreColor = pct == null ? "text-gray-400" : pct >= 75 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600";

                              return (
                                <tr key={row.student_id} className="hover:bg-gray-50/40 transition-colors">
                                  {/* Student */}
                                  <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-2.5">
                                      <Avatar name={row.student_name} color="blue" />
                                      <span className="font-semibold text-gray-900 text-sm">{row.student_name}</span>
                                    </div>
                                  </td>

                                  {/* Grade */}
                                  <td className="px-4 py-3.5">
                                    {row.grade ? (
                                      <span className="inline-block bg-blue-50 text-blue-700 text-[11px] font-semibold px-2 py-0.5 rounded">
                                        Gr {row.grade}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-300">—</span>
                                    )}
                                  </td>

                                  {/* Section */}
                                  <td className="px-4 py-3.5">
                                    {row.section ? (
                                      <span className="inline-block bg-indigo-50 text-indigo-700 text-[11px] font-semibold px-2 py-0.5 rounded">
                                        Sec {row.section}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-300">—</span>
                                    )}
                                  </td>

                                  {/* Attempts */}
                                  <td className="px-4 py-3.5 text-center">
                                    <span className="text-xs font-medium text-gray-600 flex items-center justify-center gap-1">
                                      {row.attempts.length > 1 && <RotateCcw className="h-3 w-3 text-amber-500" />}
                                      {row.attempts.length}
                                    </span>
                                  </td>

                                  {/* Best score */}
                                  <td className="px-4 py-3.5 text-center">
                                    {row.best ? (
                                      <span className={`text-sm font-bold ${scoreColor}`}>
                                        {row.best.score}/{row.best.max_score}
                                        {pct != null && <span className="text-xs font-normal text-gray-400 ml-1">({pct}%)</span>}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-amber-600 font-medium">Pending</span>
                                    )}
                                  </td>

                                  {/* Grant button */}
                                  <td className="px-5 py-3.5 text-right">
                                    <button
                                      onClick={async () => {
                                        if (!selectedId) return;
                                        setGrantingStudentId(row.student_id);
                                        setLoading(true);
                                        try {
                                          await teacherApi.assignments.grantRetake(selectedId, {
                                            studentIds: [row.student_id],
                                            additionalAttempts: 1,
                                          });
                                          await loadSubmissions(selectedId);
                                          setError(null);
                                        } catch (e: unknown) {
                                          setError(
                                            typeof e === "object" && e !== null && "message" in e
                                              ? String((e as { message?: unknown }).message)
                                              : "Failed to grant retake"
                                          );
                                        } finally {
                                          setLoading(false);
                                          setGrantingStudentId(null);
                                        }
                                      }}
                                      disabled={loading}
                                      className="inline-flex items-center gap-1.5 h-8 px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                      {isGranting ? (
                                        <><RefreshCw className="h-3 w-3 animate-spin" /> Granting…</>
                                      ) : (
                                        <><RotateCcw className="h-3 w-3" /> Grant Retake</>
                                      )}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Create Assignment Modal ══ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />

          {/* Slide-in panel from right */}
          <div className="relative ml-auto w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">New Daily Assignment</h2>
                  <p className="text-xs text-gray-400">Fill in the details and build your questions</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Basic info */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Basic Info</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs font-medium text-gray-600">Subject</Label>
                    <Input
                      placeholder="e.g. Mathematics, Science…"
                      value={createPayload.subject}
                      onChange={(e) => setCreatePayload((p) => ({ ...p, subject: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-600">Due Date</Label>
                    <Input
                      type="date"
                      value={createPayload.dueDate}
                      onChange={(e) => setCreatePayload((p) => ({ ...p, dueDate: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-600">School</Label>
                    <Select value={createPayload.schoolId} onValueChange={(v) => setCreatePayload((p) => ({ ...p, schoolId: v }))}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select school" />
                      </SelectTrigger>
                      <SelectContent>
                        {(schools as Array<{ id?: string; name?: string }>).map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name ?? s.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Audience targeting */}
              <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-blue-500" />
                  <h3 className="text-xs font-semibold text-gray-700">Audience Targeting</h3>
                </div>
                <div className="space-y-1 mb-3">
                  <Label className="text-xs font-medium text-gray-600">Publish Scope</Label>
                  <Select
                    value={createPayload.publishScope}
                    onValueChange={(v) => setCreatePayload((p) => ({ ...p, publishScope: v, gradeIds: [], sectionIds: [] }))}
                  >
                    <SelectTrigger className="h-9 text-sm bg-white w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grade">
                        <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> All School / By Grade</span>
                      </SelectItem>
                      <SelectItem value="section">
                        <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> By Section</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">
                    {createPayload.publishScope === "section" ? "Target Sections" : "Target Grades"}
                  </Label>
                  <AssignmentAudiencePicker
                    classes={teacherClasses}
                    scope={createPayload.publishScope === "section" ? "section" : "grade"}
                    gradeIds={createPayload.gradeIds}
                    sectionIds={createPayload.sectionIds}
                    onChangeGradeIds={(ids) => setCreatePayload((p) => ({ ...p, gradeIds: ids }))}
                    onChangeSectionIds={(ids) => setCreatePayload((p) => ({ ...p, sectionIds: ids }))}
                  />
                </div>
              </div>

              {/* Assignment builder */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Questions</h3>
                <AssignmentBuilder
                  chapterId={createPayload.schoolId || "daily-school-assignment"}
                  chapterName="Daily Assignment"
                  assignment={builderAssignment}
                  onAssignmentChange={setBuilderAssignment}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between shrink-0">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={createPayload.isPublished}
                  onChange={(e) => setCreatePayload((p) => ({ ...p, isPublished: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-sm text-gray-700 font-medium">Publish immediately</span>
              </label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <button
                  onClick={() => void handleCreate()}
                  disabled={loading || !builderAssignment?.title}
                  className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {loading ? "Creating…" : "Create Assignment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
