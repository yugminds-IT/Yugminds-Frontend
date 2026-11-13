"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Bell, Clock, Play } from "lucide-react";
import { frontendLogger } from "@/lib/frontend-logger";
import WeekRun, { type WeekDay } from "@/components/student/WeekRun";
import {
  useStudentProfile,
  useStudentDashboardStats,
  useStudentCourses,
  useStudentAssignments,
  useStudentDailyAssignments,
  useStudentNotifications,
  useStudentLastViewed,
  useStudentActivity,
  useStudentRankings,
} from "@/hooks/useStudentData";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { queryKeys } from "@/lib/query-keys";

interface Assignment {
  id?: string;
  title?: string;
  course_title?: string;
  subject?: string;
  assignment_type?: string;
  due_date?: string;
  status?: string;
  is_overdue?: boolean;
  due_phase?: string;
  days_until_due?: number | null;
  is_locked?: boolean;
  submission?: {
    grade?: number | string | null;
    submitted_at?: string;
    status?: string;
  } | null;
}

interface Course {
  id?: string;
  title?: string;
  name?: string;
  grade?: string;
  subject?: string;
  progress_percentage?: number;
  average_grade?: number | null;
}

const WEEKLY_GOAL_DAYS = 5;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function dueLabel(days: number | null | undefined) {
  if (days == null) return "No due date";
  if (days < 0) return `${plural(Math.abs(days), "day")} overdue`;
  if (days === 0) return "Due today";
  return `Due in ${plural(days, "day")}`;
}

export default function StudentDashboard() {
  const router = useRouter();
  const [greeting, setGreeting] = useState("Hello");
  const [isMounted, setIsMounted] = useState(false);

  const { data: profile } = useStudentProfile();
  const { data: stats } = useStudentDashboardStats();
  const { data: courses, isLoading: coursesLoading } = useStudentCourses();
  const { data: assignments, isLoading: assignmentsLoading } = useStudentAssignments();
  const { data: dailyAssignments, isLoading: dailyLoading } = useStudentDailyAssignments();
  const { data: lastViewed } = useStudentLastViewed();

  // Non-critical data (notifications) loads after the first paint.
  const [shouldLoadNonCritical, setShouldLoadNonCritical] = useState(false);
  useEffect(() => {
    if (isMounted && !shouldLoadNonCritical) {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        requestIdleCallback(() => setShouldLoadNonCritical(true), { timeout: 500 });
      } else {
        setTimeout(() => setShouldLoadNonCritical(true), 200);
      }
    }
  }, [isMounted, shouldLoadNonCritical]);

  const { data: notifications, isLoading: notificationsLoading } = useStudentNotifications();
  const { data: activity } = useStudentActivity();
  const { data: rankInfo } = useStudentRankings();
  useDashboardRealtime("student", {
    enabled: true,
    debugLabel: "student-dashboard",
    customEventMap: {
      "notification:new": [queryKeys.student.notifications, queryKeys.student.dashboardStats],
      "notification:read": [queryKeys.student.notifications, queryKeys.student.dashboardStats],
      "dashboard:stats": [queryKeys.student.dashboardStats, queryKeys.student.courses, queryKeys.student.assignments],
    },
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    frontendLogger.debug("Student dashboard mounted", { component: "StudentDashboard" });
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  useEffect(() => {
    const p = profile as { force_password_change?: boolean } | null | undefined;
    if (p?.force_password_change) router.push("/lms/student/settings?force_change=true");
  }, [profile, router]);

  useSmartRefresh({
    queryKeys: [["studentProfile"], ["studentDashboardStats"], ["studentCourses"], ["studentAssignments"], ["studentNotifications"]],
    minRefreshInterval: 60000,
  });

  // Pending daily + course assignments, grouped by urgency: Overdue, Due today, This week, Later.
  const pendingGroups = useMemo(() => {
    const course = Array.isArray(assignments) ? (assignments as Assignment[]) : [];
    const daily = Array.isArray(dailyAssignments) ? (dailyAssignments as Assignment[]) : [];
    const seen = new Set<string>();
    const pending = [...course, ...daily]
      .filter((a) => {
        if (!a.id || seen.has(a.id) || a.is_locked || a.due_phase === "closed") return false;
        seen.add(a.id);
        return a.status === "not_started" || a.status === "pending" || a.status == null;
      })
      .sort((a, b) => {
        const da = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        return da - db;
      })
      .slice(0, 6);

    const groups: Array<{ key: string; label: string; items: Assignment[] }> = [
      { key: "overdue", label: "Overdue", items: [] },
      { key: "today", label: "Due today", items: [] },
      { key: "week", label: "This week", items: [] },
      { key: "later", label: "Later", items: [] },
    ];
    pending.forEach((a) => {
      const d = a.days_until_due;
      if (a.is_overdue || (d != null && d < 0)) groups[0].items.push(a);
      else if (d === 0) groups[1].items.push(a);
      else if (d != null && d <= 7) groups[2].items.push(a);
      else groups[3].items.push(a);
    });
    return { groups: groups.filter((g) => g.items.length > 0), total: pending.length, overdue: groups[0].items.length, today: groups[1].items.length, first: pending[0] };
  }, [assignments, dailyAssignments]);

  const recentlyGraded = useMemo(() => {
    const course = Array.isArray(assignments) ? (assignments as Assignment[]) : [];
    const daily = Array.isArray(dailyAssignments) ? (dailyAssignments as Assignment[]) : [];
    const seen = new Set<string>();
    return [...course, ...daily]
      .filter((a) => {
        if (!a.id || seen.has(a.id)) return false;
        seen.add(a.id);
        return a.submission?.grade !== null && a.submission?.grade !== undefined;
      })
      .sort((a, b) => {
        const ta = a.submission?.submitted_at ? new Date(a.submission.submitted_at).getTime() : 0;
        const tb = b.submission?.submitted_at ? new Date(b.submission.submitted_at).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 3);
  }, [assignments, dailyAssignments]);

  const recentNotifications = useMemo(
    () =>
      ((notifications as Array<{ id?: string; title?: string; message?: string; created_at?: string; is_read?: boolean }> | undefined) || [])
        .filter((n) => !n.is_read)
        .slice(0, 4),
    [notifications],
  );

  const courseList = useMemo(() => (courses as Course[] | undefined) || [], [courses]);
  const activeCourses = useMemo(() => courseList.filter((c) => (c.progress_percentage || 0) < 100).slice(0, 3), [courseList]);

  const performance = useMemo(() => {
    const avgProgress = courseList.length > 0 ? courseList.reduce((acc, c) => acc + (c.progress_percentage || 0), 0) / courseList.length : 0;
    const graded = courseList.filter((c) => c.average_grade != null);
    const avgGrade = graded.length > 0 ? graded.reduce((sum, c) => sum + (c.average_grade ?? 0), 0) / graded.length : 0;
    return { avgProgress, avgGrade };
  }, [courseList]);

  // This week, Monday to Sunday, and the last 28 days, both marked from the same activity feed.
  const { weekDays, weekCount, month, monthCount } = useMemo(() => {
    const none = { weekDays: [] as WeekDay[], weekCount: 0, month: [] as Array<{ on: boolean; today: boolean }>, monthCount: 0 };
    if (!isMounted) return none;
    const activeKeys = new Set((activity?.activityDays ?? []).filter((d) => d.hasLearning || d.hasAssignment).map((d) => d.date));
    const now = new Date();
    const todayKey = dayKey(now);
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const weekDays = DAY_LABELS.map((label, i) => {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const k = dayKey(d);
      return { label, active: activeKeys.has(k), today: k === todayKey, future: k > todayKey };
    });
    const month = Array.from({ length: 28 }, (_, i) => {
      const k = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (27 - i)));
      return { on: activeKeys.has(k), today: k === todayKey };
    });
    return { weekDays, weekCount: weekDays.filter((d) => d.active).length, month, monthCount: month.filter((m) => m.on).length };
  }, [activity, isMounted]);

  if (!isMounted) {
    return (
      <div className="sd-page">
        <div className="sd-skel" style={{ height: "18rem" }} />
        <div className="sd-skel" style={{ height: "6rem" }} />
      </div>
    );
  }

  const studentStats = stats as {
    activeCourses?: number;
    pendingAssignments?: number;
    completedCourses?: number;
    completedAssignments?: number;
    unreadNotifications?: number;
    pendingExams?: number;
    upcomingExams?: number;
  } | undefined;

  const ledger = [
    { label: "Active courses", value: studentStats?.activeCourses || 0, hint: "In progress", href: "/lms/student/my-courses" },
    { label: "Pending assignments", value: studentStats?.pendingAssignments || 0, hint: pendingGroups.overdue > 0 ? `${pendingGroups.overdue} overdue` : "To do", href: "/lms/student/assignments?filter=pending", hot: pendingGroups.overdue > 0 },
    { label: "Courses completed", value: studentStats?.completedCourses || 0, hint: "Finished", href: "/lms/student/my-courses?tab=completed" },
    ...((studentStats?.pendingExams || studentStats?.upcomingExams) ? [{ label: "Exams", value: studentStats?.pendingExams || 0, hint: studentStats?.upcomingExams ? `${studentStats.upcomingExams} upcoming` : "Open now", href: "/lms/student/exams", hot: (studentStats?.pendingExams ?? 0) > 0 }] : []),
    { label: "Assignments done", value: studentStats?.completedAssignments || 0, hint: "Submitted and graded", href: "/lms/student/assignments?filter=graded" },
  ];

  const info = (
    profile as { students?: Array<{ schools?: Array<{ name?: string }>; grade?: string; section?: string }> } | null
  )?.students?.[0];
  const gradeSection = info?.grade ? `${info.grade}${info.section ? ` - Section ${info.section.replace(/^section\s*/i, "")}` : ""}` : "";
  const where = [info?.schools?.[0]?.name, gradeSection].filter(Boolean).join(" • ");
  const firstName = (profile as { full_name?: string } | null)?.full_name?.split(" ")[0] || "Student";

  const sectionRank = rankInfo?.rankings?.section;
  const showRank = !!sectionRank && (rankInfo?.attempted ?? 0) > 0 && sectionRank.total > 1;
  const currentStreak = activity?.currentStreak ?? 0;
  const unread = studentStats?.unreadNotifications ?? 0;

  // One sentence that answers "what should I do now?"
  const { overdue, today, first } = pendingGroups;
  let status: React.ReactNode;
  if (overdue > 0 || today > 0) {
    const parts = [
      overdue > 0 ? <strong key="o">{overdue} overdue</strong> : null,
      today > 0 ? <strong key="t">{today} due today</strong> : null,
    ].filter(Boolean);
    status = <>You have {parts[0]}{parts[1] ? <> and {parts[1]}</> : null}.</>;
  } else if (first) {
    status = <>Nothing is overdue. Next up is <strong>{first.title}</strong>.</>;
  } else {
    status = <>You are all caught up. Pick a course to keep going.</>;
  }
  const loadingWork = assignmentsLoading || dailyLoading;

  return (
    <div className="sd-page">
      <section className="sd-hero" aria-labelledby="sd-hello">
        <Link href="/lms/student/notifications" className="sd-bell" aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell aria-hidden="true" />
          {unread > 0 && <i>{unread > 99 ? "99+" : unread}</i>}
        </Link>
        <div className="sd-hero-copy">
          <h1 id="sd-hello">{greeting}, {firstName}</h1>
          {where ? <p className="sd-where">{where}</p> : null}
          <p className="sd-status">{loadingWork ? "Checking your work…" : status}</p>
          <div className="sd-hero-actions">
            {lastViewed ? (
              <Link href={`/lms/student/my-courses/${lastViewed.courseId}`} className="sd-btn sd-btn--amber">
                <Play aria-hidden="true" />Resume {lastViewed.courseTitle}
              </Link>
            ) : (
              <Link href="/lms/student/my-courses" className="sd-btn sd-btn--amber">Browse my courses</Link>
            )}
            <Link href="/lms/student/assignments" className="sd-btn sd-btn--ghost-dark">See assignments</Link>
          </div>
          {lastViewed?.chapterTitle ? (
            <p className="sd-resume-note">Last opened: {lastViewed.chapterTitle}{lastViewed.contentTitle ? ` • ${lastViewed.contentTitle}` : ""}</p>
          ) : null}
        </div>
        <WeekRun days={weekDays} count={weekCount} goal={WEEKLY_GOAL_DAYS} streak={currentStreak} />
      </section>

      <nav className="sd-ledger" aria-label="Summary">
        {ledger.map((m) => (
          <Link key={m.label} href={m.href} data-hot={m.hot ? "true" : undefined}>
            <span className="sd-l">{m.label}</span>
            <b className="sd-n">{m.value.toLocaleString("en-IN")}</b>
            <small>{m.hint}</small>
          </Link>
        ))}
      </nav>

      <div className="sd-cols">
        <div className="sd-col">
          <section className="sd-panel" aria-labelledby="sd-todo">
            <div className="sd-panel-head">
              <div>
                <h2 id="sd-todo">To do</h2>
                <p>Daily homework and course assignments, most urgent first</p>
              </div>
              <Link href="/lms/student/assignments" className="sd-link">View all</Link>
            </div>
            {loadingWork ? (
              <><div className="sd-skel" /><div className="sd-skel" /></>
            ) : pendingGroups.total > 0 ? (
              pendingGroups.groups.map((g) => (
                <div className="sd-group" data-k={g.key} key={g.key}>
                  <p className="sd-group-name">{g.label} <span>({g.items.length})</span></p>
                  <ul className="sd-rows">
                    {g.items.map((a) => (
                      <li className="sd-row" key={a.id}>
                        <div className="sd-row-main">
                          <p className="sd-row-title">
                            {a.title}
                            {a.assignment_type === "DAILY" && <span className="sd-tag">Daily</span>}
                          </p>
                          <p className="sd-row-sub">{a.course_title || a.subject}</p>
                          <p className="sd-due">
                            <Clock aria-hidden="true" />
                            {dueLabel(a.days_until_due)}
                            {a.due_date ? ` • ${new Date(String(a.due_date)).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                          </p>
                        </div>
                        <Link href={`/lms/student/assignments/${a.id}`} className="sd-btn sd-btn--ink">Start</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <div className="sd-empty">
                <b>Nothing to hand in</b>
                <p>New assignments from your teachers will show up here.</p>
                <Link href="/lms/student/assignments" className="sd-link">See past assignments</Link>
              </div>
            )}
          </section>

          <section className="sd-panel" aria-labelledby="sd-courses">
            <div className="sd-panel-head">
              <div>
                <h2 id="sd-courses">Keep learning</h2>
                <p>Courses you have started</p>
              </div>
              <Link href="/lms/student/my-courses" className="sd-link">View all</Link>
            </div>
            {coursesLoading ? (
              <><div className="sd-skel" /><div className="sd-skel" /></>
            ) : activeCourses.length > 0 ? (
              <div style={{ borderTop: "1.5px solid var(--sd-line)" }}>
                {activeCourses.map((c) => {
                  const pct = Math.round(c.progress_percentage || 0);
                  return (
                    <div className="sd-course" key={c.id}>
                      <div>
                        <h3>{c.name || c.title}</h3>
                        {(c.grade || c.subject) && <p className="sd-row-sub">{[c.grade, c.subject].filter(Boolean).join(" • ")}</p>}
                      </div>
                      <div className="sd-meter-row">
                        <div className="sd-meter" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.name || c.title} progress`}>
                          <i style={{ "--p": `${pct}%` } as React.CSSProperties} />
                        </div>
                        <b>{pct}%</b>
                      </div>
                      <Link href={`/lms/student/my-courses/${c.id}`} className="sd-btn sd-btn--ink">
                        {pct > 0 ? "Continue" : "Start"} <ArrowRight aria-hidden="true" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="sd-empty">
                <b>No courses started yet</b>
                <p>Courses your school assigns will show up here.</p>
                <Link href="/lms/student/my-courses" className="sd-btn sd-btn--line">Open my courses</Link>
              </div>
            )}
          </section>
        </div>

        <div className="sd-col">
          {showRank && sectionRank && (
            <section className="sd-panel" aria-labelledby="sd-rank">
              <div className="sd-panel-head">
                <h2 id="sd-rank">Class rank</h2>
                <Link href="/lms/student/analytics" className="sd-link">Details</Link>
              </div>
              <p className="sd-rank"><b>#{sectionRank.rank}</b><span>of {sectionRank.total} in your section</span></p>
              <div className="sd-ladder" aria-hidden="true"><i style={{ "--p": `${Math.max(4, Math.min(96, sectionRank.percentile))}%` } as React.CSSProperties} /></div>
              <p className="sd-ladder-cap"><span>Start</span><span>Top {Math.max(1, Math.round(100 - sectionRank.percentile))}% of your class</span></p>
            </section>
          )}

          {recentlyGraded.length > 0 && (
            <section className="sd-panel" aria-labelledby="sd-graded">
              <div className="sd-panel-head">
                <h2 id="sd-graded">Recently graded</h2>
                <Link href="/lms/student/assignments?filter=graded" className="sd-link">View all</Link>
              </div>
              <div>
                {recentlyGraded.map((a) => {
                  const grade = Number(a.submission?.grade);
                  const t = grade >= 70 ? "high" : grade >= 50 ? "mid" : "low";
                  return (
                    <Link key={a.id} href={`/lms/student/assignments/${a.id}/view`} className="sd-score">
                      <div className="sd-row-main">
                        <p className="sd-row-title">{a.title}</p>
                        <p className="sd-row-sub">{a.course_title || a.subject}</p>
                      </div>
                      <div className="sd-score-n" data-t={t}>
                        <b>{isNaN(grade) ? "—" : `${grade}%`}</b>
                        <div className="sd-meter"><i style={{ "--p": `${isNaN(grade) ? 0 : Math.min(100, grade)}%` } as React.CSSProperties} /></div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          <section className="sd-panel" aria-labelledby="sd-progress">
            <div className="sd-panel-head">
              <h2 id="sd-progress">Your progress</h2>
              <Link href="/lms/student/analytics" className="sd-link">Analytics</Link>
            </div>
            <div className="sd-stat">
              <p className="sd-stat-top"><span>Course progress</span><b>{Math.round(performance.avgProgress)}%</b></p>
              <div className="sd-meter"><i style={{ "--p": `${performance.avgProgress}%` } as React.CSSProperties} /></div>
            </div>
            <div className="sd-stat">
              <p className="sd-stat-top"><span>Average grade</span><b>{Math.round(performance.avgGrade)}%</b></p>
              <div className="sd-meter"><i style={{ "--p": `${performance.avgGrade}%` } as React.CSSProperties} /></div>
            </div>
            <div className="sd-month">
              <p className="sd-stat-top"><span>Last 4 weeks</span><b>{plural(monthCount, "active day")}</b></p>
              <div className="sd-month-grid" aria-hidden="true">
                {month.map((m, i) => <i key={i} data-on={m.on} data-today={m.today} />)}
              </div>
            </div>
          </section>

          <section className="sd-panel" aria-labelledby="sd-notes">
            <div className="sd-panel-head">
              <h2 id="sd-notes">Unread</h2>
              <Link href="/lms/student/notifications" className="sd-link">View all</Link>
            </div>
            {!shouldLoadNonCritical || notificationsLoading ? (
              <><div className="sd-skel" /><div className="sd-skel" /></>
            ) : recentNotifications.length > 0 ? (
              <div>
                {recentNotifications.map((n, i) => (
                  <div className="sd-note" key={n.id ?? i}>
                    <b>{n.title}</b>
                    <p>{n.message}</p>
                    {n.created_at && <small>{new Date(n.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</small>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="sd-empty"><b>You are all caught up</b><p>New messages from your school will appear here.</p></div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
