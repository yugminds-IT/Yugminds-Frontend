"use client";

import { useState, useEffect, useMemo } from "react";
import { studentApi } from "@/lib/api/student.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ActivityCalendar, { type ActivityDay } from "@/components/student/ActivityCalendar";
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  BookOpen,
  ClipboardList,
  Award,
  Search,
  Calendar,
  Zap,
  RotateCcw,
  Circle,
} from "lucide-react";
import Link from "next/link";

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  max_marks: number;
  course_title: string;
  subject: string;
  status: "not_started" | "in_progress" | "submitted" | "graded" | "overdue";
  submission?: {
    id: string;
    grade: number | null;
    feedback: string;
    submitted_at: string;
    status: string;
  } | null;
  is_overdue: boolean;
  days_until_due: number;
}

type StatusFilter = "all" | "pending" | "submitted" | "graded" | "overdue";

function getStatusConfig(a: Assignment) {
  const isGraded =
    a.status === "graded" ||
    (a.submission?.grade !== null && a.submission?.grade !== undefined);
  const isSubmitted = a.status === "submitted";
  const isOverdue = a.is_overdue && !a.submission;

  if (isGraded)
    return {
      label: "Graded",
      dotClass: "bg-emerald-500",
      badgeClass: "bg-emerald-100 text-emerald-700",
      rowClass: "",
      icon: CheckCircle,
    };
  if (isSubmitted)
    return {
      label: "Submitted",
      dotClass: "bg-blue-500",
      badgeClass: "bg-blue-100 text-blue-700",
      rowClass: "",
      icon: CheckCircle,
    };
  if (isOverdue)
    return {
      label: "Overdue",
      dotClass: "bg-red-500",
      badgeClass: "bg-red-100 text-red-700",
      rowClass: "bg-red-50/30",
      icon: AlertCircle,
    };
  return {
    label: "Pending",
    dotClass: "bg-amber-400",
    badgeClass: "bg-amber-100 text-amber-700",
    rowClass: "",
    icon: Circle,
  };
}

function DueDateChip({ a }: { a: Assignment }) {
  if (!a.due_date) return <span className="text-xs text-gray-400">—</span>;
  const isSubmitted = !!a.submission;
  // Once submitted/graded, show the static due date — no "overdue" or "Xd left" noise.
  if (isSubmitted)
    return (
      <span className="text-xs text-gray-400 flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        {new Date(a.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
      </span>
    );
  if (a.is_overdue)
    return (
      <span className="text-xs text-red-500 font-medium flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        {Math.abs(a.days_until_due)}d overdue
      </span>
    );
  if (a.days_until_due === 0)
    return (
      <span className="text-xs text-orange-600 font-medium flex items-center gap-1">
        <Zap className="h-3 w-3" />
        Due today
      </span>
    );
  if (a.days_until_due <= 3)
    return (
      <span className="text-xs text-orange-500 font-medium flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {a.days_until_due}d left
      </span>
    );
  return (
    <span className="text-xs text-gray-500 flex items-center gap-1">
      <Calendar className="h-3 w-3" />
      {new Date(a.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
    </span>
  );
}

function AssignmentTable({
  assignments,
  loading,
  type,
}: {
  assignments: Assignment[];
  loading: boolean;
  type: "course" | "daily";
}) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const counts = useMemo(
    () => ({
      all: assignments.length,
      pending: assignments.filter(
        (a) => (a.status === "not_started" || a.status === "in_progress") && !a.is_overdue,
      ).length,
      submitted: assignments.filter((a) => a.status === "submitted").length,
      graded: assignments.filter(
        (a) =>
          a.status === "graded" ||
          (a.submission?.grade !== null && a.submission?.grade !== undefined),
      ).length,
      overdue: assignments.filter((a) => a.is_overdue && !a.submission).length,
    }),
    [assignments],
  );

  const filtered = useMemo(() => {
    let list = assignments;
    if (filter === "pending")
      list = list.filter(
        (a) => (a.status === "not_started" || a.status === "in_progress") && !a.is_overdue,
      );
    else if (filter === "submitted") list = list.filter((a) => a.status === "submitted");
    else if (filter === "graded")
      list = list.filter(
        (a) =>
          a.status === "graded" ||
          (a.submission?.grade !== null && a.submission?.grade !== undefined),
      );
    else if (filter === "overdue") list = list.filter((a) => a.is_overdue && !a.submission);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.course_title ?? "").toLowerCase().includes(q) ||
          (a.subject ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [assignments, filter, search]);

  if (loading) {
    return (
      <div className="space-y-px">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controls row */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        {/* Filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {(["all", "pending", "submitted", "graded", "overdue"] as StatusFilter[]).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                filter === key
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
              <span className={`ml-1 ${filter === key ? "text-gray-300" : "text-gray-400"}`}>
                {counts[key]}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-8 text-xs bg-white border-gray-200"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-14 border border-dashed border-gray-200 rounded-xl bg-white text-gray-400">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-25" />
          <p className="text-sm">
            {search || filter !== "all"
              ? "No matching assignments"
              : type === "daily"
              ? "No daily assignments yet"
              : "No course assignments yet"}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {/* Table header */}
          <div className="grid grid-cols-[2rem_1fr_auto_auto_auto] sm:grid-cols-[2.5rem_1fr_6rem_5rem_5.5rem] items-center gap-2 sm:gap-4 px-4 py-2 border-b border-gray-100 bg-gray-50/80">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">#</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assignment</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:block">Due</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:block text-right">Marks</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Status</span>
          </div>

          {/* Rows */}
          {filtered.map((a, idx) => {
            const sc = getStatusConfig(a);
            const isGraded =
              a.status === "graded" ||
              (a.submission?.grade !== null && a.submission?.grade !== undefined);
            const href = a.submission
              ? `/lms/student/assignments/${a.id}/view`
              : `/lms/student/assignments/${a.id}`;
            const score = a.submission?.grade;

            return (
              <Link
                key={a.id}
                href={href}
                className={`grid grid-cols-[2rem_1fr_auto_auto_auto] sm:grid-cols-[2.5rem_1fr_6rem_5rem_5.5rem] items-center gap-2 sm:gap-4 px-4 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors group ${sc.rowClass}`}
              >
                <span className="text-xs font-medium text-gray-400 text-right">{idx + 1}</span>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${sc.dotClass}`} />
                    <p className="font-semibold text-sm text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                      {a.title}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate ml-3.5">
                    {a.course_title || a.subject || (type === "daily" ? "Daily" : "Course")}
                  </p>
                </div>

                <div className="hidden sm:block">
                  <DueDateChip a={a} />
                </div>

                <div className="hidden sm:block text-right">
                  {isGraded && score !== null && score !== undefined ? (
                    <span
                      className={`text-xs font-bold ${
                        Number(score) >= 70
                          ? "text-emerald-600"
                          : Number(score) >= 50
                          ? "text-amber-600"
                          : "text-red-500"
                      }`}
                    >
                      {typeof score === "number" ? score : parseFloat(String(score))}%
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">{a.max_marks} pts</span>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1.5">
                  <Badge className={`text-xs border-0 px-2 py-0.5 hidden sm:inline-flex ${sc.badgeClass}`}>
                    {sc.label}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function isValidDate(d: string | null | undefined): boolean {
  if (!d) return false;
  const dt = new Date(d);
  return !isNaN(dt.getTime()) && dt.getFullYear() > 1970;
}

function normalizeAssignment(raw: Record<string, unknown>): Assignment {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    due_date: isValidDate(raw.due_date as string) ? String(raw.due_date) : "",
    max_marks: Number(raw.max_marks ?? raw.total_marks ?? 0),
    course_title: String(raw.course_title ?? raw.course_name ?? raw.subject ?? ""),
    subject: String(raw.subject ?? ""),
    status: (raw.status ?? "not_started") as Assignment["status"],
    submission: (raw.submission as Assignment["submission"]) ?? null,
    is_overdue: Boolean(raw.is_overdue ?? false),
    days_until_due: Number(raw.days_until_due ?? 0),
  };
}

function toDateStr(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function StudentAssignmentsPage() {
  const [courseAssignments, setCourseAssignments] = useState<Assignment[]>([]);
  const [dailyAssignments, setDailyAssignments] = useState<Assignment[]>([]);
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [loadingDaily, setLoadingDaily] = useState(true);
  // Default to Daily — teacher-set homework is the most time-sensitive for school kids.
  const [activeTab, setActiveTab] = useState<"all" | "course" | "daily">("daily");
  // Captured once on mount to avoid calling Date.now() during render (purity rule).
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  useEffect(() => {
    void (async () => {
      setLoadingCourse(true);
      try {
        const { data } = await studentApi.assignments.list({ type: "COURSE" });
        const list = (data as { assignments?: unknown[] }).assignments ?? [];
        setCourseAssignments((list as Record<string, unknown>[]).map(normalizeAssignment));
      } catch {
        setCourseAssignments([]);
      } finally {
        setLoadingCourse(false);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      setLoadingDaily(true);
      try {
        const { data } = await studentApi.assignments.list({ type: "DAILY" });
        const list = (data as { assignments?: unknown[] }).assignments ?? [];
        setDailyAssignments((list as Record<string, unknown>[]).map(normalizeAssignment));
      } catch {
        setDailyAssignments([]);
      } finally {
        setLoadingDaily(false);
      }
    })();
  }, []);

  const allAssignments = useMemo(() => {
    const seen = new Set<string>();
    return [...courseAssignments, ...dailyAssignments].filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  }, [courseAssignments, dailyAssignments]);

  const summary = useMemo(() => {
    const all = allAssignments;
    return {
      total: all.length,
      pending: all.filter(
        (a) => (a.status === "not_started" || a.status === "in_progress") && !a.is_overdue,
      ).length,
      graded: all.filter(
        (a) =>
          a.status === "graded" ||
          (a.submission?.grade !== null && a.submission?.grade !== undefined),
      ).length,
      overdue: all.filter((a) => a.is_overdue && !a.submission).length,
      retakeable: all.filter((a) => a.submission && a.status !== "graded").length,
    };
  }, [allAssignments]);

  // Build calendar activity days from due dates and submission dates
  const activityDays: ActivityDay[] = useMemo(() => {
    const map = new Map<string, ActivityDay>();
    allAssignments.forEach(a => {
      if (a.due_date && isValidDate(a.due_date)) {
        const key = toDateStr(a.due_date);
        const existing = map.get(key) || { date: key };
        map.set(key, { ...existing, hasAssignment: true });
      }
      if (a.submission?.submitted_at && isValidDate(a.submission.submitted_at)) {
        const key = toDateStr(a.submission.submitted_at);
        const existing = map.get(key) || { date: key };
        map.set(key, { ...existing, hasLearning: true });
      }
    });
    return Array.from(map.values());
  }, [allAssignments]);

  // Calendar stats — last 4 weeks (nowMs set on mount to avoid Date.now() in render)
  const calendarStats = useMemo(() => {
    const cutoffMs = (nowMs ?? 0) - 28 * 24 * 60 * 60 * 1000;
    const submittedRecent = nowMs
      ? allAssignments.filter(a =>
          a.submission?.submitted_at &&
          new Date(a.submission.submitted_at).getTime() >= cutoffMs,
        ).length
      : 0;
    return [
      { label: "Pending", value: summary.pending },
      { label: "Submitted", value: submittedRecent },
      { label: "Graded", value: summary.graded },
    ];
  }, [allAssignments, summary, nowMs]);

  const visibleAssignments =
    activeTab === "course"
      ? courseAssignments
      : activeTab === "daily"
      ? dailyAssignments
      : allAssignments;
  // Each tab waits only on its own request; the "all" tab needs both.
  const isLoading =
    activeTab === "course"
      ? loadingCourse
      : activeTab === "daily"
      ? loadingDaily
      : loadingCourse || loadingDaily;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Assignments</h1>
            <p className="text-xs text-gray-500 mt-0.5">All your assignments in one place</p>
          </div>
          <Button variant="outline" size="sm" asChild className="text-xs">
            <Link href="/lms/student/assignments/hierarchy">
              <BookOpen className="h-3.5 w-3.5 mr-1.5" />
              By Course
            </Link>
          </Button>
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Two-column layout */}
        <div className="flex gap-6 items-start">
          {/* Left: assignment content */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Summary stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total", value: summary.total, icon: FileText, color: "text-gray-700 bg-gray-100", ring: "" },
                {
                  label: "Pending",
                  value: summary.pending,
                  icon: Clock,
                  color: "text-amber-700 bg-amber-100",
                  ring: summary.pending > 0 ? "ring-1 ring-amber-200" : "",
                },
                { label: "Graded", value: summary.graded, icon: Award, color: "text-emerald-700 bg-emerald-100", ring: "" },
                {
                  label: "Overdue",
                  value: summary.overdue,
                  icon: AlertCircle,
                  color: "text-red-700 bg-red-100",
                  ring: summary.overdue > 0 ? "ring-1 ring-red-200" : "",
                },
              ].map(({ label, value, icon: Icon, color, ring }) => (
                <div
                  key={label}
                  className={`bg-white border border-gray-200 rounded-xl p-3.5 flex items-center gap-3 shadow-sm ${ring}`}
                >
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-900 leading-none">{value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Retake notice */}
            {summary.retakeable > 0 && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                <RotateCcw className="h-4 w-4 shrink-0" />
                <span>
                  You have {summary.retakeable} submitted assignment
                  {summary.retakeable !== 1 ? "s" : ""} awaiting grading.
                </span>
              </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 w-fit shadow-sm">
              {(
                [
                  { id: "all", label: "All", icon: FileText, count: allAssignments.length },
                  { id: "course", label: "Course", icon: BookOpen, count: courseAssignments.length },
                  { id: "daily", label: "Daily", icon: ClipboardList, count: dailyAssignments.length },
                ] as const
              ).map(({ id, label, icon: Icon, count }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeTab === id ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  <span className={activeTab === id ? "text-blue-200" : "text-gray-400"}>{count}</span>
                </button>
              ))}
            </div>

            {/* Assignment table */}
            <AssignmentTable
              assignments={visibleAssignments}
              loading={isLoading}
              type={activeTab === "daily" ? "daily" : "course"}
            />
          </div>

          {/* Right: calendar sidebar */}
          <div className="w-72 shrink-0">
            <ActivityCalendar
              activityDays={activityDays}
              stats={calendarStats}
              legendLabels={{
                dot: 'Submitted',
                greenDot: 'Due date',
                line: 'Due & submitted',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
