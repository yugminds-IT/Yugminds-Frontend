"use client";

import { Fragment, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { BookOpen, GraduationCap, Play, Search } from "lucide-react";
import { studentApi } from "@/lib/api/student.api";
import MonthCalendar, { type ActivityDay } from "@/components/portal/MonthCalendar";
import DueRun, { type DueNode } from "@/components/portal/DueRun";
import AssignmentRow, { type AssignmentRowData, type RowState } from "@/components/student/assignments/AssignmentRow";

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
    graded_at: string | null;
    status: string;
  } | null;
  is_overdue: boolean;
  due_phase?: string;
  /** null when the assignment has no deadline. */
  days_until_due: number | null;
  chapter_title?: string | null;
  is_locked?: boolean;
  unlocks_in_days?: number | null;
  retake_available?: boolean;
  retake_granted?: boolean;
  exam_type?: string | null;
  exam_phase?: "upcoming" | "open" | "closed" | null;
  starts_at?: string | null;
  ends_at?: string | null;
  duration_minutes?: number | null;
}

type StatusFilter = "all" | "pending" | "submitted" | "graded" | "overdue";

const FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "To do" },
  { key: "submitted", label: "Handed in" },
  { key: "graded", label: "Graded" },
  { key: "overdue", label: "Overdue" },
];

const isGraded = (a: Assignment) =>
  a.status === "graded" || (a.submission?.grade !== null && a.submission?.grade !== undefined);
const isPending = (a: Assignment) =>
  (a.status === "not_started" || a.status === "in_progress") && !a.is_overdue;
const isLate = (a: Assignment) => a.is_overdue && !a.submission;

function stateOf(a: Assignment): RowState {
  if (isGraded(a)) return "graded";
  if (a.status === "submitted") return "submitted";
  if (isLate(a)) return "late";
  return "todo";
}

function toRow(a: Assignment): AssignmentRowData {
  // With a retake open, go to the overview that has the "try again" button.
  const href = a.submission && !a.retake_available
    ? `/lms/student/assignments/${a.id}/view`
    : `/lms/student/assignments/${a.id}`;
  return {
    id: a.id,
    title: a.title,
    sub: a.course_title || a.subject || undefined,
    href,
    state: stateOf(a),
    dueDate: a.due_date || undefined,
    duePhase: a.due_phase,
    daysUntilDue: a.days_until_due,
    handedIn: !!a.submission,
    marks: a.max_marks,
    score: a.submission?.grade ?? null,
    locked: a.is_locked,
    unlocksInDays: a.unlocks_in_days,
    retake: a.retake_available ? (a.retake_granted ? "granted" : "available") : null,
  };
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
    due_phase: raw.due_phase != null ? String(raw.due_phase) : undefined,
    days_until_due: raw.days_until_due != null ? Number(raw.days_until_due) : null,
    chapter_title: raw.chapter_title != null ? String(raw.chapter_title) : null,
    is_locked: Boolean(raw.is_locked ?? false),
    unlocks_in_days: raw.unlocks_in_days != null ? Number(raw.unlocks_in_days) : null,
    retake_available: Boolean(raw.retake_available ?? false),
    retake_granted: Boolean(raw.retake_granted ?? false),
    exam_type: raw.exam_type != null ? String(raw.exam_type) : null,
    exam_phase: (raw.exam_phase as Assignment["exam_phase"]) ?? null,
    starts_at: raw.starts_at != null ? String(raw.starts_at) : null,
    ends_at: raw.ends_at != null ? String(raw.ends_at) : null,
    duration_minutes: raw.duration_minutes != null ? Number(raw.duration_minutes) : null,
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
  const [activeTab, setActiveTab] = useState<"all" | "course" | "daily">("all");
  // Status filter is lifted here so the summary tiles + URL deep links can drive it.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  // Captured once on mount to avoid calling Date.now() during render (purity rule).
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    // Deep-link support: /assignments?filter=pending (e.g. from dashboard stat cards).
    // A linked filter should search everything, so switch to the All tab too.
    const f = new URLSearchParams(window.location.search).get("filter");
    if (f === "pending" || f === "submitted" || f === "graded" || f === "overdue") {
      setStatusFilter(f);
      setActiveTab("all");
    }
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

  // Calendar stats — last 4 weeks (nowMs set on mount to avoid Date.now() in render).
  // All three figures must actually be scoped to the window the "Last 4 weeks"
  // header promises — Pending/Graded used to silently fall back to summary's
  // all-time totals while only Submitted was date-filtered, so the panel
  // quietly stopped matching its own label as soon as any assignment activity
  // existed outside the last 4 weeks.
  const calendarStats = useMemo(() => {
    const cutoffMs = (nowMs ?? 0) - 28 * 24 * 60 * 60 * 1000;
    const submittedRecent = nowMs
      ? allAssignments.filter(a =>
          a.submission?.submitted_at &&
          new Date(a.submission.submitted_at).getTime() >= cutoffMs,
        ).length
      : 0;
    const gradedRecent = nowMs
      ? allAssignments.filter(a =>
          a.submission?.graded_at &&
          new Date(a.submission.graded_at).getTime() >= cutoffMs,
        ).length
      : 0;
    // "Pending" has no completion timestamp to filter by — scope it to
    // assignments that came due within the window and are still unsubmitted,
    // which is the closest meaningful reading of "recent pending work".
    const pendingRecent = nowMs
      ? allAssignments.filter(a =>
          (a.status === "not_started" || a.status === "in_progress") &&
          a.due_date &&
          new Date(a.due_date).getTime() >= cutoffMs,
        ).length
      : 0;
    return [
      { label: "Pending", value: pendingRecent },
      { label: "Submitted", value: submittedRecent },
      { label: "Graded", value: gradedRecent },
    ];
  }, [allAssignments, nowMs]);

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

  const filteredList = useMemo(() => {
    let list = visibleAssignments;
    if (statusFilter === "pending") list = list.filter(isPending);
    else if (statusFilter === "submitted") list = list.filter((a) => a.status === "submitted");
    else if (statusFilter === "graded") list = list.filter(isGraded);
    else if (statusFilter === "overdue") list = list.filter(isLate);
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
  }, [visibleAssignments, statusFilter, search]);

  const counts = useMemo(
    () => ({
      all: visibleAssignments.length,
      pending: visibleAssignments.filter(isPending).length,
      submitted: visibleAssignments.filter((a) => a.status === "submitted").length,
      graded: visibleAssignments.filter(isGraded).length,
      overdue: visibleAssignments.filter(isLate).length,
    }),
    [visibleAssignments],
  );

  // The runway: a "Late" node, then today and the six days after it.
  const runway = useMemo(() => {
    if (!nowMs) return null;
    const now = new Date(nowMs);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const counts = Array<number>(7).fill(0);
    let late = 0;
    allAssignments.forEach((a) => {
      if (a.is_locked || !a.due_date || a.submission) return;
      const d = new Date(a.due_date);
      const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - today) / 86400000);
      if (diff < 0) late += 1;
      else if (diff < 7) counts[diff] += 1;
    });
    const nodes: DueNode[] = [{ label: "Late", count: late, late: true }];
    counts.forEach((c, i) => {
      const day = new Date(today + i * 86400000).toLocaleDateString("en-IN", { weekday: "short" });
      nodes.push({ label: i === 0 ? "Today" : day, count: c, today: i === 0 });
    });
    return { nodes, late, today: counts[0], week: counts.reduce((s, c) => s + c, 0) };
  }, [allAssignments, nowMs]);

  // The one to do first: the oldest late one, otherwise the soonest.
  const nextUp = useMemo(() => {
    const open = allAssignments
      .filter((a) => !a.is_locked && !a.submission && (isLate(a) || isPending(a)))
      .sort((x, y) => {
        const lx = isLate(x) ? 0 : 1;
        const ly = isLate(y) ? 0 : 1;
        if (lx !== ly) return lx - ly;
        const tx = x.due_date ? new Date(x.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        const ty = y.due_date ? new Date(y.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        return tx - ty;
      });
    return open[0] ?? null;
  }, [allAssignments]);

  let status: React.ReactNode;
  if (!runway) status = "Checking your work…";
  else if (runway.late > 0)
    status = (
      <>
        You have <strong>{runway.late} overdue</strong>
        {runway.today > 0 ? <> and <strong>{runway.today} due today</strong></> : null}.
      </>
    );
  else if (runway.today > 0) status = <>You have <strong>{runway.today} due today</strong>.</>;
  else if (runway.week > 0) status = <><strong>{runway.week} due</strong> in the next 7 days.</>;
  else if (summary.pending > 0) status = "Nothing is due this week.";
  else status = "You are all caught up.";

  const ledger: Array<{ label: string; value: number; hint: string; filter: StatusFilter; hot?: boolean }> = [
    { label: "All", value: summary.total, hint: "Every assignment", filter: "all" },
    { label: "To do", value: summary.pending, hint: "Not handed in yet", filter: "pending" },
    { label: "Graded", value: summary.graded, hint: "Marked by your teacher", filter: "graded" },
    { label: "Overdue", value: summary.overdue, hint: summary.overdue > 0 ? "Hand these in first" : "None. Nice!", filter: "overdue", hot: summary.overdue > 0 },
  ];

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="as-title">
        <div className="sd-hero-copy">
          <h1 id="as-title" className="mc-hero-title">Assignments</h1>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            {nextUp ? (
              <Link href={`/lms/student/assignments/${nextUp.id}`} className="sd-btn sd-btn--amber">
                <Play aria-hidden="true" />Start {nextUp.title.length > 28 ? `${nextUp.title.slice(0, 26)}…` : nextUp.title}
              </Link>
            ) : null}
            <Link href="/lms/student/assignments/hierarchy" className="sd-btn sd-btn--ghost-dark">
              <BookOpen aria-hidden="true" />By course
            </Link>
            <Link href="/lms/student/exams" className="sd-btn sd-btn--ghost-dark">
              <GraduationCap aria-hidden="true" />Exams
            </Link>
          </div>
        </div>
        <div className="sd-run-card">
          {runway ? <DueRun nodes={runway.nodes} /> : <div className="sd-skel" style={{ height: "6rem" }} />}
          <div className="sd-run-foot">
            <b>{runway?.week ?? 0} due<small>in the next 7 days</small></b>
            <span>{runway?.late ? `${runway.late} late` : "Nothing late"}</span>
          </div>
        </div>
      </section>

      <nav className="sd-ledger" aria-label="Filter by status">
        {ledger.map((m) => (
          <button
            key={m.label}
            aria-pressed={statusFilter === m.filter}
            data-hot={m.hot ? "true" : undefined}
            onClick={() => { setStatusFilter(m.filter); setActiveTab("all"); }}
          >
            <span className="sd-l">{m.label}</span>
            <b className="sd-n">{m.value}</b>
            <small>{m.hint}</small>
          </button>
        ))}
      </nav>

      <div className="mc-cols">
        <div className="mc-main">
          <div className="as-bar">
            <div className="as-bar-top">
              <div className="mc-tabs" role="tablist" aria-label="Assignment type">
                {([
                  { id: "all", label: "All", count: allAssignments.length },
                  { id: "course", label: "Course", count: courseAssignments.length },
                  { id: "daily", label: "Daily", count: dailyAssignments.length },
                ] as const).map((t) => (
                  <button key={t.id} role="tab" className="mc-tab" aria-selected={activeTab === t.id} onClick={() => setActiveTab(t.id)}>
                    {t.label}
                    <b>{t.count}</b>
                  </button>
                ))}
              </div>
              <label className="sd-search" style={{ width: "min(100%, 16rem)" }}>
                <Search aria-hidden="true" />
                <input type="search" placeholder="Search assignments" aria-label="Search assignments" value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
            </div>
            <div className="as-chips" role="group" aria-label="Status">
              {FILTERS.map((f) => (
                <button key={f.key} className="as-chip" aria-pressed={statusFilter === f.key} onClick={() => setStatusFilter(f.key)}>
                  {f.label}<b>{counts[f.key]}</b>
                </button>
              ))}
            </div>
          </div>

          {summary.retakeable > 0 && (
            <div className="ls-note" role="status">
              <b>Waiting for a grade</b>
              <p>You handed in {summary.retakeable} assignment{summary.retakeable !== 1 ? "s" : ""}. Your teacher will mark {summary.retakeable !== 1 ? "them" : "it"} soon.</p>
            </div>
          )}

          {isLoading ? (
            <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
          ) : filteredList.length === 0 ? (
            <section className="sd-panel">
              <div className="sd-empty">
                <b>{search || statusFilter !== "all" ? "Nothing matches" : activeTab === "daily" ? "No daily assignments yet" : activeTab === "course" ? "No course assignments yet" : "No assignments yet"}</b>
                <p>{search || statusFilter !== "all" ? "Try another word or filter." : "When your teacher sets homework it will show up here."}</p>
                {(search || statusFilter !== "all") && (
                  <button className="sd-btn sd-btn--line" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Clear filters</button>
                )}
              </div>
            </section>
          ) : (
            <div key={`${activeTab}-${statusFilter}`} className="sd-panel as-list mc-swap">
              {filteredList.map((a, idx) => {
                const key = a.chapter_title ? `${a.course_title}|${a.chapter_title}` : null;
                const prev = filteredList[idx - 1];
                const prevKey = prev?.chapter_title ? `${prev.course_title}|${prev.chapter_title}` : null;
                return (
                  <Fragment key={a.id}>
                    {key && key !== prevKey && (
                      <p className="as-group">{a.chapter_title}{a.course_title && <span>{a.course_title}</span>}</p>
                    )}
                    <AssignmentRow a={toRow(a)} />
                  </Fragment>
                );
              })}
            </div>
          )}
        </div>

        <aside className="mc-aside">
          <MonthCalendar
            days={activityDays}
            stats={calendarStats}
            legend={{ amber: "Handed in", ink: "Due date" }}
            aria={{ amber: "handed in", ink: "something is due" }}
          />
        </aside>
      </div>
    </div>
  );
}
