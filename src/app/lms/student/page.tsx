"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { frontendLogger } from "@/lib/frontend-logger";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/student/StatCard";
import {
  BookOpen,
  FileText,
  Calendar,
  Award,
  CheckCircle,
  Clock,
  Bell,
  Play,
  Upload,
  Flame,
  Trophy,
  Target,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import {
  useStudentProfile,
  useStudentDashboardStats,
  useStudentCourses,
  useStudentAssignments,
  useStudentDailyAssignments,
  useStudentNotifications,
  useStudentLastViewed,
  useStudentActivity,
  useStudentRankings
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
  days_until_due?: number;
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
  thumbnail_url?: string;
  progress_percentage?: number;
  average_grade?: number | null;
}

export default function StudentDashboard() {
  const router = useRouter();
  const [greeting, setGreeting] = useState("Hello");
  const [isMounted, setIsMounted] = useState(false);

  // OPTIMIZATION: Request deduplication - Track ongoing requests to prevent duplicates
  const _ongoingRequests = useRef<Map<string, Promise<unknown>>>(new Map());

  // OPTIMIZATION: Incremental Loading - Load critical data first, defer non-critical
  // Critical: profile, stats (needed for header/stats cards)
  const { data: profile } = useStudentProfile();
  const { data: stats } = useStudentDashboardStats();
  const { data: courses, isLoading: coursesLoading } = useStudentCourses();
  const { data: assignments, isLoading: assignmentsLoading } = useStudentAssignments();
  const { data: dailyAssignments, isLoading: dailyLoading } = useStudentDailyAssignments();
  const { data: lastViewed, isLoading: lastViewedLoading } = useStudentLastViewed();

  // OPTIMIZATION: Defer non-critical data loading - load after initial render
  const [shouldLoadNonCritical, setShouldLoadNonCritical] = useState(false);

  useEffect(() => {
    // Defer non-critical data loading using requestIdleCallback
    if (isMounted && !shouldLoadNonCritical) {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        requestIdleCallback(() => {
          setShouldLoadNonCritical(true);
        }, { timeout: 500 });
      } else {
        setTimeout(() => {
          setShouldLoadNonCritical(true);
        }, 200);
      }
    }
  }, [isMounted, shouldLoadNonCritical]);

  const { data: notifications, isLoading: notificationsLoading } = useStudentNotifications();
  const { data: activity } = useStudentActivity();
  const { data: rankInfo } = useStudentRankings();
  useDashboardRealtime('student', {
    enabled: true,
    debugLabel: 'student-dashboard',
    customEventMap: {
      'notification:new': [queryKeys.student.notifications, queryKeys.student.dashboardStats],
      'notification:read': [queryKeys.student.notifications, queryKeys.student.dashboardStats],
      'dashboard:stats': [queryKeys.student.dashboardStats, queryKeys.student.courses, queryKeys.student.assignments],
    },
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);

    frontendLogger.debug('Student dashboard mounted', {
      component: 'StudentDashboard',
    });

    // Set greeting based on time of day
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  // Check for force password change using profile data from hook (no duplicate query)
  useEffect(() => {
    interface Profile {
      force_password_change?: boolean;
    }

    if (profile && typeof profile === 'object' && 'force_password_change' in (profile as Profile) && (profile as Profile).force_password_change) {
      router.push('/lms/student/settings?force_change=true');
    }
  }, [profile, router]);

  // Use smart refresh for tab switching
  useSmartRefresh({
    queryKeys: [
      ['studentProfile'],
      ['studentDashboardStats'],
      ['studentCourses'],
      ['studentAssignments'],
      ['studentNotifications']
    ],
    minRefreshInterval: 60000, // 1 minute minimum between refreshes
  });

  // Combined daily + course pending assignments (not yet started), grouped by
  // urgency: Overdue → Due today → This week → Later. Answers "what do I have
  // to do today?" at a glance.
  const pendingGroups = useMemo(() => {
    const course = Array.isArray(assignments) ? (assignments as Assignment[]) : [];
    const daily = Array.isArray(dailyAssignments) ? (dailyAssignments as Assignment[]) : [];
    const seen = new Set<string>();
    const pending = [...course, ...daily]
      .filter((a) => {
        if (!a.id || seen.has(a.id)) return false;
        seen.add(a.id);
        return a.status === 'not_started' || a.status === 'pending' || a.status == null;
      })
      .sort((a, b) => {
        const da = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        return da - db;
      })
      .slice(0, 6);

    const groups: Array<{ key: string; label: string; labelClass: string; items: Assignment[] }> = [
      { key: 'overdue', label: 'Overdue', labelClass: 'text-red-600', items: [] },
      { key: 'today', label: 'Due today', labelClass: 'text-orange-600', items: [] },
      { key: 'week', label: 'This week', labelClass: 'text-gray-500', items: [] },
      { key: 'later', label: 'Later', labelClass: 'text-gray-400', items: [] },
    ];
    pending.forEach((a) => {
      const d = a.days_until_due;
      if (a.is_overdue || (d != null && d < 0)) groups[0].items.push(a);
      else if (d === 0) groups[1].items.push(a);
      else if (d != null && d <= 7) groups[2].items.push(a);
      else groups[3].items.push(a);
    });
    return { groups: groups.filter((g) => g.items.length > 0), total: pending.length };
  }, [assignments, dailyAssignments]);

  // Recently graded submissions — small feedback loop after work is marked.
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

  // Recent unread notifications
  const recentNotifications = useMemo(
    () =>
      ((notifications as Array<{ id?: string; title?: string; message?: string; created_at?: string; is_read?: boolean }> | undefined) || [])
        .filter((n) => !n.is_read)
        .slice(0, 5),
    [notifications]
  );

  const courseList = useMemo(() => (courses as Course[] | undefined) || [], [courses]);

  // Active courses = exist and not 100% complete (matches useStudentDashboardStats)
  const activeCourses = useMemo(
    () => courseList.filter((c) => (c.progress_percentage || 0) < 100).slice(0, 3),
    [courseList]
  );

  // Performance: compute course-progress and average-grade once (was duplicated inline).
  const performance = useMemo(() => {
    const avgProgress =
      courseList.length > 0
        ? courseList.reduce((acc, c) => acc + (c.progress_percentage || 0), 0) / courseList.length
        : 0;
    const graded = courseList.filter((c) => c.average_grade != null);
    const avgGrade =
      graded.length > 0
        ? graded.reduce((sum, c) => sum + (c.average_grade ?? 0), 0) / graded.length
        : 0;
    return { avgProgress, avgGrade };
  }, [courseList]);

  // Weekly goal: active days since Monday, out of a 5-day target.
  const WEEKLY_GOAL_DAYS = 5;
  const weeklyActiveDays = useMemo(() => {
    if (!isMounted) return 0;
    const days = activity?.activityDays ?? [];
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // getDay(): Sun=0 … Sat=6 → offset back to the most recent Monday
    monday.setDate(monday.getDate() - ((now.getDay() + 6) % 7));
    return days.filter((d) => {
      const t = new Date(d.date);
      return !isNaN(t.getTime()) && t >= monday && (d.hasLearning || d.hasAssignment);
    }).length;
  }, [activity, isMounted]);

  if (!isMounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const studentStats = stats as {
    activeCourses?: number;
    pendingAssignments?: number;
    completedCourses?: number;
    completedAssignments?: number;
    unreadNotifications?: number;
  } | undefined;

  const studentStatCards = [
    {
      title: "Active Courses",
      value: studentStats?.activeCourses || 0,
      description: "Courses in progress",
      badge: "In progress",
      icon: <BookOpen className="h-4 w-4" />,
      accentColor: "#2563eb",
      info: "Courses you have started and not yet completed.",
      href: "/lms/student/my-courses",
    },
    {
      title: "Pending Assignments",
      value: studentStats?.pendingAssignments || 0,
      description: "Due soon",
      badge: "Pending",
      icon: <FileText className="h-4 w-4" />,
      accentColor: "#f97316",
      info: "Daily homework + course assignments that still need your attention.",
      href: "/lms/student/assignments?filter=pending",
    },
    {
      title: "Courses Completed",
      value: studentStats?.completedCourses || 0,
      description: "Total finished",
      badge: "Finished",
      icon: <CheckCircle className="h-4 w-4" />,
      accentColor: "#16a34a",
      info: "Courses you have completed.",
      href: "/lms/student/my-courses?tab=completed",
    },
    {
      title: "Assignments Completed",
      value: studentStats?.completedAssignments || 0,
      description: "Assignments done",
      badge: "Done",
      icon: <CheckCircle className="h-4 w-4" />,
      accentColor: "#7c3aed",
      info: "Assignments you have completed.",
      href: "/lms/student/assignments?filter=graded",
    },
    {
      title: "Notifications",
      value: studentStats?.unreadNotifications || 0,
      description: "Unread",
      badge: (studentStats?.unreadNotifications || 0) > 0 ? "Unread" : "Clear",
      icon: <Bell className="h-4 w-4" />,
      accentColor: "#0891b2",
      info: "Unread notifications for your account.",
      href: "/lms/student/notifications",
    },
  ];

  const sectionRank = rankInfo?.rankings?.section;
  const showRank = !!sectionRank && (rankInfo?.attempted ?? 0) > 0 && sectionRank.total > 1;
  const currentStreak = activity?.currentStreak ?? 0;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {greeting}, {(profile as { full_name?: string } | null)?.full_name?.split(' ')[0] || 'Student'}! 👋
          </h1>
          {(() => {
            const studentInfo = (
              profile as {
                students?: Array<{
                  schools?: Array<{ name?: string }>;
                  grade?: string;
                  section?: string;
                }>;
              } | null
            )?.students?.[0];
            const schoolName = studentInfo?.schools?.[0]?.name;
            const gradeSection = studentInfo?.grade
              ? `${studentInfo.grade}${studentInfo.section ? ` - Section ${studentInfo.section}` : ''}`
              : '';
            const subtitle = [schoolName, gradeSection].filter(Boolean).join(' • ');
            return subtitle ? <p className="text-gray-600 mt-2">{subtitle}</p> : null;
          })()}
        </div>
        <div className="flex items-center gap-3">
          {(activity?.activeDaysLast28 ?? 0) > 0 && (
            <div
              className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-600 ring-1 ring-blue-100"
              title={`Learn on ${WEEKLY_GOAL_DAYS} days each week to stay on track`}
            >
              <Target className="h-4 w-4" />
              {Math.min(weeklyActiveDays, WEEKLY_GOAL_DAYS)}/{WEEKLY_GOAL_DAYS} days this week
            </div>
          )}
          {currentStreak > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-semibold text-orange-600 ring-1 ring-orange-100">
              <Flame className="h-4 w-4" />
              {currentStreak}-day streak
            </div>
          )}
          <Link href="/lms/student/notifications">
            <Button variant="outline" className="relative">
              <Bell className="h-4 w-4" />
              {recentNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {recentNotifications.length}
                </span>
              )}
            </Button>
          </Link>
        </div>
      </div>

      {/* Jump back in — resume last viewed course */}
      {lastViewedLoading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : lastViewed ? (
        <Card className="overflow-hidden border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Play className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-blue-600">Jump back in</p>
                <h3 className="truncate font-semibold text-gray-900">{lastViewed.courseTitle}</h3>
                <p className="truncate text-sm text-gray-600">
                  {lastViewed.chapterTitle
                    ? `${lastViewed.chapterTitle}${lastViewed.contentTitle ? ` • ${lastViewed.contentTitle}` : ''}`
                    : 'Continue where you left off'}
                </p>
              </div>
            </div>
            <Link
              href={`/lms/student/my-courses/${lastViewed.courseId}`}
              className="shrink-0"
            >
              <Button className="w-full sm:w-auto">
                Resume
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {studentStatCards.map((metric) => (
          <StatCard
            key={metric.title}
            title={metric.title}
            value={metric.value}
            description={metric.description}
            badge={metric.badge}
            icon={metric.icon}
            accentColor={metric.accentColor}
            info={metric.info}
            href={metric.href}
          />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Active Courses & Assignments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Courses */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Active Courses</CardTitle>
                  <CardDescription>Continue your learning journey</CardDescription>
                </div>
                <Link href="/lms/student/my-courses">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {coursesLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-lg border p-4">
                      <Skeleton className="h-5 w-1/2" />
                      <Skeleton className="mt-2 h-4 w-1/3" />
                      <Skeleton className="mt-4 h-2 w-full" />
                    </div>
                  ))}
                </div>
              ) : activeCourses.length > 0 ? (
                <div className="space-y-4">
                  {activeCourses.map((course) => (
                    <div key={course.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{course.name || course.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{course.grade}{course.subject ? ` • ${course.subject}` : ''}</p>
                          <div className="mt-3">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">Progress</span>
                              <span className="font-medium">{course.progress_percentage?.toFixed(0) || 0}%</span>
                            </div>
                            <Progress value={course.progress_percentage || 0} className="h-2" />
                          </div>
                        </div>
                        <Link href={`/lms/student/my-courses/${course.id}`}>
                          <Button size="sm" className="ml-4">
                            <Play className="h-4 w-4 mr-2" />
                            Continue
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No active courses yet</p>
                  <p className="mt-1 text-sm text-gray-400">
                    Courses your school assigns will show up here.
                  </p>
                  <Link href="/lms/student/my-courses">
                    <Button variant="outline" size="sm" className="mt-3">
                      Browse my courses
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Assignments */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pending Assignments</CardTitle>
                  <CardDescription>Daily homework &amp; course assignments due soon</CardDescription>
                </div>
                <Link href="/lms/student/assignments">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {assignmentsLoading || dailyLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-lg border p-4">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="mt-2 h-4 w-1/3" />
                      <Skeleton className="mt-3 h-4 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : pendingGroups.total > 0 ? (
                <div className="space-y-5">
                  {pendingGroups.groups.map((group) => (
                    <div key={group.key}>
                      <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${group.labelClass}`}>
                        {group.label}
                        <span className="ml-1.5 font-normal normal-case text-gray-400">({group.items.length})</span>
                      </p>
                      <div className="space-y-3">
                        {group.items.map((assignment: Assignment) => (
                          <div
                            key={assignment.id}
                            className={`border rounded-lg p-4 ${group.key === 'overdue' ? 'border-red-200 bg-red-50/40' : group.key === 'today' ? 'border-orange-200 bg-orange-50/40' : ''}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-gray-900">{assignment.title}</h3>
                                  {assignment.assignment_type === 'DAILY' && (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                      Daily
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{assignment.course_title || assignment.subject}</p>
                                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                  {assignment.due_date && (
                                    <div className="flex items-center">
                                      <Calendar className="h-4 w-4 mr-1" />
                                      Due: {new Date(String(assignment.due_date)).toLocaleDateString()}
                                    </div>
                                  )}
                                  <div className={`flex items-center ${group.key === 'overdue' ? 'text-red-600 font-medium' : group.key === 'today' ? 'text-orange-600 font-medium' : ''}`}>
                                    <Clock className="h-4 w-4 mr-1" />
                                    {(assignment.days_until_due ?? 0) > 0
                                      ? `${assignment.days_until_due ?? 0} days left`
                                      : (assignment.days_until_due ?? 0) === 0
                                      ? 'Due today'
                                      : 'Overdue'
                                    }
                                  </div>
                                </div>
                              </div>
                              <Link href={`/lms/student/assignments/${assignment.id}`}>
                                <Button size="sm" variant={(assignment.days_until_due ?? 0) <= 2 ? "default" : "outline"}>
                                  <Upload className="h-4 w-4 mr-2" />
                                  Start
                                </Button>
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>All caught up! No pending assignments</p>
                  <Link href="/lms/student/assignments">
                    <Button variant="link" size="sm" className="mt-1 text-blue-600">
                      View all assignments
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Ranking, Quick Actions & Notifications */}
        <div className="space-y-6">
          {/* Class Ranking */}
          {showRank && sectionRank && (
            <Card className="overflow-hidden border-amber-100 bg-gradient-to-br from-amber-50 to-yellow-50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    Your Rank
                  </CardTitle>
                  <Link href="/lms/student/analytics">
                    <Button variant="ghost" size="sm">Details</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-amber-600">#{sectionRank.rank}</span>
                  <span className="text-sm text-gray-600">of {sectionRank.total} in your section</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Top {Math.max(1, Math.round(100 - sectionRank.percentile))}% of your class
                </p>
              </CardContent>
            </Card>
          )}

          {/* Recently graded — feedback loop after submitting work */}
          {recentlyGraded.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recently Graded</CardTitle>
                  <Link href="/lms/student/assignments?filter=graded">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {recentlyGraded.map((a) => {
                  const grade = Number(a.submission?.grade);
                  const gradeColor =
                    grade >= 70 ? 'text-emerald-600' : grade >= 50 ? 'text-amber-600' : 'text-red-500';
                  return (
                    <Link
                      key={a.id}
                      href={`/lms/student/assignments/${a.id}/view`}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-gray-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{a.title}</p>
                        <p className="truncate text-xs text-gray-500">{a.course_title || a.subject}</p>
                      </div>
                      <span className={`shrink-0 text-sm font-bold ${gradeColor}`}>
                        {isNaN(grade) ? '—' : `${grade}%`}
                        {grade >= 90 && ' 🎉'}
                      </span>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/lms/student/my-courses">
                <Button variant="outline" className="w-full justify-start">
                  <BookOpen className="h-4 w-4 mr-2" />
                  My Courses
                </Button>
              </Link>
              <Link href="/lms/student/assignments">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  Assignments
                </Button>
              </Link>
              <Link href="/lms/student/certificates">
                <Button variant="outline" className="w-full justify-start">
                  <Award className="h-4 w-4 mr-2" />
                  Certificates
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Recent Notifications - OPTIMIZATION: Lazy load this section */}
          {shouldLoadNonCritical ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Notifications</CardTitle>
                  <Link href="/lms/student/notifications">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {notificationsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : recentNotifications.length > 0 ? (
                  <div className="space-y-3">
                    {recentNotifications.map((notification, idx: number) => (
                      <div key={notification.id ?? idx} className="p-3 border rounded-lg bg-blue-50">
                        <div className="flex items-start gap-2">
                          <Bell className="h-4 w-4 text-blue-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                            <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {notification.created_at ? new Date(notification.created_at).toLocaleString() : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No new notifications</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Performance Overview - OPTIMIZATION: Lazy load this section */}
          {shouldLoadNonCritical ? (
            <Card>
              <CardHeader>
                <CardTitle>Performance</CardTitle>
                <CardDescription>Your overall stats</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Course Progress</span>
                    <span className="font-medium">{Math.round(performance.avgProgress)}%</span>
                  </div>
                  <Progress value={performance.avgProgress} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Average Grade</span>
                    <span className="font-medium">{Math.round(performance.avgGrade)}%</span>
                  </div>
                  <Progress value={performance.avgGrade} className="h-2" />
                </div>
                {(activity?.activeDaysLast28 ?? 0) > 0 && (
                  <div className="flex items-center justify-between border-t pt-3 text-sm">
                    <span className="flex items-center gap-1.5 text-gray-600">
                      <Flame className="h-4 w-4 text-orange-500" />
                      Active days (28d)
                    </span>
                    <span className="font-medium">{activity?.activeDaysLast28}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Performance</CardTitle>
                <CardDescription>Your overall stats</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
