"use client";

import { useState, useEffect, useMemo, Suspense, lazy } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTeacherSchool } from "./context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  useTodaysClasses
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface DashboardStats {
  todaysClasses: number;
  pendingReports: number;
  totalClasses: number;
  monthlyAttendance: number;
  pendingLeaves: number;
  totalStudents: number;
}

export default function TeacherDashboard() {
  const _router = useRouter();
  const queryClient = useQueryClient();
  const { selectedSchool } = useTeacherSchool();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isMounted, setIsMounted] = useState(false);

  // React Query hooks - only load data needed for stats
  const { data: classes, isLoading: classesLoading } = useTeacherClasses(selectedSchool?.id);
  const { data: todaysClasses, isLoading: todaysClassesLoading } = useTodaysClasses(selectedSchool?.id);
  const { data: reports, isLoading: reportsLoading } = useTeacherReports(selectedSchool?.id, { limit: 5 });
  const { data: monthlyAttendance, isLoading: attendanceLoading } = useTeacherMonthlyAttendance(selectedSchool?.id, 6);
  const { data: leaves, isLoading: leavesLoading } = useTeacherLeaves(selectedSchool?.id);

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

  // Use useMemo to calculate stats and activity efficiently (only recalculates when data changes)
  // Only calculate when data is actually loaded (not during loading states)
  const dashboardStats = useMemo(() => {
    if (!selectedSchool) return {
      todaysClasses: 0,
      pendingReports: 0,
      totalClasses: 0,
      monthlyAttendance: 0,
      pendingLeaves: 0,
      totalStudents: 0
    };

    // Only calculate stats if data is loaded (not undefined due to loading)
    // For each data source, if it's still loading, return 0 to avoid showing stale/cached values
    
    // Today's classes count - use real schedule-based data
    const todaysClassesCount = (() => {
      // If still loading, return 0
      if (todaysClassesLoading || todaysClasses === undefined) return 0;
      return Array.isArray(todaysClasses) ? todaysClasses.length : 0;
    })();

    // Pending reports count
    const pendingReportsCount = (() => {
      if (reportsLoading || reports === undefined) return 0;
      return Array.isArray(reports)
        ? (reports as Array<{ report_status?: string }>).filter((r) => r.report_status === 'Pending').length
        : 0;
    })();

    // Total classes count
    const totalClassesCount = (() => {
      if (classesLoading || classes === undefined) return 0;
      return Array.isArray(classes) ? classes.length : 0;
    })();

    // Calculate monthly attendance percentage
    const attendancePct = (() => {
      if (attendanceLoading || !monthlyAttendance || monthlyAttendance.length === 0) return 0;
      
      // Get current month data - monthlyAttendance is sorted descending (most recent first)
      const currentMonthData = monthlyAttendance[0];
      
      if (!currentMonthData) return 0;
      
      // Use total_days if available, otherwise calculate from individual counts
      const total = currentMonthData.total_days || 
        (currentMonthData.present_count + currentMonthData.absent_count + 
         currentMonthData.leave_count + currentMonthData.unreported_count) || 1;
      
      const present = currentMonthData.present_count || 0;
      
      // Calculate percentage
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
      
      return percentage;
    })();

    // Pending leaves count
    const pendingLeavesCount = (() => {
      if (leavesLoading || leaves === undefined) return 0;
      return Array.isArray(leaves) 
        ? (leaves as Array<{ status?: string }>).filter((l) => l.status === 'Pending').length 
        : 0;
    })();

    return {
      todaysClasses: todaysClassesCount,
      pendingReports: pendingReportsCount,
      totalClasses: totalClassesCount,
      monthlyAttendance: attendancePct,
      pendingLeaves: pendingLeavesCount,
      totalStudents: 0
    };
  }, [
    selectedSchool, 
    classes, 
    classesLoading,
    todaysClasses, 
    todaysClassesLoading,
    reports, 
    reportsLoading,
    leaves, 
    leavesLoading,
    monthlyAttendance, 
    attendanceLoading
  ]);

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

  const makeSparklineData = (value: number, points = 6) => {
    const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
    const baseline = Math.max(1, safeValue);

    return Array.from({ length: points }, (_, index) => {
      const progress = (index + 1) / points;
      const wave = Math.sin(index * 1.15) * baseline * 0.08;

      return {
        label: `${index + 1}`,
        value: Math.max(0, Math.round(baseline * (0.62 + progress * 0.38) + wave)),
      };
    });
  };

  const teacherStatCards = [
    {
      title: "Today's Classes",
      value: dashboardStats.todaysClasses,
      description: "Classes scheduled today",
      badge: "Today",
      icon: <BookOpen className="h-4 w-4" />,
      accentColor: "#2563eb",
      sideMetric: `${dashboardStats.todaysClasses}`,
      sideLabel: "scheduled",
      info: "Classes scheduled for today at the selected school.",
      numericValue: dashboardStats.todaysClasses,
    },
    {
      title: "Pending Reports",
      value: dashboardStats.pendingReports,
      description: "Reports awaiting approval",
      badge: dashboardStats.pendingReports > 0 ? "Pending" : "Clear",
      icon: <FileText className="h-4 w-4" />,
      accentColor: dashboardStats.pendingReports > 0 ? "#f97316" : "#16a34a",
      sideMetric: `${dashboardStats.pendingReports}`,
      sideLabel: "reports",
      info: "Teacher reports currently waiting for school admin review.",
      numericValue: dashboardStats.pendingReports,
    },
    {
      title: "Total Classes",
      value: dashboardStats.totalClasses,
      description: "Classes assigned",
      badge: "Assigned",
      icon: <Users className="h-4 w-4" />,
      accentColor: "#7c3aed",
      sideMetric: `${dashboardStats.totalClasses}`,
      sideLabel: "classes",
      info: "Total classes assigned to you in the selected school.",
      numericValue: dashboardStats.totalClasses,
    },
    {
      title: "Monthly Attendance",
      value: `${dashboardStats.monthlyAttendance}%`,
      description: "This month",
      badge: "Attendance",
      icon: <Calendar className="h-4 w-4" />,
      accentColor: "#0891b2",
      sideMetric: `${dashboardStats.monthlyAttendance}%`,
      sideLabel: "present",
      info: "Your attendance percentage for the current month.",
      numericValue: dashboardStats.monthlyAttendance,
    },
    {
      title: "Pending Leaves",
      value: dashboardStats.pendingLeaves,
      description: "Awaiting approval",
      badge: dashboardStats.pendingLeaves > 0 ? "Pending" : "Clear",
      icon: <Clock className="h-4 w-4" />,
      accentColor: dashboardStats.pendingLeaves > 0 ? "#f59e0b" : "#16a34a",
      sideMetric: `${dashboardStats.pendingLeaves}`,
      sideLabel: "leaves",
      info: "Leave requests that are still awaiting approval.",
      numericValue: dashboardStats.pendingLeaves,
    },
    {
      title: "Last Refresh",
      value: lastRefresh.toLocaleTimeString(),
      description: "Dashboard data sync",
      badge: "Live",
      icon: <RefreshCw className="h-4 w-4" />,
      accentColor: "#64748b",
      sideMetric: "Now",
      sideLabel: "updated",
      info: "The most recent time this dashboard data refreshed.",
      numericValue: 1,
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {teacherStatCards.map((metric) => (
          <AreaChartAnalyticsCard
            key={metric.title}
            title={metric.title}
            value={metric.value}
            description={metric.description}
            badge={metric.badge}
            icon={metric.icon}
            accentColor={metric.accentColor}
            sideMetric={metric.sideMetric}
            sideLabel={metric.sideLabel}
            info={metric.info}
            data={makeSparklineData(metric.numericValue)}
          />
        ))}
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

