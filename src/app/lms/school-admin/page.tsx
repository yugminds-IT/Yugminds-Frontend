"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSchoolAdmin } from "@/contexts/SchoolAdminContext";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChartAnalyticsCard } from "@/components/ui/area-chart-analytics-card";
import { 
  Users, 
  User, 
  BookOpen, 
  AlertCircle,
  Eye,
  ArrowRight,
  RefreshCw,
  Clock,
  CheckCircle,
  ClipboardList,
  School
} from "lucide-react";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

// Enhanced interfaces for real-time data
interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  activeCourses: number;
  pendingReports: number;
  pendingLeaves: number;
  averageAttendance: number;
}

interface QuickActionPreview {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  data: Array<{
    id?: string;
    name?: string;
    full_name?: string;
    title?: string;
    created_at: string;
    status?: string;
    email?: string;
  }>;
  loading: boolean;
  lastUpdated: string;
  route: string;
}

interface RecentActivity {
  id: string;
  title: string;
  message: string;
  created_at: string;
  type: 'success' | 'warning' | 'info' | 'error';
}

export default function SchoolAdminDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { schoolInfo: contextSchoolInfo, profileFullName } = useSchoolAdmin();
  const defaultStats: DashboardStats = {
    totalStudents: 0,
    totalTeachers: 0,
    activeCourses: 0,
    pendingReports: 0,
    pendingLeaves: 0,
    averageAttendance: 0,
  };
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
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
        averageAttendance: Number(raw.averageAttendance ?? 0),
      };
    },
  });

  const studentsPreviewQuery = useQuery({
    queryKey: [...queryKeys.schoolAdmin.quickPreviews, "students"],
    queryFn: async () => {
      const res = await schoolAdminApi.students.list({ limit: 3 });
      return (res.data as { students?: unknown[] })?.students ?? (Array.isArray(res.data) ? res.data : []);
    },
  });

  const teachersPreviewQuery = useQuery({
    queryKey: [...queryKeys.schoolAdmin.quickPreviews, "teachers"],
    queryFn: async () => {
      const res = await schoolAdminApi.teachers.list({ limit: 3 });
      return (res.data as { teachers?: unknown[] })?.teachers ?? (Array.isArray(res.data) ? res.data : []);
    },
  });

  const reportsPreviewQuery = useQuery({
    queryKey: [...queryKeys.schoolAdmin.quickPreviews, "reports"],
    queryFn: async () => {
      const res = await schoolAdminApi.reports.list({ limit: 3, pending: 1 as unknown as number });
      return (res.data as { reports?: unknown[] })?.reports ?? (Array.isArray(res.data) ? res.data : []);
    },
  });

  const coursesPreviewQuery = useQuery({
    queryKey: [...queryKeys.schoolAdmin.quickPreviews, "courses"],
    queryFn: async () => {
      const res = await schoolAdminApi.courses.list({ status: "Published", limit: 3 });
      return (res.data as { courses?: unknown[] })?.courses ?? (Array.isArray(res.data) ? res.data : []);
    },
  });

  const stats = statsQuery.data ?? defaultStats;
  const displaySchoolInfo = contextSchoolInfo;

  const quickActionPreviews = useMemo<QuickActionPreview[]>(() => {
    const previews: QuickActionPreview[] = [];
    const nowIso = new Date().toISOString();

    const recentStudents = Array.isArray(studentsPreviewQuery.data) ? studentsPreviewQuery.data : [];
    previews.push({
      id: "students",
      title: "Recent Students",
      description: "Latest student enrollments",
      icon: <User className="h-4 w-4" />,
      data: recentStudents.map((s: any) => ({
        id: s.id,
        full_name: s.profile?.full_name || "Unknown",
        email: s.profile?.email || "",
        created_at: s.enrolled_at || s.created_at || nowIso,
      })),
      loading: studentsPreviewQuery.isFetching,
      lastUpdated: nowIso,
      route: "/lms/school-admin/students",
    });

    const recentTeachers = Array.isArray(teachersPreviewQuery.data) ? teachersPreviewQuery.data : [];
    previews.push({
      id: "teachers",
      title: "Recent Teachers",
      description: "Latest teacher assignments",
      icon: <Users className="h-4 w-4" />,
      data: recentTeachers.map((t: any) => {
        const teacher = t.teacher || t;
        return {
          id: t.id,
          full_name: teacher?.full_name || "Unknown",
          email: teacher?.email || "",
          created_at: t.assigned_at || t.created_at || nowIso,
        };
      }),
      loading: teachersPreviewQuery.isFetching,
      lastUpdated: nowIso,
      route: "/lms/school-admin/teachers",
    });

    const recentReports = Array.isArray(reportsPreviewQuery.data) ? reportsPreviewQuery.data : [];
    if (recentReports.length > 0) {
      previews.push({
        id: "reports",
        title: "Pending Reports",
        description: "Teacher reports awaiting approval",
        icon: <ClipboardList className="h-4 w-4" />,
        data: recentReports.map((r: any) => {
          const profile = r.teacher || {};
          return {
            id: r.id,
            full_name: profile?.full_name || "Unknown Teacher",
            name: r.topics_taught?.substring(0, 30) || "Report",
            created_at: r.created_at || r.date || nowIso,
            status: "Pending",
          };
        }),
        loading: reportsPreviewQuery.isFetching,
        lastUpdated: nowIso,
        route: "/lms/school-admin/reports",
      });
    }

    const recentCourses = Array.isArray(coursesPreviewQuery.data) ? coursesPreviewQuery.data : [];
    previews.push({
      id: "courses",
      title: "Active Courses",
      description: "Published courses in your school",
      icon: <BookOpen className="h-4 w-4" />,
      data: recentCourses.map((c: any) => ({
        id: c.id,
        title: c.title,
        created_at: c.created_at || nowIso,
        status: c.status,
      })),
      loading: coursesPreviewQuery.isFetching,
      lastUpdated: nowIso,
      route: "/lms/school-admin/courses",
    });

    return previews;
  }, [
    coursesPreviewQuery.data,
    coursesPreviewQuery.isFetching,
    reportsPreviewQuery.data,
    reportsPreviewQuery.isFetching,
    studentsPreviewQuery.data,
    studentsPreviewQuery.isFetching,
    teachersPreviewQuery.data,
    teachersPreviewQuery.isFetching,
  ]);

  const recentActivity = useMemo<RecentActivity[]>(() => {
    const activityItems: RecentActivity[] = [];
    const recentStudents = Array.isArray(studentsPreviewQuery.data) ? studentsPreviewQuery.data : [];
    const recentTeachers = Array.isArray(teachersPreviewQuery.data) ? teachersPreviewQuery.data : [];

    recentStudents.slice(0, 2).forEach((s: any) => {
      activityItems.push({
        id: `student-${s.id}`,
        title: "New Student Enrollment",
        message: `${s.profile?.full_name || "A student"} enrolled in the school`,
        created_at: s.enrolled_at || s.created_at || new Date().toISOString(),
        type: "success",
      });
    });

    recentTeachers.slice(0, 2).forEach((t: any) => {
      const teacher = t.teacher || t;
      activityItems.push({
        id: `teacher-${t.id || t.teacher_id}`,
        title: "New Teacher Assignment",
        message: `${teacher?.full_name || "A teacher"} was assigned to the school`,
        created_at: t.assigned_at || t.created_at || new Date().toISOString(),
        type: "info",
      });
    });

    if (stats.pendingReports > 0) {
      activityItems.push({
        id: "pending-reports",
        title: "Pending Reports",
        message: `${stats.pendingReports} teacher report(s) awaiting approval`,
        created_at: new Date().toISOString(),
        type: "warning",
      });
    }

    if (stats.pendingLeaves > 0) {
      activityItems.push({
        id: "pending-leaves",
        title: "Pending Leave Requests",
        message: `${stats.pendingLeaves} leave request(s) awaiting approval`,
        created_at: new Date().toISOString(),
        type: "warning",
      });
    }

    return activityItems
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [stats.pendingLeaves, stats.pendingReports, studentsPreviewQuery.data, teachersPreviewQuery.data]);

  const isRefreshing =
    statsQuery.isFetching ||
    studentsPreviewQuery.isFetching ||
    teachersPreviewQuery.isFetching ||
    reportsPreviewQuery.isFetching ||
    coursesPreviewQuery.isFetching;

  const lastRefresh = useMemo(() => {
    const latest = Math.max(
      statsQuery.dataUpdatedAt || 0,
      studentsPreviewQuery.dataUpdatedAt || 0,
      teachersPreviewQuery.dataUpdatedAt || 0,
      reportsPreviewQuery.dataUpdatedAt || 0,
      coursesPreviewQuery.dataUpdatedAt || 0,
    );
    // eslint-disable-next-line react-hooks/purity
    return new Date(latest || Date.now());
  }, [
    coursesPreviewQuery.dataUpdatedAt,
    reportsPreviewQuery.dataUpdatedAt,
    statsQuery.dataUpdatedAt,
    studentsPreviewQuery.dataUpdatedAt,
    teachersPreviewQuery.dataUpdatedAt,
  ]);

  const refreshDashboard = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.schoolAdmin.dashboardStats }),
      queryClient.invalidateQueries({ queryKey: queryKeys.schoolAdmin.quickPreviews }),
      queryClient.invalidateQueries({ queryKey: queryKeys.schoolAdmin.studentProgress }),
      queryClient.invalidateQueries({ queryKey: queryKeys.schoolAdmin.notifications }),
    ]);
  }, [queryClient]);

  useDashboardRealtime('school_admin', {
    enabled: true,
    debugLabel: 'school-admin-dashboard',
    customEventMap: {
      'notification:new': [
        queryKeys.schoolAdmin.dashboardStats,
        queryKeys.schoolAdmin.quickPreviews,
        queryKeys.schoolAdmin.recentActivity,
        queryKeys.schoolAdmin.studentProgress,
      ],
      'notification:read': [queryKeys.schoolAdmin.dashboardStats, queryKeys.schoolAdmin.notifications],
      'dashboard:stats': [queryKeys.schoolAdmin.dashboardStats],
    },
    onStats: (payload) => {
      const current = queryClient.getQueryData<DashboardStats>(queryKeys.schoolAdmin.dashboardStats) ?? defaultStats;
      queryClient.setQueryData(queryKeys.schoolAdmin.dashboardStats, {
        totalStudents: Number(payload.totalStudents ?? current.totalStudents),
        totalTeachers: Number(payload.totalTeachers ?? current.totalTeachers),
        activeCourses: Number(payload.activeCourses ?? current.activeCourses),
        pendingReports: Number(payload.pendingReports ?? current.pendingReports),
        pendingLeaves: Number(payload.pendingLeaves ?? current.pendingLeaves),
        averageAttendance: Number(payload.averageAttendance ?? current.averageAttendance),
      } as DashboardStats);
    },
  });

  // Use smart refresh for tab switching
  useSmartRefresh({
    customRefresh: refreshDashboard,
    minRefreshInterval: 60000, // 1 minute minimum between refreshes
  });

  const handleRefresh = async () => {
    await refreshDashboard();
  };

  const handleQuickAction = (route: string) => {
    router.push(route);
  };

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

  const pendingActions = stats.pendingReports + stats.pendingLeaves;
  const schoolAdminStatCards = [
    {
      title: "Total Students",
      value: stats.totalStudents,
      description: "Active enrollments",
      badge: "Active",
      icon: <User className="h-4 w-4" />,
      accentColor: "#2563eb",
      sideMetric: `${stats.totalStudents}`,
      sideLabel: "students",
      info: "Students actively enrolled in this school.",
      numericValue: stats.totalStudents,
    },
    {
      title: "Total Teachers",
      value: stats.totalTeachers,
      description: stats.averageAttendance > 0 ? `${stats.averageAttendance}% attendance rate` : "Assigned teachers",
      badge: stats.averageAttendance > 0 ? `${stats.averageAttendance}% avg` : "Teachers",
      icon: <Users className="h-4 w-4" />,
      accentColor: "#16a34a",
      sideMetric: stats.averageAttendance > 0 ? `${stats.averageAttendance}%` : `${stats.totalTeachers}`,
      sideLabel: stats.averageAttendance > 0 ? "attendance" : "teachers",
      info: "Teachers assigned to this school, with attendance when available.",
      numericValue: stats.totalTeachers,
    },
    {
      title: "Active Courses",
      value: stats.activeCourses,
      description: "Published courses",
      badge: "Published",
      icon: <BookOpen className="h-4 w-4" />,
      accentColor: "#f97316",
      sideMetric: `${stats.activeCourses}`,
      sideLabel: "courses",
      info: "Published courses available to students in this school.",
      numericValue: stats.activeCourses,
    },
    {
      title: "Pending Actions",
      value: pendingActions,
      description: `${stats.pendingReports} reports, ${stats.pendingLeaves} leaves`,
      badge: pendingActions > 0 ? "Action required" : "All clear",
      icon: <AlertCircle className="h-4 w-4" />,
      accentColor: pendingActions > 0 ? "#dc2626" : "#16a34a",
      sideMetric: `${pendingActions}`,
      sideLabel: "pending",
      info: "Reports and leave requests waiting for school admin action.",
      numericValue: pendingActions,
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              {displaySchoolInfo?.name ? `${displaySchoolInfo.name} Admin Panel` : 'School Admin Dashboard'}
            </h1>
            <p className="text-gray-600 mt-2">
              {`Welcome back, ${profileFullName ?? 'School Admin'}`}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-500">
                Last updated: {isMounted ? (() => {
                  const hours = lastRefresh.getHours();
                  const minutes = lastRefresh.getMinutes();
                  const ampm = hours >= 12 ? 'PM' : 'AM';
                  const displayHours = hours % 12 || 12;
                  const displayMinutes = minutes.toString().padStart(2, '0');
                  return `${displayHours}:${displayMinutes} ${ampm}`;
                })() : ''}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {schoolAdminStatCards.map((metric) => (
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b bg-slate-50/80">
                <CardTitle className="flex items-center gap-2">
                  Quick Actions
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                </CardTitle>
                <CardDescription>Common administrative tasks with real-time previews</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {quickActionPreviews.map((preview) => (
                  <div
                    key={preview.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                          {preview.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{preview.title}</p>
                          <p className="text-xs text-slate-500">
                            Updated {new Date(preview.lastUpdated).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuickAction(preview.route)}
                        className="h-8 rounded-md border-slate-200 px-2.5"
                      >
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="mb-3 text-sm leading-relaxed text-slate-600">{preview.description}</p>
                    <div className="space-y-2">
                      {preview.data && preview.data.length > 0 ? (
                        preview.data.slice(0, 2).map((item, index: number) => (
                          <div
                            key={index}
                            className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-2.5 py-2 text-xs"
                          >
                            <span className="truncate text-slate-600">
                              {item.name || item.full_name || item.title || 'Unknown'}
                            </span>
                            <span className="shrink-0 text-slate-400">
                              {new Date(item.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs italic text-slate-400">
                          No recent data
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* School Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  School Status
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                </CardTitle>
                <CardDescription>Current school metrics and health</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Pending Reports</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={stats.pendingReports > 0 ? "destructive" : "secondary"}>
                        {stats.pendingReports}
                      </Badge>
                      {stats.pendingReports > 0 && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Pending Leave Requests</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={stats.pendingLeaves > 0 ? "destructive" : "secondary"}>
                        {stats.pendingLeaves}
                      </Badge>
                      {stats.pendingLeaves > 0 && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total Enrollment</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {stats.totalStudents + stats.totalTeachers}
                      </Badge>
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Active Courses</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-purple-100 text-purple-800">
                        {stats.activeCourses}
                      </Badge>
                      <CheckCircle className="h-4 w-4 text-purple-500" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Recent Activity
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              </CardTitle>
              <CardDescription>Latest system events and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className={`w-2 h-2 rounded-full ${
                        activity.type === 'success' ? 'bg-green-500' :
                        activity.type === 'warning' ? 'bg-yellow-500' :
                        activity.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                      } animate-pulse`}></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.title}</p>
                        <p className="text-xs text-gray-500">{activity.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(activity.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-400">
                          {/* eslint-disable-next-line react-hooks/purity */}
                          {Math.round((Date.now() - new Date(activity.created_at).getTime()) / (1000 * 60))}m ago
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <School className="h-8 w-8 mx-auto mb-2" />
                    <p>No recent activity</p>
                    <p className="text-sm">System events will appear here</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Teacher Reports & Leaves
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              </CardTitle>
              <CardDescription>Review and approve teacher reports and leave requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/lms/school-admin/reports')}>
                  <CardHeader>
                    <CardTitle className="text-lg">Pending Reports</CardTitle>
                    <CardDescription>Teacher reports awaiting approval</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-3xl font-bold text-orange-600">{stats.pendingReports}</div>
                      <p className="text-sm text-gray-600">
                        {stats.pendingReports === 0 
                          ? 'All reports have been reviewed'
                          : `${stats.pendingReports} report(s) need your attention`}
                      </p>
                      <Button 
                        className="w-full" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push('/lms/school-admin/reports');
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Reports
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/lms/school-admin/teachers')}>
                  <CardHeader>
                    <CardTitle className="text-lg">Pending Leaves</CardTitle>
                    <CardDescription>Teacher leave requests awaiting approval</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-3xl font-bold text-red-600">{stats.pendingLeaves}</div>
                      <p className="text-sm text-gray-600">
                        {stats.pendingLeaves === 0 
                          ? 'No pending leave requests'
                          : `${stats.pendingLeaves} leave request(s) need your review`}
                      </p>
                      <Button 
                        className="w-full" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push('/lms/school-admin/teachers?tab=leaves');
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Review Leaves
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

