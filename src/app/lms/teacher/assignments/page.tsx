"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { teacherApi } from "@/lib/api/teacher.api";
import { useTeacherSchools } from "@/hooks/useTeacherData";
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
import {
  BookOpen,
  ClipboardList,
  Users,
  RotateCcw,
  CheckCircle,
  Clock,
  Plus,
  Award,
  AlertCircle,
  BarChart2,
  TrendingUp,
  Trophy,
  Globe,
  GraduationCap,
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
};

type RetakeGrant = { studentId: number; additionalAttempts: number };
type GradeInfo = { id: string; name: string };

type AnalyticsSummary = {
  assignments_count: number;
  total_submissions: number;
  graded_count: number;
  avg_score: number;
  retake_count: number;
};

type AssignmentRow = {
  assignment_id: string;
  title: string;
  subject: string | null;
  assignment_type: string;
  retake_enabled: boolean;
  total_submissions: number;
  graded_count: number;
  retake_count: number;
  avg_score_percentage: number;
  highest_score: number;
  lowest_score: number;
};

type StudentRank = {
  rank: number;
  student_id: number;
  student_name: string;
  course_score: number;
  daily_score: number;
  overall_score: number;
};

type SubjectStat = { subject: string; avg_score: number; submissions: number };

type AnalyticsData = {
  summary: AnalyticsSummary;
  assignments: AssignmentRow[];
  top_students: StudentRank[];
  subject_breakdown: SubjectStat[];
};

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

function ScoreBar({ pct }: { pct: number }) {
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-600 w-10 text-right">{pct.toFixed(1)}%</span>
    </div>
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
  const [tab, setTab] = useState<"daily" | "course" | "analytics">("daily");
  const [dailyAssignments, setDailyAssignments] = useState<TeacherAssignment[]>([]);
  const [courseAssignments, setCourseAssignments] = useState<TeacherAssignment[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [detailTab, setDetailTab] = useState<"submissions" | "retake">("submissions");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [grading, setGrading] = useState<Record<string, { score: string; feedback: string }>>({});
  const [retakeGrant, setRetakeGrant] = useState<RetakeGrant>({ studentId: 0, additionalAttempts: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [builderAssignment, setBuilderAssignment] = useState<BuilderAssignment | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsSubTab, setAnalyticsSubTab] = useState<"leaderboard" | "assignments" | "subjects">("leaderboard");
  const [grades, setGrades] = useState<GradeInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [createPayload, setCreatePayload] = useState({
    dueDate: "",
    schoolId: "",
    subject: "",
    isPublished: false,
    academicYear: "2024-25",
    publishScope: "grade",
    gradeId: "",
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

  const statsBar = useMemo(() => {
    const total = assignments.length;
    const published = assignments.filter((a) => a.is_published).length;
    const totalSubs = assignments.reduce((acc, a) => acc + (a.submission_count ?? 0), 0);
    return { total, published, drafts: total - published, totalSubs };
  }, [assignments]);

  /* ─── data loaders ─── */
  const loadAssignments = useCallback(async (type: "DAILY" | "COURSE") => {
    try {
      const { data } = await teacherApi.assignments.list({ type });
      const list = (data as { assignments?: TeacherAssignment[] }).assignments ?? [];
      if (type === "DAILY") setDailyAssignments(list);
      else setCourseAssignments(list);
      setError(null);
    } catch {
      setError("Failed to load assignments");
    }
  }, []);

  const loadSubmissions = useCallback(async (assignmentId: string) => {
    if (!assignmentId) return;
    const { data } = await teacherApi.assignments.submissions(assignmentId);
    setSubmissions((data as { submissions?: Submission[] }).submissions ?? []);
  }, []);

  const loadGrades = useCallback(async (schoolId: string) => {
    if (!schoolId) return;
    try {
      const { data } = await teacherApi.classes.list(schoolId);
      const sections = (data as { sections?: Array<{ grade?: { id: string; name: string } }> }).sections ?? [];
      const seen = new Map<string, string>();
      sections.forEach((s) => { if (s.grade?.id && !seen.has(s.grade.id)) seen.set(s.grade.id, s.grade.name); });
      setGrades([...seen.entries()].map(([id, name]) => ({ id, name })));
    } catch { setGrades([]); }
  }, []);

  useEffect(() => { void loadAssignments("DAILY"); void loadAssignments("COURSE"); }, [loadAssignments]);

  useEffect(() => {
    if (tab === "analytics" && !analyticsData) {
      setAnalyticsLoading(true);
      teacherApi.assignments.analytics({})
        .then(({ data }) => setAnalyticsData((data as { analytics?: AnalyticsData }).analytics ?? null))
        .catch(() => setAnalyticsData(null))
        .finally(() => setAnalyticsLoading(false));
    }
  }, [tab, analyticsData]);

  useEffect(() => { if (selectedId) void loadSubmissions(selectedId); else setSubmissions([]); }, [selectedId, loadSubmissions]);

  useEffect(() => { setSelectedId(""); setSubmissions([]); setSearchQuery(""); }, [tab]);

  useEffect(() => {
    const sid = createPayload.schoolId || (Array.isArray(schools) && schools.length > 0 ? String((schools[0] as { id?: string }).id ?? "") : "");
    if (sid) void loadGrades(sid);
  }, [createPayload.schoolId, schools, loadGrades]);

  /* ─── actions ─── */
  const handleCreate = async () => {
    setLoading(true);
    try {
      const effectiveSchoolId = createPayload.schoolId || (Array.isArray(schools) && schools.length > 0 ? String((schools[0] as { id?: string }).id ?? "") : "");
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
        gradeId: createPayload.gradeId || undefined,
        publishedGradeIds: createPayload.gradeId && createPayload.publishScope === "grade" ? [createPayload.gradeId] : [],
      });
      setCreatePayload({ dueDate: "", schoolId: "", subject: "", isPublished: false, academicYear: "2024-25", publishScope: "grade", gradeId: "" });
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

  const handleGrantRetake = async () => {
    if (!selectedId || !retakeGrant.studentId) return;
    setLoading(true);
    try {
      await teacherApi.assignments.grantRetake(selectedId, { studentIds: [retakeGrant.studentId], additionalAttempts: retakeGrant.additionalAttempts });
      await loadSubmissions(selectedId);
      setError(null);
    } catch (e: unknown) {
      setError(typeof e === "object" && e !== null && "message" in e ? String((e as { message?: unknown }).message) : "Failed to grant retake");
    } finally { setLoading(false); }
  };

  const handleOpenRetakeForAll = async () => {
    if (!selectedId) return;
    if (!window.confirm("Open retake window for all students who have already submitted?")) return;
    setLoading(true);
    try {
      await teacherApi.assignments.openRetakeForAll(selectedId);
      await loadSubmissions(selectedId);
      setError(null);
    } catch { setError("Failed to open retake window"); }
    finally { setLoading(false); }
  };

  const handleDelete = async (assignmentId: string) => {
    if (!window.confirm("Delete this assignment? This cannot be undone.")) return;
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
    <div className="min-h-screen bg-[#f4f6f9]">

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
            {(["daily", "course", "analytics"] as const).map((t) => {
              const icons = { daily: ClipboardList, course: BookOpen, analytics: BarChart2 };
              const labels = {
                daily: `Daily${dailyAssignments.length ? ` (${dailyAssignments.length})` : ""}`,
                course: `Course${courseAssignments.length ? ` (${courseAssignments.length})` : ""}`,
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
            {tab !== "analytics" && (
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
                onClick={() => setShowCreateModal(true)}
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
          {analyticsLoading ? (
            <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : !analyticsData ? (
            <div className="text-center py-20 text-gray-400">
              <BarChart2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium text-gray-500">No analytics data yet</p>
              <p className="text-xs text-gray-400 mt-1">Data appears once assignments have submissions</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Total Assignments", value: analyticsData.summary.assignments_count, icon: ClipboardList, bg: "bg-blue-50", color: "text-blue-600", border: "border-blue-100" },
                  { label: "Submissions", value: analyticsData.summary.total_submissions, icon: Users, bg: "bg-violet-50", color: "text-violet-600", border: "border-violet-100" },
                  { label: "Graded", value: analyticsData.summary.graded_count, icon: CheckCircle, bg: "bg-emerald-50", color: "text-emerald-600", border: "border-emerald-100" },
                  { label: "Avg Score", value: `${(analyticsData.summary.avg_score ?? 0).toFixed(1)}%`, icon: Award, bg: "bg-amber-50", color: "text-amber-600", border: "border-amber-100" },
                ].map(({ label, value, icon: Icon, bg, color, border }) => (
                  <div key={label} className={`bg-white rounded-2xl border ${border} p-4 flex items-center gap-3 shadow-sm`}>
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${bg}`}>
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-gray-900">{value}</p>
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sub-tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                {([
                  { key: "leaderboard", label: "Leaderboard", icon: Trophy },
                  { key: "assignments", label: "Assignments", icon: ClipboardList },
                  { key: "subjects", label: "Subjects", icon: TrendingUp },
                ] as const).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setAnalyticsSubTab(key)}
                    className={`flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-medium transition-colors ${
                      analyticsSubTab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Leaderboard */}
              {analyticsSubTab === "leaderboard" && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">Student Rankings</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Overall = Course (60%) + Daily (40%)</p>
                    </div>
                    <Trophy className="h-4 w-4 text-amber-400" />
                  </div>
                  {(analyticsData.top_students ?? []).length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <Trophy className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No ranking data yet</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/60 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="py-3 px-5 text-left w-12">Rank</th>
                          <th className="py-3 px-4 text-left">Student</th>
                          <th className="py-3 px-4 text-right hidden sm:table-cell">Course</th>
                          <th className="py-3 px-4 text-right hidden sm:table-cell">Daily</th>
                          <th className="py-3 px-5 text-right">Overall</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {analyticsData.top_students.map((s, i) => (
                          <tr key={s.student_id} className={`hover:bg-gray-50/60 transition-colors ${i < 3 ? "bg-amber-50/20" : ""}`}>
                            <td className="py-3 px-5 text-center">
                              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (
                                <span className="text-xs font-semibold text-gray-400">#{i + 1}</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <Avatar name={s.student_name} color={i < 3 ? "green" : "blue"} />
                                <span className="font-semibold text-gray-900 text-sm">{s.student_name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right hidden sm:table-cell">
                              <span className="text-xs font-semibold text-indigo-600">{s.course_score.toFixed(1)}%</span>
                            </td>
                            <td className="py-3 px-4 text-right hidden sm:table-cell">
                              <span className="text-xs font-semibold text-blue-600">{s.daily_score.toFixed(1)}%</span>
                            </td>
                            <td className="py-3 px-5 text-right">
                              <span className={`text-sm font-bold ${s.overall_score >= 90 ? "text-amber-600" : s.overall_score >= 75 ? "text-emerald-600" : s.overall_score >= 60 ? "text-blue-600" : "text-gray-700"}`}>
                                {s.overall_score.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Assignments performance */}
              {analyticsSubTab === "assignments" && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900 text-sm">Assignment Performance</h3>
                  </div>
                  {(analyticsData.assignments ?? []).length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-10">No assignment data yet</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/60 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="py-3 px-5 text-left">Assignment</th>
                          <th className="py-3 px-4 text-center hidden sm:table-cell">Type</th>
                          <th className="py-3 px-4 text-right">Submissions</th>
                          <th className="py-3 px-4 text-right hidden lg:table-cell">Graded</th>
                          <th className="py-3 px-5 text-right">Avg Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {analyticsData.assignments.map((row) => (
                          <tr key={row.assignment_id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="py-3 px-5">
                              <p className="font-semibold text-gray-900 truncate max-w-52">{row.title}</p>
                              {row.subject && <p className="text-xs text-gray-400 mt-0.5">{row.subject}</p>}
                            </td>
                            <td className="py-3 px-4 text-center hidden sm:table-cell">
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${row.assignment_type === "COURSE" ? "bg-indigo-100 text-indigo-700" : "bg-blue-100 text-blue-700"}`}>
                                {row.assignment_type === "COURSE" ? "Course" : "Daily"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right text-sm text-gray-700 font-medium">{row.total_submissions}</td>
                            <td className="py-3 px-4 text-right text-xs text-gray-500 hidden lg:table-cell">{row.graded_count}</td>
                            <td className="py-3 px-5 text-right">
                              <span className={`text-sm font-bold ${row.avg_score_percentage >= 75 ? "text-emerald-600" : row.avg_score_percentage >= 50 ? "text-amber-600" : "text-red-500"}`}>
                                {row.avg_score_percentage.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Subject breakdown */}
              {analyticsSubTab === "subjects" && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900 text-sm">Subject Performance</h3>
                  </div>
                  <div className="p-5 space-y-4">
                    {(analyticsData.subject_breakdown ?? []).length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">No subject data yet</p>
                    ) : analyticsData.subject_breakdown.map((row) => (
                      <div key={row.subject}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-semibold text-gray-800">{row.subject}</span>
                          <span className="text-xs text-gray-400">{row.submissions} submissions</span>
                        </div>
                        <ScoreBar pct={row.avg_score} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ DAILY / COURSE TABS ══ */}
      {tab !== "analytics" && (
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
                      onClick={() => setShowCreateModal(true)}
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
                        className={`w-full text-left px-4 py-3.5 transition-colors ${
                          isSelected
                            ? "bg-blue-50 border-l-2 border-l-blue-500"
                            : "hover:bg-gray-50 border-l-2 border-l-transparent"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className={`text-sm font-semibold leading-snug truncate ${isSelected ? "text-blue-900" : "text-gray-900"}`}>
                            {a.title}
                          </p>
                          <StatusPill published={a.is_published} />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {a.subject && (
                            <span className="text-[11px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                              {a.subject}
                            </span>
                          )}
                          {a.grade_name && (
                            <span className="text-[11px] text-gray-500">{a.grade_name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-[11px]">
                          <span className="text-gray-400 flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {a.submission_count ?? 0}
                          </span>
                          {(a.avg_score ?? 0) > 0 && (
                            <span className="text-emerald-600 font-medium flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              {a.avg_score?.toFixed(1)}%
                            </span>
                          )}
                          {dueDate && (
                            <span className={`flex items-center gap-1 ${isOverdue ? "text-red-500" : "text-gray-400"}`}>
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
                    onClick={() => setShowCreateModal(true)}
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
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {submissions.length === 0 ? (
                      <div className="text-center py-16 text-gray-400">
                        <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium text-gray-500">No submissions yet</p>
                        <p className="text-xs text-gray-400 mt-1">Students haven&apos;t submitted this assignment</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {/* Header row */}
                        <div className="px-5 py-3 bg-gray-50/80 grid grid-cols-[1fr,auto,auto] gap-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                          <span>Student</span>
                          <span className="text-center">Attempt</span>
                          <span className="text-right">Score</span>
                        </div>

                        {submissions.map((sub) => (
                          <div key={sub.id} className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar name={sub.student_name} color={tab === "course" ? "indigo" : "blue"} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{sub.student_name}</p>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[11px] text-gray-400">#{sub.attempt_number}</span>
                                    {sub.status === "graded" ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                                        <CheckCircle className="h-3 w-3" />
                                        {sub.score ?? 0}/{sub.max_score ?? selectedAssignment.total_marks ?? "—"}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                                        <Clock className="h-3 w-3" />
                                        Pending
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {sub.status === "graded" && sub.feedback && (
                                  <p className="text-xs text-gray-400 mt-1 italic truncate">&ldquo;{sub.feedback}&rdquo;</p>
                                )}
                              </div>
                            </div>

                            {/* Grading inputs */}
                            {sub.status !== "graded" && (
                              <div className="flex items-center gap-2 mt-3 ml-11">
                                <input
                                  type="number"
                                  placeholder="Score"
                                  className="w-20 h-8 px-2.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  value={grading[sub.id]?.score ?? ""}
                                  onChange={(e) => setGrading((prev) => ({ ...prev, [sub.id]: { score: e.target.value, feedback: prev[sub.id]?.feedback ?? "" } }))}
                                />
                                <input
                                  type="text"
                                  placeholder="Feedback (optional)"
                                  className="flex-1 h-8 px-2.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  value={grading[sub.id]?.feedback ?? ""}
                                  onChange={(e) => setGrading((prev) => ({ ...prev, [sub.id]: { score: prev[sub.id]?.score ?? "", feedback: e.target.value } }))}
                                />
                                <button
                                  onClick={() => void handleGrade(sub.id)}
                                  disabled={loading}
                                  className="h-8 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                >
                                  Grade
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
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

                    {/* Grant individual */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Users className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">Grant to Specific Student</h3>
                      </div>
                      {submissions.length === 0 ? (
                        <p className="text-xs text-gray-400 ml-9">No submissions yet — students must submit before you can grant a retake.</p>
                      ) : (
                        <div className="flex items-center gap-2 ml-9">
                          <Select
                            value={retakeGrant.studentId ? String(retakeGrant.studentId) : ""}
                            onValueChange={(v) => setRetakeGrant((r) => ({ ...r, studentId: Number(v) }))}
                          >
                            <SelectTrigger className="flex-1 h-9 text-xs">
                              <SelectValue placeholder="Select a student" />
                            </SelectTrigger>
                            <SelectContent>
                              {submissions.map((s) => (
                                <SelectItem key={s.student_id} value={String(s.student_id)}>
                                  {s.student_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <button
                            onClick={() => void handleGrantRetake()}
                            disabled={loading || !retakeGrant.studentId}
                            className="h-9 px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                          >
                            Grant
                          </button>
                        </div>
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-600">Publish Scope</Label>
                    <Select value={createPayload.publishScope} onValueChange={(v) => setCreatePayload((p) => ({ ...p, publishScope: v, gradeId: "" }))}>
                      <SelectTrigger className="h-9 text-sm bg-white">
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
                    <Label className="text-xs font-medium text-gray-600">Target Grade</Label>
                    <Select value={createPayload.gradeId} onValueChange={(v) => setCreatePayload((p) => ({ ...p, gradeId: v }))}>
                      <SelectTrigger className="h-9 text-sm bg-white">
                        <SelectValue placeholder="All grades" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All grades</SelectItem>
                        {grades.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> Grade {g.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
