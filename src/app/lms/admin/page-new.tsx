"use client";

import { useState, useEffect, useCallback, Suspense, lazy } from "react";
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
  AlertTriangle
} from "lucide-react";
import CreateAccountDialog from "@/components/admin/CreateAccountDialog";
import { AdminTabErrorBoundary } from "@/components/admin/AdminTabErrorBoundary";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { SkeletonDashboard } from "@/components/ui/skeleton-dashboard";
import { adminApi, commonApi, setAuthToken } from "@/lib/api";
import { getSession, getStoredUserId } from "@/lib/session-utils";
import { useAdminSchools, type AdminSchoolItem } from "@/hooks/useAdminSchools";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { queryKeys } from "@/lib/query-keys";

// Lazy-load on first visit but keep mounted after to avoid re-render flash on tab switch
const AdminOverviewTab = lazy(() => import("@/components/admin/AdminOverviewTab"));
const AdminReportsTab = lazy(() => import("@/components/admin/AdminReportsTab"));

// Enhanced interfaces for real-time data
interface DashboardStats {
  totalSchools: number;
  totalTeachers: number;
  totalStudents: number;
  activeCourses: number;
  pendingLeaves: number;
  systemHealth: number;
  avgAttendance: number;
  completionRate: number;
  activeUsers: number;
  pendingPasswordResets: number;
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
}

interface RecentActivity {
  id: string;
  title: string;
  message: string;
  created_at: string;
  type: 'success' | 'warning' | 'info' | 'error';
}


const buildFallbackRecentActivity = (
  previews: QuickActionPreview[],
  stats: DashboardStats,
): RecentActivity[] => {
  const nowIso = new Date().toISOString();
  const activityItems: RecentActivity[] = [];

  previews.forEach((preview) => {
    preview.data.slice(0, 1).forEach((item, index) => {
      const actor = item.name || item.full_name || item.title || 'Record';
      const noun = preview.title.replace(/^Recent\s+/i, '');
      activityItems.push({
        id: `${preview.id}-${item.id ?? index}-${item.created_at || nowIso}`,
        title: `${noun} Update`,
        message: `${actor} was added to ${noun.toLowerCase()}.`,
        created_at: item.created_at || nowIso,
        type: 'info',
      });
    });
  });

  if (stats.pendingLeaves > 0) {
    activityItems.push({
      id: 'pending-leaves-fallback',
      title: 'Pending Leave Requests',
      message: `${stats.pendingLeaves} leave request(s) awaiting review.`,
      created_at: nowIso,
      type: 'warning',
    });
  }

  if (stats.pendingPasswordResets > 0) {
    activityItems.push({
      id: 'pending-password-resets-fallback',
      title: 'Pending Password Resets',
      message: `${stats.pendingPasswordResets} password reset request(s) awaiting action.`,
      created_at: nowIso,
      type: 'warning',
    });
  }

  return activityItems
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);
};


export default function AdminDashboard() {
  const router = useRouter();
  
  const [stats, setStats] = useState<DashboardStats>({
    totalSchools: 0,
    totalTeachers: 0,
    totalStudents: 0,
    activeCourses: 0,
    pendingLeaves: 0,
    systemHealth: 99.9,
    avgAttendance: 0,
    completionRate: 0,
    activeUsers: 0,
    pendingPasswordResets: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [quickActionPreviews, setQuickActionPreviews] = useState<QuickActionPreview[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isMounted, setIsMounted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isCreateAccountDialogOpen, setIsCreateAccountDialogOpen] = useState(false);
  const [adminName, setAdminName] = useState<string>('');
  const [teacherPerformance, setTeacherPerformance] = useState({ excellent: 0, good: 0, average: 0, needsImprovement: 0 });
  const [inactiveSchoolCount, setInactiveSchoolCount] = useState(0);
  const [activeTab, setActiveTab] = useState<string>('overview');
  // Track which tabs have been visited so we only Suspense-load each once
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set(['overview']));
  const { schools: schoolsFromHook } = useAdminSchools();

  useEffect(() => {
    try {
      setIsMounted(true);
     
    } catch (error: unknown) {
      console.error('❌ Error in useEffect:', error);
      setHasError(true);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(errorMessage);
    }
  }, []);
  
  // Monthly trends for stats cards
  const [monthlyTrends, setMonthlyTrends] = useState<Array<{name: string; value: number; change: number}>>([]);

  const loadDashboardData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Ensure token is in storage before any admin API call (avoids 401 when layout and children race)
      const { data: sessionData } = await getSession();
      if (sessionData?.session?.access_token) {
        setAuthToken(sessionData.session.access_token);
      } else {
        return;
      }

      // Resolve the admin's real display name in the background (non-blocking)
      const userId = getStoredUserId();
      if (userId) {
        commonApi.profile.get({ userId }).then(({ data }) => {
          const name = (data as { profile?: { full_name?: string; fullName?: string } })?.profile?.full_name
            ?? (data as { profile?: { full_name?: string; fullName?: string } })?.profile?.fullName
            ?? sessionData.session?.user?.email
            ?? '';
          if (name) setAdminName(name);
        }).catch(() => {
          setAdminName(sessionData.session?.user?.email ?? '');
        });
      }

      // Default stats to prevent blank screen
      let newStats: DashboardStats = {
        totalSchools: 0,
        totalTeachers: 0,
        totalStudents: 0,
        activeCourses: 0,
        pendingLeaves: 0,
        systemHealth: 0,
        avgAttendance: 0,
        completionRate: 0,
        activeUsers: 0,
        pendingPasswordResets: 0,
      };
      
      try {
        const { data } = await adminApi.dashboard.stats();
        // BUGFIX (HIGH-06): Safely handle API response with proper null checks
        const raw = (data?.stats ?? data ?? {}) as Partial<DashboardStats>;
        
        newStats = {
          totalSchools: raw.totalSchools ?? 0,
          totalTeachers: raw.totalTeachers ?? 0,
          totalStudents: raw.totalStudents ?? 0,
          activeCourses: raw.activeCourses ?? 0,
          pendingLeaves: raw.pendingLeaves ?? 0,
          systemHealth: 0,
          avgAttendance: 0,
          completionRate: 0,
          activeUsers: (raw.totalTeachers ?? 0) + (raw.totalStudents ?? 0),
          pendingPasswordResets: 0,
        };
      } catch (fetchError) {
        console.error('Error fetching stats:', fetchError);
        // Use default stats - component will still render
      }
      
      // Also fetch analytics for real avgAttendance, completionRate, and month-over-month trends
      try {
        const { data: analyticsData } = await adminApi.dashboard.analytics();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const analytics = (analyticsData as any)?.analytics ?? {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const trends = (analyticsData as any)?.trends ?? {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const perf = (analyticsData as any)?.teacherPerformance;
        if (perf) setTeacherPerformance(perf);
        newStats = {
          ...newStats,
          avgAttendance: analytics.avgAttendance ?? newStats.avgAttendance,
          completionRate: analytics.completionRate ?? newStats.completionRate,
          systemHealth: analytics.systemHealth ?? newStats.systemHealth,
        };
        setMonthlyTrends([
          { name: "Schools", value: newStats.totalSchools, change: trends.schoolsChange ?? 0 },
          { name: "Teachers", value: newStats.totalTeachers, change: trends.teachersChange ?? 0 },
          { name: "Students", value: newStats.totalStudents, change: trends.studentsChange ?? 0 },
          { name: "Courses", value: newStats.activeCourses, change: trends.coursesChange ?? 0 },
        ]);
      } catch (analyticsErr) {
        console.warn('Analytics data unavailable — showing static counts without trends:', analyticsErr);
        setMonthlyTrends([
          { name: "Schools", value: newStats.totalSchools, change: 0 },
          { name: "Teachers", value: newStats.totalTeachers, change: 0 },
          { name: "Students", value: newStats.totalStudents, change: 0 },
          { name: "Courses", value: newStats.activeCourses, change: 0 },
        ]);
        setErrorMessage('Analytics data could not be loaded. Trend percentages may be unavailable.');
      }

      // Fetch pending password resets non-blocking
      adminApi.passwordResetRequests.pendingCount()
        .then(({ data }) => {
          const count = (data as { count?: number })?.count ?? 0;
          setStats((prev) => ({ ...prev, pendingPasswordResets: count }));
        })
        .catch(() => {});

      // Always set stats (even if API failed) to prevent blank screen
      setStats(newStats);

      let resolvedRecentActivity: RecentActivity[] = [];


      // Load quick action previews immediately (needed for Overview tab)
      let loadedPreviews: QuickActionPreview[] = [];
      try {
        loadedPreviews = await loadQuickActionPreviews(schoolsFromHook).catch((error: unknown) => {
          console.error('Error loading quick action previews:', error);
          return [] as QuickActionPreview[];
        });
      } catch (error) {
        console.error('Error loading dashboard components:', error);
        loadedPreviews = [];
      }

      if (resolvedRecentActivity.length > 0) {
        setRecentActivity(resolvedRecentActivity);
      } else {
        setRecentActivity(buildFallbackRecentActivity(loadedPreviews, newStats));
      }
      
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Always set default stats to prevent blank screen
      setStats({
        totalSchools: 0,
        totalTeachers: 0,
        totalStudents: 0,
        activeCourses: 0,
        pendingLeaves: 0,
        systemHealth: 0,
        avgAttendance: 0,
        completionRate: 0,
        activeUsers: 0,
        pendingPasswordResets: 0,
      });
    } finally {
      setIsRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- loadQuickActionPreviews is stable, avoid circular deps
  }, []);

  useDashboardRealtime('admin', {
    enabled: true,
    debugLabel: 'admin-dashboard',
    customEventMap: {
      'notification:new': [queryKeys.admin.dashboardStats, queryKeys.admin.recentActivity, queryKeys.admin.studentProgress],
      'notification:read': [queryKeys.admin.dashboardStats, queryKeys.admin.studentProgress],
      'dashboard:stats': [queryKeys.admin.dashboardStats],
    },
    onStats: (payload) => {
      setStats((prev) => ({
        ...prev,
        ...(payload as Partial<DashboardStats>),
      }));
      setLastRefresh(new Date());
    },
    onEvent: ({ eventType }) => {
      if (eventType === 'notification:new' || eventType === 'notification:read' || eventType === 'dashboard:stats') {
        setLastRefresh(new Date());
      }
    },
  });


  const loadQuickActionPreviews = useCallback(async (_schoolsData: AdminSchoolItem[] | undefined): Promise<QuickActionPreview[]> => {
    const previews: QuickActionPreview[] = [];

    // Fetch all four previews in parallel — schools included directly to avoid race with hook
    const [
      schoolsResponse,
      teachersResponse,
      studentsResponse,
      coursesResponse
    ] = await Promise.allSettled([
      adminApi.schools.list(),
      adminApi.teachers.list(),
      adminApi.students.list(),
      adminApi.courses.list()
    ]);

    // Process schools preview
    if (schoolsResponse.status === 'fulfilled') {
      try {
        const d = schoolsResponse.value.data;
        const raw: Record<string, unknown>[] = Array.isArray(d) ? d : (Array.isArray(d?.schools) ? d.schools : []);
        const inactive = raw.filter(s => s.isActive === false).length;
        if (inactive > 0) setInactiveSchoolCount(inactive);
        const recentSchools = raw
          .slice()
          .sort((a, b) => new Date(String(b.createdAt ?? b.created_at ?? 0)).getTime() - new Date(String(a.createdAt ?? a.created_at ?? 0)).getTime())
          .slice(0, 3)
          .map(s => ({ id: String(s.id ?? ''), name: String(s.name ?? ''), created_at: String(s.createdAt ?? s.created_at ?? '') }));
        previews.push({ id: 'schools', title: 'Recent Schools', description: 'Latest registered schools', icon: <School className="h-4 w-4" />, data: recentSchools, loading: false, lastUpdated: new Date().toISOString() });
      } catch {
        previews.push({ id: 'schools', title: 'Recent Schools', description: 'Latest registered schools', icon: <School className="h-4 w-4" />, data: [], loading: false, lastUpdated: new Date().toISOString() });
      }
    } else {
      previews.push({ id: 'schools', title: 'Recent Schools', description: 'Latest registered schools', icon: <School className="h-4 w-4" />, data: [], loading: false, lastUpdated: new Date().toISOString() });
    }

    // Process teachers preview
    if (teachersResponse.status === 'fulfilled') {
      try {
        const responseData = teachersResponse.value.data;
        // Handle both pagination formats: {teachers: [...]} or {data: [...]}
        const teachers = responseData.teachers || responseData.data || responseData || [];
        
        if (!Array.isArray(teachers)) {
          console.warn('Teachers API returned non-array data:', responseData);
        }
        
        // API returns camelCase: { id, name, email, createdAt }
        const teacherData = Array.isArray(teachers) ? teachers.slice(0, 3).map((t: Record<string, unknown>) => ({
          id: String(t.id ?? ''),
          full_name: String(t.name ?? t.full_name ?? t.fullName ?? ''),
          email: String(t.email ?? ''),
          created_at: String(t.createdAt ?? t.created_at ?? '')
        })) : [];
        
        previews.push({
          id: 'teachers',
          title: 'Recent Teachers',
          description: 'Latest teacher registrations',
          icon: <Users className="h-4 w-4" />,
          data: teacherData,
          loading: false,
          lastUpdated: new Date().toISOString()
        });
      } catch (error) {
        console.error('Teachers preview unavailable:', error);
        // Still add the preview card but with empty data so UI doesn't break
        previews.push({
          id: 'teachers',
          title: 'Recent Teachers',
          description: 'Latest teacher registrations',
          icon: <Users className="h-4 w-4" />,
          data: [],
          loading: false,
          lastUpdated: new Date().toISOString()
        });
      }
    } else if (teachersResponse.status === 'rejected') {
      console.error('Teachers API request failed:', teachersResponse.reason);
    }

    // Process students preview
    if (studentsResponse.status === 'fulfilled') {
      try {
        const responseData = studentsResponse.value.data;
        // Handle both pagination formats: {students: [...]} or {data: [...]}
        const students = responseData.students || responseData.data || responseData || [];
        
        if (!Array.isArray(students)) {
          console.warn('Students API returned non-array data:', responseData);
        }
        
        // Normalise both camelCase and snake_case from API
        const studentData = Array.isArray(students) ? students.slice(0, 3).map((s: Record<string, unknown>) => ({
          id: String(s.id ?? ''),
          full_name: String(s.full_name ?? s.fullName ?? s.name ?? ''),
          email: String(s.email ?? ''),
          created_at: String(s.createdAt ?? s.created_at ?? '')
        })) : [];
        
        previews.push({
          id: 'students',
          title: 'Recent Students',
          description: 'Latest student enrollments',
          icon: <User className="h-4 w-4" />,
          data: studentData,
          loading: false,
          lastUpdated: new Date().toISOString()
        });
      } catch (error) {
        console.error('Students preview unavailable:', error);
        // Still add the preview card but with empty data so UI doesn't break
        previews.push({
          id: 'students',
          title: 'Recent Students',
          description: 'Latest student enrollments',
          icon: <User className="h-4 w-4" />,
          data: [],
          loading: false,
          lastUpdated: new Date().toISOString()
        });
      }
    } else if (studentsResponse.status === 'rejected') {
      console.error('Students API request failed:', studentsResponse.reason);
    }

    // Process courses preview
    if (coursesResponse.status === 'fulfilled') {
      try {
        const responseData = coursesResponse.value.data;
        // Handle both pagination formats: {courses: [...]} or {data: [...]}
        const courses = responseData.courses || responseData.data || responseData || [];
        
        if (!Array.isArray(courses)) {
          console.warn('Courses API returned non-array data:', responseData);
        }
        
        // Normalise both camelCase and snake_case from API
        const courseData = Array.isArray(courses) ? courses.slice(0, 3).map((c: Record<string, unknown>) => ({
          id: String(c.id ?? ''),
          title: String(c.title ?? c.course_name ?? c.name ?? ''),
          status: String(c.status ?? c.isPublished ? 'published' : 'draft'),
          created_at: String(c.createdAt ?? c.created_at ?? '')
        })) : [];
        
        previews.push({
          id: 'courses',
          title: 'Recent Courses',
          description: 'Latest course publications',
          icon: <BookOpen className="h-4 w-4" />,
          data: courseData,
          loading: false,
          lastUpdated: new Date().toISOString()
        });
      } catch (error) {
        console.error('Courses preview unavailable:', error);
        // Still add the preview card but with empty data so UI doesn't break
        previews.push({
          id: 'courses',
          title: 'Recent Courses',
          description: 'Latest course publications',
          icon: <BookOpen className="h-4 w-4" />,
          data: [],
          loading: false,
          lastUpdated: new Date().toISOString()
        });
      }
    } else if (coursesResponse.status === 'rejected') {
      console.error('Courses API request failed:', coursesResponse.reason);
    }

      setQuickActionPreviews(previews);
      return previews;
  }, []);


  useEffect(() => {
    // Initial load and when schools cache updates (so Recent Schools preview populates)
    loadDashboardData();
  }, [loadDashboardData, schoolsFromHook]);

  // Use smart refresh for tab switching
  useSmartRefresh({
    customRefresh: loadDashboardData,
    minRefreshInterval: 60000, // 1 minute minimum between refreshes
  });

  const handleRefresh = async () => {
    await loadDashboardData();
  };

  const handleQuickAction = async (actionId: string) => {
    // Navigate to the appropriate management page
    const routes: Record<string, string> = {
      'schools': '/lms/admin/schools',
      'teachers': '/lms/admin/teachers',
      'students': '/lms/admin/students',
      'courses': '/lms/admin/courses'
    };

    if (routes[actionId]) {
      router.push(routes[actionId]);
    } else {
      // Fallback: refresh preview data
      const previewIndex = quickActionPreviews.findIndex(p => p.id === actionId);
      if (previewIndex !== -1) {
        const updatedPreviews = [...quickActionPreviews];
        updatedPreviews[previewIndex].loading = true;
        setQuickActionPreviews(updatedPreviews);

        setTimeout(async () => {
          await loadQuickActionPreviews(schoolsFromHook);
        }, 1000);
      }
    }
  };

  // If there's an error, show error message
  if (hasError) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-semibold mb-2">Error Loading Dashboard</h2>
          <p className="text-red-700">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // Safety check - ensure component always renders something
  if (!isMounted) {
    return (
      <div className="p-8" style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  const trendText = (name: string) => {
    const change = monthlyTrends.find(t => t.name === name)?.change;
    return change ? `${change > 0 ? '+' : ''}${change}% from last month` : 'No change this month';
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

  const overviewStatCards = [
    {
      title: "Total Schools",
      value: stats.totalSchools,
      description: trendText("Schools"),
      badge: "Active",
      icon: <School className="h-4 w-4" />,
      accentColor: "#16a34a",
      sideMetric: `${stats.totalSchools}`,
      sideLabel: "schools",
      info: "Total active schools registered in the admin system.",
      numericValue: stats.totalSchools,
    },
    {
      title: "Total Teachers",
      value: stats.totalTeachers,
      description: trendText("Teachers"),
      badge: stats.avgAttendance > 0 ? `${stats.avgAttendance}% attendance` : "Teachers",
      icon: <Users className="h-4 w-4" />,
      accentColor: "#2563eb",
      sideMetric: stats.avgAttendance > 0 ? `${stats.avgAttendance}%` : `${stats.totalTeachers}`,
      sideLabel: stats.avgAttendance > 0 ? "attendance" : "teachers",
      info: "Total active teachers, with attendance shown when available.",
      numericValue: stats.totalTeachers,
    },
    {
      title: "Total Students",
      value: stats.totalStudents,
      description: trendText("Students"),
      badge: stats.completionRate > 0 ? `${stats.completionRate}% completion` : "Students",
      icon: <User className="h-4 w-4" />,
      accentColor: "#9333ea",
      sideMetric: stats.completionRate > 0 ? `${stats.completionRate}%` : `${stats.totalStudents}`,
      sideLabel: stats.completionRate > 0 ? "complete" : "students",
      info: "Total active students, with course completion shown when available.",
      numericValue: stats.totalStudents,
    },
    {
      title: "Active Courses",
      value: stats.activeCourses,
      description: trendText("Courses"),
      badge: "Published",
      icon: <BookOpen className="h-4 w-4" />,
      accentColor: "#f97316",
      sideMetric: `${stats.activeCourses}`,
      sideLabel: "courses",
      info: "Published courses currently available on the platform.",
      numericValue: stats.activeCourses,
    },
    {
      title: "Pending Leaves",
      value: stats.pendingLeaves,
      description: "Teacher leave requests",
      badge: stats.pendingLeaves > 0 ? "Needs review" : "All clear",
      icon: <AlertTriangle className="h-4 w-4" />,
      accentColor: stats.pendingLeaves > 0 ? "#f59e0b" : "#16a34a",
      sideMetric: `${stats.pendingLeaves}`,
      sideLabel: stats.pendingLeaves > 0 ? "pending" : "clear",
      info: "Teacher leave requests waiting for admin review.",
      numericValue: stats.pendingLeaves,
      className: stats.pendingLeaves > 0 ? "border-amber-300 bg-amber-50" : undefined,
    },
  ];

  return (
        <div className="p-4 md:p-6 lg:p-8" style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
          {/* Header */}
          <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">Welcome back, {adminName || 'Admin'}</p>
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
              onClick={() => router.push('/lms/admin/schools?action=add')}
              className="flex items-center gap-2"
            >
              <School className="h-4 w-4" />
              Add School
            </Button>
            <Button
              onClick={() => setIsCreateAccountDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Create Account
            </Button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
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
                className={metric.className}
                data={makeSparklineData(metric.numericValue)}
              />
            ))}
          </div>

          {/* Main Content Tabs — tabs stay mounted after first visit to prevent re-render flash */}
          <Tabs value={activeTab} onValueChange={(tab) => {
            setActiveTab(tab);
            setMountedTabs(prev => new Set([...prev, tab]));
          }} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" forceMount className={activeTab !== 'overview' ? 'hidden' : 'space-y-6'}>
              {mountedTabs.has('overview') && (
                <AdminTabErrorBoundary tabName="Overview">
                  <Suspense fallback={<SkeletonDashboard />}>
                    <AdminOverviewTab
                      stats={stats}
                      quickActionPreviews={quickActionPreviews}
                      recentActivity={recentActivity}
                      isLoading={isRefreshing}
                      onQuickAction={handleQuickAction}
                      teacherPerformance={teacherPerformance}
                      inactiveSchoolCount={inactiveSchoolCount}
                    />
                  </Suspense>
                </AdminTabErrorBoundary>
              )}
            </TabsContent>

            <TabsContent value="reports" forceMount className={activeTab !== 'reports' ? 'hidden' : 'space-y-6'}>
              {mountedTabs.has('reports') && (
                <AdminTabErrorBoundary tabName="Reports">
                  <Suspense fallback={<SkeletonDashboard />}>
                    <AdminReportsTab stats={stats} lastRefresh={lastRefresh} isLoading={isRefreshing} />
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




