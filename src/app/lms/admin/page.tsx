"use client";

import { useState, Suspense, lazy, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChartAnalyticsCard } from "@/components/ui/area-chart-analytics-card";
import {
  RefreshCw,
  UserPlus,
  School,
  Users,
  User,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import CreateAccountDialog from "@/components/admin/CreateAccountDialog";
import { AdminTabErrorBoundary } from "@/components/admin/AdminTabErrorBoundary";
import NeedsAttentionPanel from "@/components/admin/NeedsAttentionPanel";
import { SkeletonDashboard } from "@/components/ui/skeleton-dashboard";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { queryKeys } from "@/lib/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminDashboardStats,
  useAdminQuickPreviews,
  useAdminNeedsAttention,
  useAdminName,
  type MonthlyGrowthPoint,
  type QuickPreviewGroup,
} from "@/hooks/useAdminDashboard";

const AdminOverviewTab = lazy(() => import("@/components/admin/AdminOverviewTab"));
const AdminReportsTab = lazy(() => import("@/components/admin/AdminReportsTab"));

interface RecentActivity {
  id: string;
  title: string;
  message: string;
  created_at: string;
  type: "success" | "warning" | "info" | "error";
}

/** Only real, dated events (recent school/teacher/student/course creations) —
 * no fabricated "just now" alert items. */
function buildRecentActivity(previews: QuickPreviewGroup[]): RecentActivity[] {
  const items: RecentActivity[] = [];
  for (const group of previews) {
    for (const item of group.data) {
      if (!item.created_at) continue;
      const actor = item.name || item.full_name || item.title || "Record";
      const noun = group.title.replace(/^Recent\s+/i, "");
      items.push({
        id: `${group.id}-${item.id ?? actor}-${item.created_at}`,
        title: `${noun.replace(/s$/, "")} added`,
        message: `${actor} was added to ${noun.toLowerCase()}.`,
        created_at: item.created_at,
        type: "info",
      });
    }
  }
  return items
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);
}

/** Real per-metric growth series from the backend's monthlyGrowth aggregation
 * (last 6 months) — replaces the previous sine-wave-fabricated sparkline. */
function seriesFor(monthlyGrowth: MonthlyGrowthPoint[], key: "schools" | "teachers" | "students" | "courses") {
  return monthlyGrowth.map((m) => ({ label: m.name, value: m[key] }));
}

const PREVIEW_ICON: Record<QuickPreviewGroup["id"], LucideIcon> = {
  schools: School,
  teachers: Users,
  students: User,
  courses: BookOpen,
};

/** AdminOverviewTab expects icon/loading/lastUpdated per group — built here so
 * the data hook itself stays free of JSX. */
function toTabPreviews(previews: QuickPreviewGroup[], fetchedAt: string) {
  return previews.map((group) => {
    const Icon = PREVIEW_ICON[group.id];
    return {
      id: group.id,
      title: group.title,
      description: group.description,
      icon: <Icon className="h-4 w-4" />,
      data: group.data,
      loading: false,
      lastUpdated: fetchedAt,
    };
  });
}

export default function AdminDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateAccountDialogOpen, setIsCreateAccountDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set(["overview"]));

  const { data: adminName } = useAdminName();
  const { data: dashboardData, isLoading: statsLoading } = useAdminDashboardStats();
  const { data: previewsData, isLoading: previewsLoading, dataUpdatedAt: previewsUpdatedAt } = useAdminQuickPreviews();
  const { data: needsAttention = [] } = useAdminNeedsAttention();

  const stats = dashboardData?.stats;
  const monthlyGrowth = useMemo(() => dashboardData?.monthlyGrowth ?? [], [dashboardData]);
  const teacherPerformance = dashboardData?.teacherPerformance;
  const quickActionPreviews = useMemo(() => previewsData?.previews ?? [], [previewsData]);

  const recentActivity = useMemo(() => buildRecentActivity(quickActionPreviews), [quickActionPreviews]);
  const tabPreviews = useMemo(
    () => toTabPreviews(quickActionPreviews, new Date(previewsUpdatedAt || Date.now()).toISOString()),
    [quickActionPreviews, previewsUpdatedAt],
  );

  const { isConnected } = useDashboardRealtime("admin", {
    enabled: true,
    debugLabel: "admin-dashboard",
    customEventMap: {
      "notification:new": [queryKeys.admin.dashboardStats, queryKeys.admin.recentActivity, queryKeys.admin.studentProgress],
      "notification:read": [queryKeys.admin.dashboardStats, queryKeys.admin.studentProgress],
      "dashboard:stats": [queryKeys.admin.dashboardStats],
    },
  });

  const isLoading = statsLoading || previewsLoading;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboardStats }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.quickPreviews }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.needsAttention }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleQuickAction = async (actionId: string) => {
    const routes: Record<string, string> = {
      schools: "/lms/admin/schools",
      teachers: "/lms/admin/teachers",
      students: "/lms/admin/students",
      courses: "/lms/admin/courses",
    };
    if (routes[actionId]) {
      router.push(routes[actionId]);
    } else {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.quickPreviews });
    }
  };

  const trendText = (monthKey: "schools" | "teachers" | "students" | "courses") => {
    const series = monthlyGrowth;
    const cur = series[series.length - 1]?.[monthKey] ?? 0;
    const prev = series[series.length - 2]?.[monthKey] ?? 0;
    if (prev === 0) return cur > 0 ? "New activity this month" : "No change this month";
    const change = Math.round(((cur - prev) / prev) * 100);
    return change ? `${change > 0 ? "+" : ""}${change}% from last month` : "No change this month";
  };

  // The chart's own caption always talks about "this month" — the side box
  // next to it must show that same month's real new-signup count, not an
  // unrelated platform-wide metric (previously: attendance %/completion %
  // reused here, or the card's own running total repeated verbatim).
  const newThisMonth = (monthKey: "schools" | "teachers" | "students" | "courses") =>
    monthlyGrowth[monthlyGrowth.length - 1]?.[monthKey] ?? 0;

  if (isLoading || !stats) {
    return <SkeletonDashboard />;
  }

  const overviewStatCards = [
    {
      title: "Total Schools",
      value: stats.totalSchools,
      description: trendText("schools"),
      badge: "Active",
      icon: <School className="h-4 w-4" />,
      accentColor: "#16a34a",
      sideMetric: `${newThisMonth("schools")}`,
      sideLabel: "new this month",
      info: "Total active schools registered in the admin system.",
      href: "/lms/admin/schools",
      data: seriesFor(monthlyGrowth, "schools"),
    },
    {
      title: "Total Teachers",
      value: stats.totalTeachers,
      description: trendText("teachers"),
      badge: stats.avgAttendance > 0 ? `${stats.avgAttendance}% attendance` : "Teachers",
      icon: <Users className="h-4 w-4" />,
      accentColor: "#2563eb",
      sideMetric: `${newThisMonth("teachers")}`,
      sideLabel: "new this month",
      info: "Total active teachers, with attendance shown when available.",
      href: "/lms/admin/teachers",
      data: seriesFor(monthlyGrowth, "teachers"),
    },
    {
      title: "Total Students",
      value: stats.totalStudents,
      description: trendText("students"),
      badge: stats.completionRate > 0 ? `${stats.completionRate}% completion` : "Students",
      icon: <User className="h-4 w-4" />,
      accentColor: "#9333ea",
      sideMetric: `${newThisMonth("students")}`,
      sideLabel: "new this month",
      info: "Total active students, with course completion shown when available.",
      href: "/lms/admin/students",
      data: seriesFor(monthlyGrowth, "students"),
    },
    {
      title: "Active Courses",
      value: stats.activeCourses,
      description: trendText("courses"),
      badge: "Published",
      icon: <BookOpen className="h-4 w-4" />,
      accentColor: "#f97316",
      sideMetric: `${newThisMonth("courses")}`,
      sideLabel: "new this month",
      info: "Published courses currently available on the platform.",
      href: "/lms/admin/courses",
      data: seriesFor(monthlyGrowth, "courses"),
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8" style={{ minHeight: "100vh", backgroundColor: "#f9fafb" }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">Welcome back, {adminName || "Admin"}</p>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-gray-300"}`}></div>
              <span className="text-sm text-gray-500">{isConnected ? "Live" : "Reconnecting…"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/lms/admin/schools?action=add")}
              className="flex items-center gap-2"
            >
              <School className="h-4 w-4" />
              Add School
            </Button>
            <Button onClick={() => setIsCreateAccountDialogOpen(true)} className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Create Account
            </Button>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>
      </div>

      {/* Needs attention — real, actionable counts only */}
      <div className="mb-6">
        <NeedsAttentionPanel items={needsAttention} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {overviewStatCards.map((metric) => (
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
            href={metric.href}
            data={metric.data}
          />
        ))}
      </div>

      {/* Main Content Tabs — tabs stay mounted after first visit to prevent re-render flash */}
      <Tabs
        value={activeTab}
        onValueChange={(tab) => {
          setActiveTab(tab);
          setMountedTabs((prev) => new Set([...prev, tab]));
        }}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" forceMount className={activeTab !== "overview" ? "hidden" : "space-y-6"}>
          {mountedTabs.has("overview") && (
            <AdminTabErrorBoundary tabName="Overview">
              <Suspense fallback={<SkeletonDashboard />}>
                <AdminOverviewTab
                  stats={stats}
                  quickActionPreviews={tabPreviews}
                  recentActivity={recentActivity}
                  isLoading={false}
                  onQuickAction={handleQuickAction}
                  teacherPerformance={teacherPerformance}
                />
              </Suspense>
            </AdminTabErrorBoundary>
          )}
        </TabsContent>

        <TabsContent value="reports" forceMount className={activeTab !== "reports" ? "hidden" : "space-y-6"}>
          {mountedTabs.has("reports") && (
            <AdminTabErrorBoundary tabName="Reports">
              <Suspense fallback={<SkeletonDashboard />}>
                <AdminReportsTab
                  stats={stats}
                  monthlyGrowth={monthlyGrowth}
                  needsAttention={needsAttention}
                  isLoading={false}
                />
              </Suspense>
            </AdminTabErrorBoundary>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Account Dialog */}
      <CreateAccountDialog
        isOpen={isCreateAccountDialogOpen}
        onClose={() => setIsCreateAccountDialogOpen(false)}
        onSuccess={() => {
          handleRefresh();
          setIsCreateAccountDialogOpen(false);
        }}
      />
    </div>
  );
}
