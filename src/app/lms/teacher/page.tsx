"use client";

import { useState, useEffect, useMemo, useRef, Suspense, lazy } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarOff, FileText, Flag, RefreshCw } from "lucide-react";
import { useTeacherSchool } from "./context";
import {
  useTeacherClasses,
  useTeacherReports,
  useTeacherMonthlyAttendance,
  useTeacherLeaves,
  useTodaysClasses,
  useTodayAttendanceStatus,
  formatMonthLabel,
  currentMonthKey,
} from "@/hooks/useTeacherData";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { queryKeys } from "@/lib/query-keys";
import DayRun from "@/components/teacher/overview/DayRun";
import { buildDay, clock, firstNameOf, plural } from "@/components/teacher/overview/utils";
import type { Todo } from "@/components/teacher/TeacherOverviewTab";
import "@/components/school-admin/overview.css"; // shared with the school-admin overview: hero meta, to-do rows, class rows
import "@/components/teacher/overview/overview.css";

// Lazy load tab components
const TeacherOverviewTab = lazy(() => import("@/components/teacher/TeacherOverviewTab"));
const TeacherAttendanceTab = lazy(() => import("@/components/teacher/TeacherAttendanceTab"));
const TeacherReportsTab = lazy(() => import("@/components/teacher/TeacherReportsTab"));
const TeacherAnalyticsTab = lazy(() => import("@/components/teacher/TeacherAnalyticsTab"));

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "attendance", label: "Attendance" },
  { id: "reports", label: "Reports" },
  { id: "analytics", label: "Analytics" },
] as const;
type TabId = (typeof TABS)[number]["id"];

type TodayStatus = { attendance?: { status?: string | null } | null; notScheduledToday?: boolean; before_cutoff?: boolean };

type MonthRow = { total_days?: number; present_count: number; absent_count: number; leave_count: number; unreported_count: number };
const pctOf = (m: MonthRow) => {
  const total = m.total_days || m.present_count + m.absent_count + m.leave_count + m.unreported_count || 0;
  return total > 0 ? Math.round((m.present_count / total) * 100) : 0;
};

function TabSkeleton() {
  return <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>;
}

export default function TeacherDashboard() {
  const queryClient = useQueryClient();
  const { selectedSchool, schools, profileName } = useTeacherSchool();
  const [tab, setTab] = useState<TabId>("overview");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // null until mounted so server and first client render match (everything here depends on the clock)
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clock is client-only so SSR and first paint match
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Reports: fetch the full window (backend caps at 500). Counting "pending" among only the newest few undercounted the real number.
  const classesQ = useTeacherClasses(selectedSchool?.id);
  const todayQ = useTodaysClasses(selectedSchool?.id);
  const reportsQ = useTeacherReports(selectedSchool?.id, { limit: 500 });
  const attendanceQ = useTeacherMonthlyAttendance(selectedSchool?.id, 6);
  const leavesQ = useTeacherLeaves(selectedSchool?.id);
  const statusQ = useTodayAttendanceStatus(selectedSchool?.id);
  const classes = useMemo(() => (Array.isArray(classesQ.data) ? classesQ.data : []), [classesQ.data]);
  const reports = useMemo(() => (Array.isArray(reportsQ.data) ? reportsQ.data : []), [reportsQ.data]);
  const leaves = useMemo(() => (Array.isArray(leavesQ.data) ? leavesQ.data : []), [leavesQ.data]);
  const monthly = attendanceQ.data;
  const today = statusQ.data as TodayStatus | undefined;

  // Selected school undefined means "All schools": react-query's partial key matching still finds the aggregate-keyed queries.
  const loadDashboardData = async () => {
    const id = selectedSchool?.id;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["teacher", "classes", id] }),
      queryClient.invalidateQueries({ queryKey: ["teacher", "today-classes", id] }),
      queryClient.invalidateQueries({ queryKey: ["teacher", "reports", id] }),
      queryClient.invalidateQueries({ queryKey: ["teacher", "monthly-attendance", id] }),
      queryClient.invalidateQueries({ queryKey: ["teacher", "leaves", id] }),
      queryClient.invalidateQueries({ queryKey: ["teacher", "schedules", id] }),
      queryClient.invalidateQueries({ queryKey: ["teacher", "today-attendance", id] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.teacher.studentProgress }),
    ]);
  };

  const { isConnected } = useDashboardRealtime("teacher", {
    enabled: true,
    debugLabel: "teacher-dashboard",
    customEventMap: {
      "notification:new": [queryKeys.teacher.dashboard, queryKeys.teacher.studentProgress, queryKeys.teacher.schedules],
      "notification:read": [queryKeys.teacher.dashboard, queryKeys.teacher.studentProgress, queryKeys.teacher.schedules],
      "dashboard:stats": [queryKeys.teacher.dashboard, queryKeys.teacher.schedules],
    },
    onStats: () => {
      const id = selectedSchool?.id;
      for (const key of ["schedules", "classes", "today-classes", "reports", "monthly-attendance", "leaves"]) {
        queryClient.invalidateQueries({ queryKey: ["teacher", key, id] });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.teacher.studentProgress });
    },
  });

  useSmartRefresh({ customRefresh: loadDashboardData, minRefreshInterval: 60000 });

  const queries = [classesQ, todayQ, reportsQ, attendanceQ, leavesQ, statusQ];
  const isRefreshing = queries.some((q) => q.isFetching);
  const lastRefresh = Math.max(0, ...queries.map((q) => q.dataUpdatedAt || 0));
  const statsLoading = classesQ.isLoading || todayQ.isLoading || reportsQ.isLoading || attendanceQ.isLoading || leavesQ.isLoading;

  /* ───────── today ───────── */
  const nowDate = now == null ? null : new Date(now);
  const nowMin = nowDate ? nowDate.getHours() * 60 + nowDate.getMinutes() : 0;
  const dayName = nowDate ? nowDate.toLocaleDateString("en-IN", { weekday: "long" }) : "";
  const day = useMemo(() => buildDay(todayQ.data, nowMin), [todayQ.data, nowMin]);
  const unreported = useMemo(() => day.filter((r) => !r.reported), [day]);
  const reported = day.length - unreported.length;

  const dayCaption = (() => {
    const live = day.find((r) => r.phase === "live");
    const next = day.find((r) => r.phase === "upcoming");
    if (live) return `${live.subject} is on now`;
    if (next) return `Next: ${next.subject} at ${clock(next.from)}`;
    return unreported.length === 0 ? "All reports are in" : "The school day is over";
  })();

  const emptyDay = (() => {
    const s = today?.attendance?.status;
    if (s === "Holiday") return { title: "Today is a holiday", text: "No classes are held and no reports are due." };
    if (s === "Leave-Approved") return { title: "You are on leave today", text: "Your leave was approved, so no reports are due." };
    if (today?.notScheduledToday || s === "Not-Scheduled") return { title: "You are off today", text: "You are not scheduled to teach at this school today." };
    return { title: "No classes today", text: "Nothing is scheduled for you, so no reports are due." };
  })();

  /* ───────── what is waiting for the teacher ───────── */
  const flagged = reports.filter((r) => r.report_status === "Flagged").length;
  const pendingReports = reports.filter((r) => r.report_status === "Pending").length;
  const pendingLeaves = leaves.filter((l) => l.status === "Pending").length;
  const cutoffPassed = today?.before_cutoff === false;

  const todos = useMemo<Todo[]>(() => {
    const out: Todo[] = [];
    if (unreported.length > 0) {
      out.push({
        id: "unreported",
        href: unreported.length === 1 ? unreported[0].href : "/lms/teacher/reports",
        icon: FileText,
        title: `${plural(unreported.length, "class", "classes")} today without a report`,
        sub: cutoffPassed ? "The 8 PM cutoff has passed. Submit them anyway." : "Reports are due by 8 PM",
        count: unreported.length,
        tone: cutoffPassed ? "red" : undefined,
      });
    }
    if (flagged > 0) {
      out.push({
        id: "flagged",
        href: "/lms/teacher/reports",
        icon: Flag,
        title: `${plural(flagged, "report")} flagged by your admin`,
        sub: "Open them and fix what was flagged",
        count: flagged,
        tone: "red",
      });
    }
    if (pendingLeaves > 0) {
      out.push({
        id: "leaves",
        href: "/lms/teacher/leaves",
        icon: CalendarOff,
        title: `${plural(pendingLeaves, "leave request")} waiting`,
        sub: "Your admin has not answered yet",
        count: pendingLeaves,
      });
    }
    return out;
  }, [unreported, flagged, pendingLeaves, cutoffPassed]);

  /* ───────── attendance this month, and its six-month trend ───────── */
  // Only trust the entry whose month IS this month: the newest logged month may be an older one.
  const monthEntry = useMemo(() => {
    if (!Array.isArray(monthly)) return null;
    const key = currentMonthKey();
    return monthly.find((m) => String(m.month).slice(0, 7) === key) ?? null;
  }, [monthly]);

  const attendancePct = monthEntry ? pctOf(monthEntry) : 0;
  const trend = useMemo(() => (Array.isArray(monthly) ? [...monthly].reverse().map((m) => ({ label: formatMonthLabel(m.month), value: pctOf(m) })) : []), [monthly]);

  /* ───────── copy ───────── */
  const firstName = firstNameOf(profileName);
  const hour = nowDate?.getHours() ?? 12;
  const greeting = now == null ? "Hello" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  let status: React.ReactNode;
  if (todayQ.isError) status = "Your day did not load. Try refreshing.";
  else if (todayQ.isLoading || now == null) status = "Checking your day…";
  else if (day.length === 0) status = emptyDay.title + ". " + emptyDay.text;
  else if (unreported.length === 0) status = <><strong>All {day.length} {day.length === 1 ? "report is" : "reports are"} in.</strong> You are done for the day.</>;
  else status = <><strong>{reported} of {day.length}</strong> classes reported.{" "}{cutoffPassed ? "The 8 PM cutoff has passed, but please still submit." : "Reports are due by 8 PM."}</>;

  const primary = unreported.length > 0
    ? { href: unreported.length === 1 ? unreported[0].href : "/lms/teacher/reports", icon: FileText, label: `Submit ${plural(unreported.length, "report")}` }
    : flagged > 0
      ? { href: "/lms/teacher/reports", icon: Flag, label: `Fix ${plural(flagged, "flagged report")}` }
      : { href: "/lms/teacher/classes", icon: null, label: "Open my classes" };

  const ledger = [
    { label: "Classes today", value: String(day.length), hint: day.length === 0 ? "Nothing scheduled" : `${reported} reported so far`, href: "/lms/teacher/classes" },
    { label: "Reports in review", value: String(pendingReports), hint: pendingReports > 0 ? "Waiting for your admin" : "Nothing waiting", href: "/lms/teacher/reports" },
    { label: "Leave requests", value: String(pendingLeaves), hint: pendingLeaves > 0 ? "Waiting for approval" : "None waiting", href: "/lms/teacher/leaves" },
    {
      label: "Attendance this month",
      value: monthEntry ? `${attendancePct}%` : "–",
      hint: monthEntry ? formatMonthLabel(monthEntry.month, { month: "long", year: "numeric" }) : "No log for this month yet",
      href: "/lms/teacher/attendance",
    },
  ];

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const to = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : null;
    if (to == null) return;
    e.preventDefault();
    const next = TABS[(to + TABS.length) % TABS.length].id;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  if (now == null) {
    return <div className="sd-page"><div className="sd-skel" style={{ height: "22rem", borderRadius: "1.75rem" }} /></div>;
  }

  // Only genuinely blocked when the teacher has no schools at all: no selected school with schools present means "All schools".
  if (schools.length === 0) {
    return (
      <div className="sd-page">
        <section className="sd-panel">
          <div className="sd-empty">
            <b>No school assigned</b>
            <p>You are not assigned to any school yet. Ask your admin to add you to one.</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="to-title">
        <div className="sd-hero-copy">
          <h1 id="to-title" className="mc-hero-title">{selectedSchool?.name ?? "All your schools"}</h1>
          <p className="sd-where">{greeting}{firstName ? `, ${firstName}` : ""}</p>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            <Link href={primary.href} className="sd-btn sd-btn--amber">{primary.icon && <primary.icon aria-hidden="true" />}{primary.label}</Link>
            <Link href="/lms/teacher/leaves?apply=1" className="sd-btn sd-btn--ghost-dark"><CalendarOff aria-hidden="true" />Apply for leave</Link>
            <button className="so-refresh" style={{ alignSelf: "center" }} onClick={loadDashboardData} disabled={isRefreshing} aria-label={isRefreshing ? "Refreshing" : "Refresh"} title="Refresh">
              <RefreshCw className={isRefreshing ? "animate-spin" : ""} aria-hidden="true" />
            </button>
            <p className="so-live" style={{ alignSelf: "center", margin: 0 }} data-on={isConnected}>
              <i aria-hidden="true" />
              {isConnected ? "Live" : "Reconnecting…"}
              {lastRefresh > 0 && ` · updated ${new Date(lastRefresh).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
            </p>
          </div>
        </div>
        <DayRun rows={day} caption={dayCaption} loading={todayQ.isLoading} empty={emptyDay} />
      </section>

      <nav className="sd-ledger to-ledger" aria-label="Your numbers">
        {ledger.map((m, i) => (
          <Link key={m.label} href={m.href}>
            <span className="sd-l">{m.label}</span>
            {statsLoading ? <span className="sd-skel" style={{ height: "2.2rem", width: "4.5rem" }} /> : <b className="sd-n">{m.value}</b>}
            <small>{m.hint}</small>
            {i === 3 && !statsLoading && trend.length > 1 && (
              <span className="to-spark" aria-hidden="true" title="Attendance, last 6 months">
                {trend.map((t, k) => <i key={k} style={{ "--h": `${Math.max(t.value, 6)}%` } as React.CSSProperties} />)}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="to-tabs-row">
        <div className="mc-tabs" role="tablist" aria-label="Dashboard sections">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => { tabRefs.current[t.id] = el; }}
              role="tab"
              id={`to-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`to-panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className="mc-tab"
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" id={`to-panel-${tab}`} aria-labelledby={`to-tab-${tab}`} className="mc-swap" key={tab}>
        <Suspense fallback={<TabSkeleton />}>
          {tab === "overview" && (
            <TeacherOverviewTab
              day={day}
              dayName={dayName}
              dayLoading={todayQ.isLoading}
              todos={todos}
              todosLoading={todayQ.isLoading || reportsQ.isLoading || leavesQ.isLoading}
              classes={classes}
              classesLoading={classesQ.isLoading}
              reports={reports}
              reportsLoading={reportsQ.isLoading || leavesQ.isLoading}
              leaves={leaves}
              now={now}
            />
          )}
          {tab === "attendance" && <TeacherAttendanceTab />}
          {tab === "reports" && <TeacherReportsTab selectedSchoolId={selectedSchool?.id} />}
          {tab === "analytics" && <TeacherAnalyticsTab selectedSchoolId={selectedSchool?.id} />}
        </Suspense>
      </div>
    </div>
  );
}
