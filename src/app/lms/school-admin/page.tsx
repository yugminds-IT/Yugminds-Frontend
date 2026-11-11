"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ClipboardList, CalendarOff, KeyRound, RefreshCw, Send, type LucideIcon } from "lucide-react";
import { useSchoolAdmin } from "@/contexts/SchoolAdminContext";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { queryKeys } from "@/lib/query-keys";
import { WEEKDAY_NAMES } from "@/lib/weekday-utils";
import Droid from "@/components/portal/Droid";
import { initialsOf } from "@/components/portal/notifications";
import SchoolDayRun, { type DaySlot } from "@/components/school-admin/SchoolDayRun";
import "@/components/school-admin/overview.css";

interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  activeCourses: number;
  pendingReports: number;
  pendingLeaves: number;
  pendingEmergencyLeaves?: number;
  averageAttendance: number;
}

const DEFAULT_STATS: DashboardStats = {
  totalStudents: 0,
  totalTeachers: 0,
  activeCourses: 0,
  pendingReports: 0,
  pendingLeaves: 0,
  pendingEmergencyLeaves: 0,
  averageAttendance: 0,
};

interface RawStudent { id?: string; profile?: { full_name?: string; email?: string }; enrolled_at?: string; created_at?: string }
interface RawTeacher { id?: string; teacher_id?: string; teacher?: { full_name?: string; email?: string }; full_name?: string; email?: string; assigned_at?: string; created_at?: string }
interface RawReport { id?: string; teacher?: { full_name?: string }; topics_taught?: string; created_at?: string; date?: string }
interface RawCourse { id?: string; title?: string; created_at?: string; status?: string }
interface Period { id: string; period_number: number; start_time: string; end_time: string; is_active?: boolean }
interface Schedule {
  id: string;
  subject: string;
  grade: string;
  section?: string | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  teacher?: { full_name?: string };
  room?: { room_number?: string; room_name?: string };
  period?: { period_number: number; start_time: string; end_time: string };
}

/** "09:30" or "09:30:00" to minutes since midnight. */
const toMin = (t: string | undefined) => {
  const [h, m] = (t ?? "").split(":");
  const v = Number(h) * 60 + Number(m);
  return Number.isFinite(v) ? v : NaN;
};
/** 570 to "9:30 am" */
const clock = (min: number) => {
  const h = Math.floor(min / 60);
  const m = String(min % 60).padStart(2, "0");
  return `${h % 12 || 12}:${m} ${h < 12 ? "am" : "pm"}`;
};
const short = (t: string) => clock(toMin(t)).replace(" am", "").replace(" pm", "");

function ago(iso: string, now: number): string {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(mins)) return "";
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** "101" becomes "Room 101"; names like "Lab 2" are left as they are. */
const roomLabel = (r?: { room_number?: string; room_name?: string }) => {
  const v = (r?.room_name || r?.room_number || "").trim();
  return v && /^\d+$/.test(v) ? `Room ${v}` : v;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A small dashboard query that shares the school-admin preview cache and its refresh. */
function usePreview<T>(key: string, load: () => Promise<T>) {
  return useQuery({ queryKey: [...queryKeys.schoolAdmin.quickPreviews, key], queryFn: load });
}

type Todo = { id: string; href: string; icon: LucideIcon; title: string; sub?: string; hot?: boolean; count: number; tone?: "red" };

export default function SchoolAdminDashboard() {
  const queryClient = useQueryClient();
  const { schoolInfo, profileFullName } = useSchoolAdmin();
  // null until mounted so server and first client render match (times depend on the clock)
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clock is client-only so SSR and first paint match
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const statsQuery = useQuery<DashboardStats>({
    queryKey: queryKeys.schoolAdmin.dashboardStats,
    queryFn: async () => {
      const res = await schoolAdminApi.stats.get();
      const raw = (res.data as { stats?: Partial<DashboardStats> })?.stats ?? {};
      return {
        totalStudents: Number(raw.totalStudents ?? 0),
        totalTeachers: Number(raw.totalTeachers ?? 0),
        activeCourses: Number(raw.activeCourses ?? 0),
        pendingReports: Number(raw.pendingReports ?? 0),
        pendingLeaves: Number(raw.pendingLeaves ?? 0),
        pendingEmergencyLeaves: Number(raw.pendingEmergencyLeaves ?? 0),
        averageAttendance: Number(raw.averageAttendance ?? 0),
      };
    },
  });

  const studentsQuery = usePreview("students", async () => {
    const res = await schoolAdminApi.students.list({ limit: 3 });
    return ((res.data as { students?: RawStudent[] })?.students ?? []) as RawStudent[];
  });
  const teachersQuery = usePreview("teachers", async () => {
    const res = await schoolAdminApi.teachers.list({ limit: 3 });
    return ((res.data as { teachers?: RawTeacher[] })?.teachers ?? []) as RawTeacher[];
  });
  const reportsQuery = usePreview("reports", async () => {
    const res = await schoolAdminApi.reports.list({ limit: 3, pending: 1 });
    return ((res.data as { reports?: RawReport[] })?.reports ?? []) as RawReport[];
  });
  const coursesQuery = usePreview("courses", async () => {
    const res = await schoolAdminApi.courses.list({ status: "Published", limit: 3 });
    return ((res.data as { courses?: RawCourse[] })?.courses ?? []) as RawCourse[];
  });
  const periodsQuery = usePreview("periods", async () => {
    const res = await schoolAdminApi.periods.list();
    const d = res.data ?? {};
    return ((d as { periods?: Period[] }).periods ?? (Array.isArray(d) ? d : [])) as Period[];
  });
  const schedulesQuery = usePreview("schedules", async () => {
    const res = await schoolAdminApi.schedules.list();
    const d = res.data ?? {};
    return ((d as { schedules?: Schedule[] }).schedules ?? (Array.isArray(d) ? d : [])) as Schedule[];
  });
  const resetsQuery = usePreview("password-resets", async () => {
    const res = await schoolAdminApi.passwordResetRequests.pendingCount();
    return Number((res.data as { count?: number })?.count ?? 0);
  });

  const stats = statsQuery.data ?? DEFAULT_STATS;
  const statsLoading = statsQuery.isLoading;
  const pendingResets = resetsQuery.data ?? 0;
  const firstName = (profileFullName ?? "").trim().replace(/^(mr|mrs|ms|miss|dr|prof)\.?\s+/i, "").split(/\s+/)[0];

  const greeting = useMemo(() => {
    if (now == null) return "Hello";
    const h = new Date(now).getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }, [now]);

  /* ───────── what is waiting for the admin ───────── */
  const todos = useMemo<Todo[]>(() => {
    const out: Todo[] = [];
    const emergency = stats.pendingEmergencyLeaves ?? 0;
    if (stats.pendingLeaves > 0) {
      out.push({
        id: "leaves",
        href: "/lms/school-admin/teachers?tab=leaves",
        icon: CalendarOff,
        title: plural(stats.pendingLeaves, "leave request") + " to review",
        sub: emergency > 0 ? `${emergency} ${emergency === 1 ? "is" : "are"} marked emergency` : "From your teachers",
        hot: emergency > 0,
        count: stats.pendingLeaves,
        tone: emergency > 0 ? "red" : undefined,
      });
    }
    if (stats.pendingReports > 0) {
      const latest = (reportsQuery.data ?? [])[0];
      const who = latest?.teacher?.full_name;
      out.push({
        id: "reports",
        href: "/lms/school-admin/reports",
        icon: ClipboardList,
        title: plural(stats.pendingReports, "teacher report") + " to approve",
        sub: who ? `Latest from ${who}${latest?.topics_taught ? `: ${latest.topics_taught}` : ""}` : "Waiting for your approval",
        count: stats.pendingReports,
      });
    }
    if (pendingResets > 0) {
      out.push({
        id: "resets",
        href: "/lms/school-admin/password-reset-requests",
        icon: KeyRound,
        title: plural(pendingResets, "password reset request") + " waiting",
        sub: "Someone is locked out",
        count: pendingResets,
      });
    }
    return out;
  }, [stats.pendingLeaves, stats.pendingEmergencyLeaves, stats.pendingReports, pendingResets, reportsQuery.data]);

  const hasPeriods = (periodsQuery.data ?? []).length > 0;
  const totalWaiting = todos.reduce((n, t) => n + t.count, 0);
  const lead = todos.find((t) => t.hot) ?? todos[0];

  /* ───────── today's school day ───────── */
  const day = useMemo(() => {
    if (now == null) return null;
    const d = new Date(now);
    const dayName = WEEKDAY_NAMES[d.getDay()];
    const minutes = d.getHours() * 60 + d.getMinutes();
    const classes = (schedulesQuery.data ?? [])
      .filter((s) => s.is_active !== false && s.day_of_week === dayName)
      .map((s) => ({
        ...s,
        from: toMin(s.period?.start_time ?? s.start_time),
        to: toMin(s.period?.end_time ?? s.end_time),
      }))
      .filter((s) => Number.isFinite(s.from))
      .sort((a, b) => a.from - b.from);

    const periods = (periodsQuery.data ?? [])
      .filter((p) => p.is_active !== false && Number.isFinite(toMin(p.start_time)))
      .sort((a, b) => a.period_number - b.period_number);
    const slots: DaySlot[] = periods.map((p) => {
      const s = toMin(p.start_time);
      const e = toMin(p.end_time);
      return { n: p.period_number, label: short(p.start_time), state: minutes >= e ? "past" : minutes >= s ? "now" : "next" };
    });

    const stateOf = (from: number, to: number) => (minutes >= to ? "past" : minutes >= from ? "now" : "next");
    const rows = classes.map((c) => ({ ...c, state: stateOf(c.from, Number.isFinite(c.to) ? c.to : c.from + 40) }));

    let caption = "No classes are scheduled today";
    if (classes.length > 0 && slots.length > 0) {
      const cur = slots.find((s) => s.state === "now");
      const nextSlot = slots.find((s) => s.state === "next");
      if (cur) caption = `Period ${cur.n} is on now`;
      else if (nextSlot) caption = minutes < toMin(periods[0].start_time) ? `First bell at ${clock(toMin(periods[0].start_time))}` : `Period ${nextSlot.n} starts at ${nextSlot.label}`;
      else caption = "The school day is over";
    }
    return { slots, rows, caption, dayName };
  }, [now, schedulesQuery.data, periodsQuery.data]);

  /* ───────── recently joined ───────── */
  const joined = useMemo(() => {
    const items: { id: string; name: string; email: string; role: "student" | "teacher"; at: string }[] = [];
    (studentsQuery.data ?? []).forEach((s) => {
      const at = s.enrolled_at ?? s.created_at;
      if (at) items.push({ id: `s-${s.id}`, name: s.profile?.full_name || "Unnamed student", email: s.profile?.email || "", role: "student", at: String(at) });
    });
    (teachersQuery.data ?? []).forEach((t) => {
      const at = t.assigned_at ?? t.created_at;
      const p = t.teacher ?? t;
      if (at) items.push({ id: `t-${t.id ?? t.teacher_id}`, name: p?.full_name || "Unnamed teacher", email: p?.email || "", role: "teacher", at: String(at) });
    });
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 5);
  }, [studentsQuery.data, teachersQuery.data]);

  /* ───────── refresh + realtime (unchanged behaviour) ───────── */
  const queries = [statsQuery, studentsQuery, teachersQuery, reportsQuery, coursesQuery, periodsQuery, schedulesQuery, resetsQuery];
  const isRefreshing = queries.some((q) => q.isFetching);
  const lastRefresh = Math.max(0, ...queries.map((q) => q.dataUpdatedAt || 0));

  const refreshDashboard = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.schoolAdmin.dashboardStats }),
      queryClient.invalidateQueries({ queryKey: queryKeys.schoolAdmin.quickPreviews }),
      queryClient.invalidateQueries({ queryKey: queryKeys.schoolAdmin.studentProgress }),
      queryClient.invalidateQueries({ queryKey: queryKeys.schoolAdmin.notifications }),
    ]);
  }, [queryClient]);

  const { isConnected } = useDashboardRealtime("school_admin", {
    enabled: true,
    debugLabel: "school-admin-dashboard",
    customEventMap: {
      "notification:new": [
        queryKeys.schoolAdmin.dashboardStats,
        queryKeys.schoolAdmin.quickPreviews,
        queryKeys.schoolAdmin.recentActivity,
        queryKeys.schoolAdmin.studentProgress,
      ],
      "notification:read": [queryKeys.schoolAdmin.dashboardStats, queryKeys.schoolAdmin.notifications],
      "dashboard:stats": [
        queryKeys.schoolAdmin.dashboardStats,
        queryKeys.schoolAdmin.quickPreviews,
        queryKeys.schoolAdmin.studentProgress,
      ],
    },
    onStats: (payload) => {
      const current = queryClient.getQueryData<DashboardStats>(queryKeys.schoolAdmin.dashboardStats) ?? DEFAULT_STATS;
      queryClient.setQueryData(queryKeys.schoolAdmin.dashboardStats, {
        totalStudents: Number(payload.totalStudents ?? current.totalStudents),
        totalTeachers: Number(payload.totalTeachers ?? current.totalTeachers),
        activeCourses: Number(payload.activeCourses ?? current.activeCourses),
        pendingReports: Number(payload.pendingReports ?? current.pendingReports),
        pendingLeaves: Number(payload.pendingLeaves ?? current.pendingLeaves),
        pendingEmergencyLeaves: Number(payload.pendingEmergencyLeaves ?? current.pendingEmergencyLeaves ?? 0),
        averageAttendance: Number(payload.averageAttendance ?? current.averageAttendance),
      } as DashboardStats);
    },
  });

  useSmartRefresh({ customRefresh: refreshDashboard, minRefreshInterval: 60000 });

  /* ───────── copy ───────── */
  let status: React.ReactNode;
  if (statsQuery.isError) status = "Some numbers did not load. Try refreshing.";
  else if (statsLoading) status = "Checking your school…";
  else if (totalWaiting === 0) status = "Everything is up to date. Nothing is waiting for you.";
  else {
    const parts = todos.map((t) => `${t.count} ${t.id === "leaves" ? (t.count === 1 ? "leave request" : "leave requests") : t.id === "reports" ? (t.count === 1 ? "report" : "reports") : t.count === 1 ? "password reset" : "password resets"}`);
    status = <><strong>{plural(totalWaiting, "thing")}</strong> {totalWaiting === 1 ? "is" : "are"} waiting: {parts.join(", ")}.</>;
  }

  const ledger = [
    { label: "Students", value: stats.totalStudents, hint: "Active enrollments", href: "/lms/school-admin/students" },
    { label: "Teachers", value: stats.totalTeachers, hint: "Active teachers", href: "/lms/school-admin/teachers" },
    { label: "Courses", value: stats.activeCourses, hint: "Published for students", href: "/lms/school-admin/courses" },
    {
      label: "Teacher attendance",
      value: `${stats.averageAttendance}%`,
      hint: stats.averageAttendance >= 90 ? "Last 30 days, healthy" : stats.averageAttendance > 0 ? "Last 30 days, worth a look" : "No attendance recorded yet",
      href: "/lms/school-admin/reports",
    },
  ];

  const shownClasses = day?.rows.slice(0, 8) ?? [];
  const hiddenClasses = (day?.rows.length ?? 0) - shownClasses.length;

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="so-title">
        <div className="sd-hero-copy">
          <h1 id="so-title" className="mc-hero-title">{schoolInfo?.name ?? "Your school"}</h1>
          <p className="sd-where">{greeting}{firstName ? `, ${firstName}` : ""}</p>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            {lead ? (
              <Link href={lead.href} className="sd-btn sd-btn--amber">
                <lead.icon aria-hidden="true" />Review {lead.count} {lead.id === "leaves" ? (lead.count === 1 ? "leave request" : "leave requests") : lead.id === "reports" ? (lead.count === 1 ? "report" : "reports") : lead.count === 1 ? "reset request" : "reset requests"}
              </Link>
            ) : hasPeriods ? (
              <Link href="/lms/school-admin/schedules" className="sd-btn sd-btn--amber">Open the timetable</Link>
            ) : null}
            <Link href="/lms/school-admin/notifications" className={`sd-btn ${lead || hasPeriods ? "sd-btn--ghost-dark" : "sd-btn--amber"}`}><Send aria-hidden="true" />Message the school</Link>
            <button className="so-refresh" style={{ alignSelf: "center" }} onClick={refreshDashboard} disabled={isRefreshing} aria-label={isRefreshing ? "Refreshing" : "Refresh"} title="Refresh">
              <RefreshCw className={isRefreshing ? "animate-spin" : ""} aria-hidden="true" />
            </button>
            <p className="so-live" style={{ alignSelf: "center", margin: 0 }} data-on={isConnected}>
              <i aria-hidden="true" />
              {isConnected ? "Live" : "Reconnecting…"}
              {now != null && lastRefresh > 0 && ` · updated ${new Date(lastRefresh).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
            </p>
          </div>
        </div>
        <SchoolDayRun
          slots={day?.slots ?? []}
          classCount={day?.rows.length ?? 0}
          caption={day?.caption ?? ""}
          loading={now == null || periodsQuery.isLoading || schedulesQuery.isLoading}
        />
      </section>

      <nav className="sd-ledger" aria-label="School summary">
        {ledger.map((m) => (
          <Link key={m.label} href={m.href}>
            <span className="sd-l">{m.label}</span>
            {statsLoading ? <span className="sd-skel" style={{ height: "2.2rem", width: "4.5rem" }} /> : <b className="sd-n">{typeof m.value === "number" ? m.value.toLocaleString("en-IN") : m.value}</b>}
            <small>{m.hint}</small>
          </Link>
        ))}
      </nav>

      <div className="so-grid">
        <div className="so-col">
          <section className="sd-panel" aria-labelledby="so-todo">
            <div className="sd-panel-head"><div><h2 id="so-todo">Needs your attention</h2><p>Each one opens where you can deal with it.</p></div></div>
            {statsLoading ? (
              <><div className="sd-skel" /><div className="sd-skel" /></>
            ) : todos.length === 0 ? (
              <div className="so-clear">
                <span className="so-clear-droid"><Droid /></span>
                <div><b>You are all caught up</b><p>New reports, leave requests and password resets will show up here.</p></div>
              </div>
            ) : (
              <div>
                {todos.map((t) => (
                  <Link key={t.id} href={t.href} className="so-todo" data-tone={t.tone}>
                    <span className="so-todo-ico" aria-hidden="true"><t.icon /></span>
                    <span className="so-todo-text"><b>{t.title}</b>{t.sub && <small data-hot={t.hot}>{t.sub}</small>}</span>
                    <span className="so-count">{t.count}</span>
                    <ChevronRight aria-hidden="true" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="sd-panel as-list" aria-labelledby="so-today">
            <div className="sd-panel-head" style={{ margin: 0, padding: "1.25rem 1.25rem 0.9rem" }}>
              <div><h2 id="so-today">Today&apos;s classes</h2><p>{day ? `${day.dayName}, in time order` : " "}</p></div>
              <Link href="/lms/school-admin/schedules" className="sd-link">Timetable</Link>
            </div>
            {schedulesQuery.isLoading || now == null ? (
              <div style={{ padding: "0 1.25rem 1.25rem" }}><div className="sd-skel" /><div className="sd-skel" /></div>
            ) : shownClasses.length === 0 ? (
              <div className="sd-empty" style={{ padding: "0 1.25rem 1.25rem" }}>
                <b>No classes today</b>
                <p>{(schedulesQuery.data ?? []).length === 0 ? "Your timetable is empty. Add classes to see the day here." : "Nothing is scheduled for today."}</p>
                <Link href="/lms/school-admin/schedules" className="sd-btn sd-btn--line">Open the timetable</Link>
              </div>
            ) : (
              <>
                {shownClasses.map((c) => (
                  <div key={c.id} className="so-class" data-state={c.state}>
                    <span className="so-class-time">{clock(c.from)}{Number.isFinite(c.to) && <small>to {clock(c.to)}</small>}</span>
                    <span className="so-class-main">
                      <b>{c.subject}</b>
                      <small>
                        {c.grade}{c.section ? ` ${c.section}` : ""}
                        {c.teacher?.full_name ? ` · ${c.teacher.full_name}` : ""}
                        {roomLabel(c.room) ? ` · ${roomLabel(c.room)}` : ""}
                      </small>
                    </span>
                    {c.state === "now" && <span className="so-chip" data-now="true">On now</span>}
                  </div>
                ))}
                {hiddenClasses > 0 && (
                  <p className="so-more">and {plural(hiddenClasses, "more class", "more classes")}. <Link href="/lms/school-admin/schedules" className="sd-link">See all</Link></p>
                )}
              </>
            )}
          </section>
        </div>

        <div className="so-col">
          <section className="sd-panel" aria-labelledby="so-joined">
            <div className="sd-panel-head">
              <div><h2 id="so-joined">Recently joined</h2><p>New students and teachers</p></div>
              <div className="so-panel-links">
                <Link href="/lms/school-admin/students" className="sd-link">Students</Link>
                <Link href="/lms/school-admin/teachers" className="sd-link">Teachers</Link>
              </div>
            </div>
            {studentsQuery.isLoading || teachersQuery.isLoading ? (
              <><div className="sd-skel" /><div className="sd-skel" /></>
            ) : joined.length === 0 ? (
              <div className="sd-empty"><b>Nobody new yet</b><p>New enrollments and teacher assignments will appear here.</p></div>
            ) : (
              <div>
                {joined.map((p) => (
                  <div key={p.id} className="so-row">
                    <span className="sd-avatar" aria-hidden="true">{initialsOf(p.name)}</span>
                    <span className="so-row-text"><b>{p.name}</b><small>{p.email || (p.role === "student" ? "Student" : "Teacher")}</small></span>
                    <span className="so-chip">{p.role}</span>
                    <time dateTime={p.at}>{now != null ? ago(p.at, now) : ""}</time>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="sd-panel" aria-labelledby="so-courses">
            <div className="sd-panel-head">
              <div><h2 id="so-courses">Courses</h2><p>Latest published for your school</p></div>
              <Link href="/lms/school-admin/courses" className="sd-link">All courses</Link>
            </div>
            {coursesQuery.isLoading ? (
              <><div className="sd-skel" /><div className="sd-skel" /></>
            ) : (coursesQuery.data ?? []).length === 0 ? (
              <div className="sd-empty"><b>No published courses</b><p>Courses your school can teach will show up here.</p></div>
            ) : (
              <div>
                {(coursesQuery.data ?? []).map((c) => (
                  <div key={c.id} className="so-row">
                    <span className="so-row-text"><b>{c.title}</b>{c.created_at && now != null && <small>Added {ago(c.created_at, now).toLowerCase()}</small>}</span>
                    {c.status && <span className="so-chip">{c.status}</span>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
