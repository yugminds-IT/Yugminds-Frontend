"use client";

import { useState, useEffect, useMemo, Suspense, lazy } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useTeacherSchool } from "./context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/student/StatCard";
import { AreaChartAnalyticsCard } from "@/components/ui/area-chart-analytics-card";
import {
  BookOpen,
  FileText,
  Calendar,
  Clock,
  Users,
  AlertCircle,
  RefreshCw
} from "lucide-react";
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
import { SkeletonDashboard } from "@/components/ui/skeleton-dashboard";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { queryKeys } from "@/lib/query-keys";

// Lazy load tab components
const TeacherOverviewTab = lazy(() => import("@/components/teacher/TeacherOverviewTab"));
const TeacherAttendanceTab = lazy(() => import("@/components/teacher/TeacherAttendanceTab"));
const TeacherReportsTab = lazy(() => import("@/components/teacher/TeacherReportsTab"));
const TeacherAnalyticsTab = lazy(() => import("@/components/teacher/TeacherAnalyticsTab"));

export default function TeacherDashboard() {
  const queryClient = useQueryClient();
  const { selectedSchool } = useTeacherSchool();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isMounted, setIsMounted] = useState(false);

  // React Query hooks - only load data needed for stats.
  // Reports: fetch the full window (backend caps at 500) — counting "pending"
  // among only the 5 most recent reports undercounted the real number.
  const { data: classes, isLoading: classesLoading } = useTeacherClasses(selectedSchool?.id);
  const { data: todaysClasses, isLoading: todaysClassesLoading } = useTodaysClasses(selectedSchool?.id);
  const { data: reports, isLoading: reportsLoading } = useTeacherReports(selectedSchool?.id, { limit: 500 });
  const { data: monthlyAttendance, isLoading: attendanceLoading } = useTeacherMonthlyAttendance(selectedSchool?.id, 6);
  const { data: leaves, isLoading: leavesLoading } = useTeacherLeaves(selectedSchool?.id);
  const { data: todayStatus } = useTodayAttendanceStatus(selectedSchool?.id);

  // Refresh function to reload all dashboard data
  const loadDashboardData = async () => {
    if (!selectedSchool?.id) return;

    setIsRefreshing(true);
    try {
      // Invalidate all teacher-related queries to force refetch (match actual query keys)
      await queryClient.invalidateQueries({ queryKey: ['teacher', 'classes', selectedSchool.id] });
      await queryClient.invalidateQueries({ queryKey: ['teacher', 'today-classes', selectedSchool.id] });
      await queryClient.invalidateQueries({ queryKey: ['teacher', 'reports', selectedSchool.id] });
      await queryClient.invalidateQueries({ queryKey: ['teacher', 'monthly-attendance', selectedSchool.id] });
      await queryClient.invalidateQueries({ queryKey: ['teacher', 'leaves', selectedSchool.id] });
      await queryClient.invalidateQueries({ queryKey: ['teacher', 'schedules', selectedSchool.id] });
      await queryClient.invalidateQueries({ queryKey: ['teacher', 'today-attendance', selectedSchool.id] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.teacher.studentProgress });

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useDashboardRealtime('teacher', {
    enabled: Boolean(selectedSchool?.id),
    debugLabel: 'teacher-dashboard',
    customEventMap: {
      'notification:new': [queryKeys.teacher.dashboard, queryKeys.teacher.studentProgress, queryKeys.teacher.schedules],
      'notification:read': [queryKeys.teacher.dashboard, queryKeys.teacher.studentProgress, queryKeys.teacher.schedules],
      'dashboard:stats': [queryKeys.teacher.dashboard, queryKeys.teacher.schedules],
    },
    onStats: () => {
      if (selectedSchool?.id) {
        queryClient.invalidateQueries({ queryKey: ['teacher', 'schedules', selectedSchool.id] });
        queryClient.invalidateQueries({ queryKey: ['teacher', 'classes', selectedSchool.id] });
        queryClient.invalidateQueries({ queryKey: ['teacher', 'today-classes', selectedSchool.id] });
        queryClient.invalidateQueries({ queryKey: ['teacher', 'reports', selectedSchool.id] });
        queryClient.invalidateQueries({ queryKey: ['teacher', 'monthly-attendance', selectedSchool.id] });
        queryClient.invalidateQueries({ queryKey: ['teacher', 'leaves', selectedSchool.id] });
        queryClient.invalidateQueries({ queryKey: queryKeys.teacher.studentProgress });
      }
      setLastRefresh(new Date());
    },
    onEvent: ({ eventType }) => {
      if (eventType === 'notification:new' || eventType === 'notification:read' || eventType === 'dashboard:stats') {
        setLastRefresh(new Date());
      }
    },
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Use smart refresh for tab switching
  useSmartRefresh({
    customRefresh: loadDashboardData,
    minRefreshInterval: 60000, // 1 minute minimum between refreshes
  });

  const statsLoading =
    classesLoading || todaysClassesLoading || reportsLoading || attendanceLoading || leavesLoading;

  // Current-month attendance: only trust the log entry whose month IS the
  // current month — monthlyAttendance[0] is merely the most recent logged
  // month and previously showed last month's numbers as "this month".
  const currentMonthEntry = useMemo(() => {
    if (!isMounted || !Array.isArray(monthlyAttendance)) return null;
    const key = currentMonthKey();
    return monthlyAttendance.find((m) => String(m.month).slice(0, 7) === key) ?? null;
  }, [monthlyAttendance, isMounted]);

  const dashboardStats = useMemo(() => {
    if (!selectedSchool) {
      return { todaysClasses: 0, pendingReports: 0, totalClasses: 0, monthlyAttendance: 0, pendingLeaves: 0 };
    }

    const todaysClassesCount = Array.isArray(todaysClasses) ? todaysClasses.length : 0;
    const pendingReportsCount = Array.isArray(reports)
      ? (reports as Array<{ report_status?: string }>).filter((r) => r.report_status === 'Pending').length
      : 0;
    const totalClassesCount = Array.isArray(classes) ? classes.length : 0;

    const attendancePct = (() => {
      if (!currentMonthEntry) return 0;
      const total = currentMonthEntry.total_days ||
        (currentMonthEntry.present_count + currentMonthEntry.absent_count +
         currentMonthEntry.leave_count + currentMonthEntry.unreported_count) || 0;
      return total > 0 ? Math.round((currentMonthEntry.present_count / total) * 100) : 0;
    })();

    const pendingLeavesCount = Array.isArray(leaves)
      ? (leaves as Array<{ status?: string }>).filter((l) => l.status === 'Pending').length
      : 0;

    return {
      todaysClasses: todaysClassesCount,
      pendingReports: pendingReportsCount,
      totalClasses: totalClassesCount,
      monthlyAttendance: attendancePct,
      pendingLeaves: pendingLeavesCount,
    };
  }, [selectedSchool, classes, todaysClasses, reports, leaves, currentMonthEntry]);

  // Needs attention: real, actionable items only, each linking to its fix.
  const needsAttention = useMemo(() => {
    const items: Array<{ id: string; label: string; href: string; tone: 'red' | 'amber' }> = [];

    const ts = todayStatus as { totalPeriods?: number; periodsWithReports?: number } | undefined;
    const unreported = (ts?.totalPeriods ?? 0) - (ts?.periodsWithReports ?? 0);
    if (unreported > 0) {
      items.push({
        id: 'unreported-periods',
        label: `${unreported} period${unreported !== 1 ? 's' : ''} today without a report`,
        href: '/lms/teacher/reports',
        tone: 'amber',
      });
    }

    const flagged = Array.isArray(reports)
      ? (reports as Array<{ report_status?: string }>).filter((r) => r.report_status === 'Flagged').length
      : 0;
    if (flagged > 0) {
      items.push({
        id: 'flagged-reports',
        label: `${flagged} report${flagged !== 1 ? 's' : ''} flagged by admin`,
        href: '/lms/teacher/reports',
        tone: 'red',
      });
    }

    if (dashboardStats.pendingLeaves > 0) {
      items.push({
        id: 'pending-leaves',
        label: `${dashboardStats.pendingLeaves} leave request${dashboardStats.pendingLeaves !== 1 ? 's' : ''} awaiting approval`,
        href: '/lms/teacher/leaves',
        tone: 'amber',
      });
    }

    return items;
  }, [todayStatus, reports, dashboardStats.pendingLeaves]);

  // Real 6-month attendance series for the one card that has genuine trend data.
  const attendanceSeries = useMemo(() => {
    if (!Array.isArray(monthlyAttendance)) return [];
    return [...monthlyAttendance]
      .reverse()
      .map((m) => {
        const total = m.total_days ||
          (m.present_count + m.absent_count + m.leave_count + m.unreported_count) || 0;
        return {
          label: formatMonthLabel(m.month),
          value: total > 0 ? Math.round((m.present_count / total) * 100) : 0,
        };
      });
  }, [monthlyAttendance]);

  if (!isMounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!selectedSchool) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8">
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
              <p className="text-lg font-medium">No school selected</p>
              <p className="text-sm text-gray-600 mt-2">
                Please select a school from the dropdown above to view your dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const teacherStatCards = [
    {
      title: "Today's Classes",
      value: dashboardStats.todaysClasses,
      description: "Periods scheduled today",
      badge: "Today",
      icon: <BookOpen className="h-4 w-4" />,
      accentColor: "#2563eb",
      info: "Scheduled periods for today at the selected school.",
      href: "/lms/teacher/classes",
    },
    {
      title: "Pending Reports",
      value: dashboardStats.pendingReports,
      description: "Awaiting admin review",
      badge: dashboardStats.pendingReports > 0 ? "Pending" : "Clear",
      icon: <FileText className="h-4 w-4" />,
      accentColor: dashboardStats.pendingReports > 0 ? "#f97316" : "#16a34a",
      info: "Your submitted reports currently waiting for school admin review.",
      href: "/lms/teacher/reports",
    },
    {
      title: "Total Classes",
      value: dashboardStats.totalClasses,
      description: "Classes assigned",
      badge: "Assigned",
      icon: <Users className="h-4 w-4" />,
      accentColor: "#7c3aed",
      info: "Total classes assigned to you in the selected school.",
      href: "/lms/teacher/classes",
    },
    {
      title: "Pending Leaves",
      value: dashboardStats.pendingLeaves,
      description: "Awaiting approval",
      badge: dashboardStats.pendingLeaves > 0 ? "Pending" : "Clear",
      icon: <Clock className="h-4 w-4" />,
      accentColor: dashboardStats.pendingLeaves > 0 ? "#f59e0b" : "#16a34a",
      info: "Leave requests that are still awaiting approval.",
      href: "/lms/teacher/leaves",
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Welcome back! Here&apos;s an overview of your teaching activities at {selectedSchool.name}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Last updated {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <Button
          onClick={loadDashboardData}
          disabled={isRefreshing}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Needs attention — real, actionable items only */}
      {needsAttention.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {needsAttention.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                item.tone === 'red'
                  ? 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100'
                  : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <AlertCircle className={`h-4 w-4 shrink-0 ${item.tone === 'red' ? 'text-red-500' : 'text-amber-500'}`} />
              {item.label}
            </Link>
          ))}
        </div>
      )}

      {/* Stats Cards — skeletons while loading (a 0 is a claim, not a loading state) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {statsLoading ? (
          [...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-[132px] w-full rounded-xl" />
          ))
        ) : (
          <>
            {teacherStatCards.map((metric) => (
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
            {/* Attendance is the one metric with a real monthly series — keep the chart card for it */}
            <AreaChartAnalyticsCard
              title="Monthly Attendance"
              value={currentMonthEntry ? `${dashboardStats.monthlyAttendance}%` : "—"}
              description={
                currentMonthEntry
                  ? formatMonthLabel(currentMonthEntry.month, { month: 'long', year: 'numeric' })
                  : "No log for this month yet"
              }
              badge="6 months"
              icon={<Calendar className="h-4 w-4" />}
              accentColor="#0891b2"
              sideMetric={currentMonthEntry ? `${dashboardStats.monthlyAttendance}%` : "—"}
              sideLabel="present"
              info="Attendance percentage per month over the last 6 logged months."
              href="/lms/teacher/attendance"
              data={attendanceSeries}
            />
          </>
        )}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Suspense fallback={<SkeletonDashboard />}>
            <TeacherOverviewTab selectedSchoolId={selectedSchool?.id} />
          </Suspense>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-6">
          <Suspense fallback={<SkeletonDashboard />}>
            <TeacherAttendanceTab />
          </Suspense>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <Suspense fallback={<SkeletonDashboard />}>
            <TeacherReportsTab selectedSchoolId={selectedSchool?.id} />
          </Suspense>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <Suspense fallback={<SkeletonDashboard />}>
            <TeacherAnalyticsTab selectedSchoolId={selectedSchool?.id} />
          </Suspense>
        </TabsContent>

      </Tabs>
    </div>
  );
}
