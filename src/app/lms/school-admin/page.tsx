"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSchoolAdmin } from "@/contexts/SchoolAdminContext";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/student/StatCard";
import NeedsAttentionPanel, { type NeedsAttentionItem } from "@/components/admin/NeedsAttentionPanel";
import {
  Users,
  User,
  BookOpen,
  CalendarCheck,
  ArrowRight,
  RefreshCw,
  Clock,
  CheckCircle,
  ClipboardList,
  School,
} from "lucide-react";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  activeCourses: number;
  pendingReports: number;
  pendingLeaves: number;
  averageAttendance: number;
}

interface PreviewItem {
  id?: string;
  name?: string;
  full_name?: string;
  title?: string;
  created_at: string;
  status?: string;
  email?: string;
}

interface QuickActionPreview {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  data: PreviewItem[];
  loading: boolean;
  /** real fetch time from React Query, not `new Date()` */
  lastUpdated: number;
  route: string;
}

interface RecentActivity {
  id: string;
  title: string;
  message: string;
  created_at: string;
  type: "success" | "warning" | "info" | "error";
}

/** "5m ago" / "3h ago" / "2d ago" — rolls up instead of showing "43200m ago". */
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (!Number.isFinite(minutes)) return "";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const DEFAULT_STATS: DashboardStats = {
  totalStudents: 0,
  totalTeachers: 0,
  activeCourses: 0,
  pendingReports: 0,
  pendingLeaves: 0,
  averageAttendance: 0,
};

interface RawStudent {
  id?: string;
  profile?: { full_name?: string; email?: string };
  enrolled_at?: string;
  created_at?: string;
}
interface RawTeacher {
  id?: string;
  teacher_id?: string;
  teacher?: { full_name?: string; email?: string };
  full_name?: string;
  email?: string;
  assigned_at?: string;
  created_at?: string;
}
interface RawReport {
  id?: string;
  teacher?: { full_name?: string };
  topics_taught?: string;
  created_at?: string;
  date?: string;
}
interface RawCourse {
  id?: string;
  title?: string;
  created_at?: string;
  status?: string;
}

export default function SchoolAdminDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { schoolInfo, profileFullName } = useSchoolAdmin();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Gates client-only time formatting so SSR and first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      return ((res.data as { students?: RawStudent[] })?.students ?? []) as RawStudent[];
    },
  });

  const teachersPreviewQuery = useQuery({
    queryKey: [...queryKeys.schoolAdmin.quickPreviews, "teachers"],
    queryFn: async () => {
      const res = await schoolAdminApi.teachers.list({ limit: 3 });
      return ((res.data as { teachers?: RawTeacher[] })?.teachers ?? []) as RawTeacher[];
    },
  });

  const reportsPreviewQuery = useQuery({
    queryKey: [...queryKeys.schoolAdmin.quickPreviews, "reports"],
    queryFn: async () => {
      const res = await schoolAdminApi.reports.list({ limit: 3, pending: 1 });
      return ((res.data as { reports?: RawReport[] })?.reports ?? []) as RawReport[];
    },
  });

  const coursesPreviewQuery = useQuery({
    queryKey: [...queryKeys.schoolAdmin.quickPreviews, "courses"],
    queryFn: async () => {
      const res = await schoolAdminApi.courses.list({ status: "Published", limit: 3 });
      return ((res.data as { courses?: RawCourse[] })?.courses ?? []) as RawCourse[];
    },
  });

  const stats = statsQuery.data ?? DEFAULT_STATS;
  const statsLoading = statsQuery.isLoading;

  const quickActionPreviews = useMemo<QuickActionPreview[]>(() => {
    const previews: QuickActionPreview[] = [];

    previews.push({
      id: "students",
      title: "Recent Students",
      description: "Latest student enrollments",
      icon: <User className="h-4 w-4" />,
      data: (studentsPreviewQuery.data ?? [])
        .filter((s) => s.enrolled_at || s.created_at)
        .map((s) => ({
          id: s.id,
          full_name: s.profile?.full_name || "Unknown",
          email: s.profile?.email || "",
          created_at: String(s.enrolled_at ?? s.created_at),
        })),
      loading: studentsPreviewQuery.isFetching,
      lastUpdated: studentsPreviewQuery.dataUpdatedAt,
      route: "/lms/school-admin/students",
    });

    previews.push({
      id: "teachers",
      title: "Recent Teachers",
      description: "Latest teacher assignments",
      icon: <Users className="h-4 w-4" />,
      data: (teachersPreviewQuery.data ?? [])
        .filter((t) => t.assigned_at || t.created_at)
        .map((t) => {
          const teacher = t.teacher ?? t;
          return {
            id: t.id,
            full_name: teacher?.full_name || "Unknown",
            email: teacher?.email || "",
            created_at: String(t.assigned_at ?? t.created_at),
          };
        }),
      loading: teachersPreviewQuery.isFetching,
      lastUpdated: teachersPreviewQuery.dataUpdatedAt,
      route: "/lms/school-admin/teachers",
    });

    const recentReports = reportsPreviewQuery.data ?? [];
    if (recentReports.length > 0) {
      previews.push({
        id: "reports",
        title: "Pending Reports",
        description: "Teacher reports awaiting approval",
        icon: <ClipboardList className="h-4 w-4" />,
        data: recentReports
          .filter((r) => r.created_at || r.date)
          .map((r) => ({
            id: r.id,
            full_name: r.teacher?.full_name || "Unknown Teacher",
            name: r.topics_taught?.substring(0, 30) || "Report",
            created_at: String(r.created_at ?? r.date),
            status: "Pending",
          })),
        loading: reportsPreviewQuery.isFetching,
        lastUpdated: reportsPreviewQuery.dataUpdatedAt,
        route: "/lms/school-admin/reports",
      });
    }

    previews.push({
      id: "courses",
      title: "Active Courses",
      description: "Published courses in your school",
      icon: <BookOpen className="h-4 w-4" />,
      data: (coursesPreviewQuery.data ?? [])
        .filter((c) => c.created_at)
        .map((c) => ({
          id: c.id,
          title: c.title,
          created_at: String(c.created_at),
          status: c.status,
        })),
      loading: coursesPreviewQuery.isFetching,
      lastUpdated: coursesPreviewQuery.dataUpdatedAt,
      route: "/lms/school-admin/courses",
    });

    return previews;
  }, [
    coursesPreviewQuery.data, coursesPreviewQuery.isFetching, coursesPreviewQuery.dataUpdatedAt,
    reportsPreviewQuery.data, reportsPreviewQuery.isFetching, reportsPreviewQuery.dataUpdatedAt,
    studentsPreviewQuery.data, studentsPreviewQuery.isFetching, studentsPreviewQuery.dataUpdatedAt,
    teachersPreviewQuery.data, teachersPreviewQuery.isFetching, teachersPreviewQuery.dataUpdatedAt,
  ]);

  /** Only genuinely dated events — pending counts belong in Needs Attention, not here. */
  const recentActivity = useMemo<RecentActivity[]>(() => {
    const items: RecentActivity[] = [];

    (studentsPreviewQuery.data ?? []).slice(0, 3).forEach((s) => {
      const when = s.enrolled_at ?? s.created_at;
      if (!when) return;
      items.push({
        id: `student-${s.id}`,
        title: "New Student Enrollment",
        message: `${s.profile?.full_name || "A student"} enrolled in the school`,
        created_at: String(when),
        type: "success",
      });
    });

    (teachersPreviewQuery.data ?? []).slice(0, 3).forEach((t) => {
      const when = t.assigned_at ?? t.created_at;
      if (!when) return;
      const teacher = t.teacher ?? t;
      items.push({
        id: `teacher-${t.id ?? t.teacher_id}`,
        title: "New Teacher Assignment",
        message: `${teacher?.full_name || "A teacher"} was assigned to the school`,
        created_at: String(when),
        type: "info",
      });
    });

    return items
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [studentsPreviewQuery.data, teachersPreviewQuery.data]);

  const needsAttention = useMemo<NeedsAttentionItem[]>(() => {
    const items: NeedsAttentionItem[] = [];
    if (stats.pendingReports > 0) {
      items.push({
        id: "pending-reports",
        label: `${stats.pendingReports} teacher report${stats.pendingReports !== 1 ? "s" : ""} awaiting approval`,
        count: stats.pendingReports,
        href: "/lms/school-admin/reports",
        tone: "amber",
      });
    }
    if (stats.pendingLeaves > 0) {
      items.push({
        id: "pending-leaves",
        label: `${stats.pendingLeaves} leave request${stats.pendingLeaves !== 1 ? "s" : ""} awaiting review`,
        count: stats.pendingLeaves,
        href: "/lms/school-admin/teachers?tab=leaves",
        tone: "red",
      });
    }
    return items;
  }, [stats.pendingReports, stats.pendingLeaves]);

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
    return latest ? new Date(latest) : null;
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
      "dashboard:stats": [queryKeys.schoolAdmin.dashboardStats],
    },
    onStats: (payload) => {
      const current =
        queryClient.getQueryData<DashboardStats>(queryKeys.schoolAdmin.dashboardStats) ?? DEFAULT_STATS;
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

  useSmartRefresh({
    customRefresh: refreshDashboard,
    minRefreshInterval: 60000,
  });

  const statCards = [
    {
      title: "Total Students",
      value: stats.totalStudents,
      description: "Active enrollments",
      badge: "Active",
      icon: <User className="h-4 w-4" />,
      accentColor: "#2563eb",
      info: "Students actively enrolled in this school.",
      href: "/lms/school-admin/students",
    },
    {
      title: "Total Teachers",
      value: stats.totalTeachers,
      description: "Active teachers",
      badge: "Assigned",
      icon: <Users className="h-4 w-4" />,
      accentColor: "#16a34a",
      info: "Active teacher accounts assigned to this school.",
      href: "/lms/school-admin/teachers",
    },
    {
      title: "Active Courses",
      value: stats.activeCourses,
      description: "Published courses",
      badge: "Published",
      icon: <BookOpen className="h-4 w-4" />,
      accentColor: "#f97316",
      info: "Published courses available to students in this school.",
      href: "/lms/school-admin/courses",
    },
    {
      title: "Avg Attendance",
      value: `${stats.averageAttendance}%`,
      description: "Teacher attendance, last 30 days",
      badge: stats.averageAttendance >= 90 ? "Healthy" : stats.averageAttendance > 0 ? "Watch" : "No data",
      icon: <CalendarCheck className="h-4 w-4" />,
      accentColor: "#0891b2",
      info: "Average teacher attendance across the last 30 days.",
      href: "/lms/school-admin/reports",
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              {schoolInfo?.name ? `${schoolInfo.name} Admin Panel` : "School Admin Dashboard"}
            </h1>
            <p className="text-gray-600 mt-2">{`Welcome back, ${profileFullName ?? "School Admin"}`}</p>
            <div className="flex items-center gap-2 mt-1">
              <div
                className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-gray-300"}`}
              />
              <span className="text-sm text-gray-500">
                {isConnected ? "Live" : "Reconnecting…"}
                {isMounted && lastRefresh
                  ? ` · updated ${lastRefresh.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                  : ""}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={refreshDashboard}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Needs attention — real, actionable counts only */}
      <div className="mb-6">
        <NeedsAttentionPanel items={needsAttention} />
      </div>

      {/* Stats Cards — skeletons while loading (a 0 is a claim, not a loading state) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsLoading
          ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-[120px] w-full rounded-xl" />)
          : statCards.map((metric) => (
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

      <div className="space-y-6">
        {/* Quick Actions */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b bg-slate-50/80">
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks — latest 3 of each</CardDescription>
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
                        {isMounted && preview.lastUpdated
                          ? `Updated ${timeAgo(new Date(preview.lastUpdated).toISOString())}`
                          : " "}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(preview.route)}
                    disabled={preview.loading}
                    className="h-8 rounded-md border-slate-200 px-2.5"
                  >
                    {preview.loading ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <ArrowRight className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <p className="mb-3 text-sm leading-relaxed text-slate-600">{preview.description}</p>
                <div className="space-y-2">
                  {preview.data.length > 0 ? (
                    preview.data.slice(0, 2).map((item, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-2.5 py-2 text-xs"
                      >
                        <span className="truncate text-slate-600">
                          {item.name || item.full_name || item.title || "Unknown"}
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
            <CardTitle>School Status</CardTitle>
            <CardDescription>Current school metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <button
                onClick={() => router.push("/lms/school-admin/reports")}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-50"
              >
                <span className="text-sm font-medium">Pending Reports</span>
                <Badge variant={stats.pendingReports > 0 ? "destructive" : "secondary"}>
                  {stats.pendingReports}
                </Badge>
              </button>
              <button
                onClick={() => router.push("/lms/school-admin/teachers?tab=leaves")}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-50"
              >
                <span className="text-sm font-medium">Pending Leave Requests</span>
                <Badge variant={stats.pendingLeaves > 0 ? "destructive" : "secondary"}>
                  {stats.pendingLeaves}
                </Badge>
              </button>
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm font-medium">Total People</span>
                <Badge variant="outline">{stats.totalStudents + stats.totalTeachers}</Badge>
              </div>
              <div className="flex items-center justify-between px-2 py-1.5">
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

        {/* Recent Activity — real dated events only */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest enrollments and teacher assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        activity.type === "success"
                          ? "bg-green-500"
                          : activity.type === "warning"
                          ? "bg-yellow-500"
                          : activity.type === "error"
                          ? "bg-red-500"
                          : "bg-blue-500"
                      }`}
                    />
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
                        {isMounted ? timeAgo(activity.created_at) : ""}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <School className="h-8 w-8 mx-auto mb-2" />
                  <p>No recent activity</p>
                  <p className="text-sm">New enrollments and assignments will appear here</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
