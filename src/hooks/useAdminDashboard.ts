/**
 * Admin dashboard data hooks - React Query based.
 *
 * Consolidates what page-new.tsx used to hand-roll with useState/useCallback
 * into cached, invalidatable queries — mirrors the student dashboard pattern
 * (see hooks/useStudentData.ts).
 */

import { useQuery } from "@tanstack/react-query";
import { adminApi, commonApi, setAuthToken } from "../lib/api";
import { getSession, getStoredUserId } from "../lib/session-utils";
import { queryKeys } from "../lib/query-keys";
// The type is owned by the panel component so both dashboards can share it.
import type { NeedsAttentionItem } from "../components/admin/NeedsAttentionPanel";

export type { NeedsAttentionItem };

async function ensureAccessToken(): Promise<string | null> {
  const { data } = await getSession();
  const token = data.session?.access_token ?? null;
  if (token) setAuthToken(token);
  return token;
}

export interface AdminDashboardStats {
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

export interface MonthlyGrowthPoint {
  name: string;
  schools: number;
  teachers: number;
  students: number;
  courses: number;
}

export interface TeacherPerformance {
  excellent: number;
  good: number;
  average: number;
  needsImprovement: number;
}

export function useAdminName() {
  return useQuery({
    queryKey: ["adminName"],
    queryFn: async () => {
      const { data: sessionData } = await getSession();
      const userId = getStoredUserId();
      if (!userId) return sessionData.session?.user?.email ?? "";
      try {
        const { data } = await commonApi.profile.get({ userId });
        const profile = (data as { profile?: { full_name?: string; fullName?: string } })?.profile;
        return profile?.full_name ?? profile?.fullName ?? sessionData.session?.user?.email ?? "";
      } catch {
        return sessionData.session?.user?.email ?? "";
      }
    },
    staleTime: 5 * 60_000,
  });
}

/** Real stats + analytics combined (the fields the old page merged by hand). */
export function useAdminDashboardStats() {
  return useQuery({
    queryKey: queryKeys.admin.dashboardStats,
    queryFn: async (): Promise<{
      stats: AdminDashboardStats;
      monthlyGrowth: MonthlyGrowthPoint[];
      teacherPerformance: TeacherPerformance;
    }> => {
      await ensureAccessToken();

      let stats: AdminDashboardStats = {
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
        const raw = (data as { stats?: Partial<AdminDashboardStats> })?.stats ?? (data as Partial<AdminDashboardStats>) ?? {};
        stats = {
          ...stats,
          totalSchools: raw.totalSchools ?? 0,
          totalTeachers: raw.totalTeachers ?? 0,
          totalStudents: raw.totalStudents ?? 0,
          activeCourses: raw.activeCourses ?? 0,
          pendingLeaves: raw.pendingLeaves ?? 0,
          activeUsers: (raw.totalTeachers ?? 0) + (raw.totalStudents ?? 0),
        };
      } catch (err) {
        console.error("Error fetching admin stats:", err);
      }

      let monthlyGrowth: MonthlyGrowthPoint[] = [];
      let teacherPerformance: TeacherPerformance = { excellent: 0, good: 0, average: 0, needsImprovement: 0 };
      try {
        const { data: analyticsData } = await adminApi.dashboard.analytics();
        const body = analyticsData as {
          analytics?: { avgAttendance?: number; completionRate?: number; systemHealth?: number };
          monthlyGrowth?: MonthlyGrowthPoint[];
          teacherPerformance?: TeacherPerformance;
        };
        const analytics = body?.analytics ?? {};
        stats = {
          ...stats,
          avgAttendance: analytics.avgAttendance ?? 0,
          completionRate: analytics.completionRate ?? 0,
          systemHealth: analytics.systemHealth ?? 0,
        };
        monthlyGrowth = body?.monthlyGrowth ?? [];
        if (body?.teacherPerformance) teacherPerformance = body.teacherPerformance;
      } catch (err) {
        console.warn("Analytics data unavailable — trends will be empty:", err);
      }

      try {
        const { data } = await adminApi.passwordResetRequests.pendingCount();
        stats.pendingPasswordResets = (data as { count?: number })?.count ?? 0;
      } catch { /* non-critical */ }

      return { stats, monthlyGrowth, teacherPerformance };
    },
    staleTime: 60_000,
  });
}

export interface QuickPreviewItem {
  id?: string;
  name?: string;
  full_name?: string;
  title?: string;
  created_at: string;
  status?: string;
  email?: string;
}

export interface QuickPreviewGroup {
  id: "schools" | "teachers" | "students" | "courses";
  title: string;
  description: string;
  data: QuickPreviewItem[];
}

/** Only the 5 most recent rows per entity — real limit param, not a full-table fetch. */
export function useAdminQuickPreviews() {
  return useQuery({
    queryKey: queryKeys.admin.quickPreviews,
    queryFn: async (): Promise<{ previews: QuickPreviewGroup[]; inactiveSchoolCount: number }> => {
      await ensureAccessToken();

      const [schoolsRes, teachersRes, studentsRes, coursesRes] = await Promise.allSettled([
        adminApi.schools.list({ limit: 5 }),
        adminApi.teachers.list({ limit: 5 }),
        adminApi.students.list({ limit: 5 }),
        adminApi.courses.list({ limit: 5 }),
      ]);

      let inactiveSchoolCount = 0;
      const previews: QuickPreviewGroup[] = [];

      if (schoolsRes.status === "fulfilled") {
        // AdminSchoolsService.list() is the one admin list endpoint that
        // wraps its payload in `{ data: { schools: [...] } }` (via ok()) —
        // every other list endpoint here returns the array unwrapped, so
        // this needs its own extra fallback level or it always reads [].
        const d = schoolsRes.value.data as
          | { data?: { schools?: Record<string, unknown>[] }; schools?: Record<string, unknown>[] }
          | Record<string, unknown>[];
        const raw: Record<string, unknown>[] = Array.isArray(d) ? d : d?.data?.schools ?? d?.schools ?? [];
        inactiveSchoolCount = raw.filter((s) => s.isActive === false).length;
        const recent = raw
          .slice()
          .sort((a, b) => new Date(String(b.createdAt ?? b.created_at ?? 0)).getTime() - new Date(String(a.createdAt ?? a.created_at ?? 0)).getTime())
          .slice(0, 3)
          .map((s) => ({ id: String(s.id ?? ""), name: String(s.name ?? ""), created_at: String(s.createdAt ?? s.created_at ?? "") }));
        previews.push({ id: "schools", title: "Recent Schools", description: "Latest registered schools", data: recent });
      } else {
        previews.push({ id: "schools", title: "Recent Schools", description: "Latest registered schools", data: [] });
      }

      if (teachersRes.status === "fulfilled") {
        const responseData = teachersRes.value.data as Record<string, unknown>;
        const teachers = (responseData.teachers ?? responseData.data ?? responseData ?? []) as Record<string, unknown>[];
        const data = Array.isArray(teachers)
          ? teachers.slice(0, 3).map((t) => ({
              id: String(t.id ?? ""),
              full_name: String(t.name ?? t.full_name ?? t.fullName ?? ""),
              email: String(t.email ?? ""),
              created_at: String(t.createdAt ?? t.created_at ?? ""),
            }))
          : [];
        previews.push({ id: "teachers", title: "Recent Teachers", description: "Latest teacher registrations", data });
      } else {
        previews.push({ id: "teachers", title: "Recent Teachers", description: "Latest teacher registrations", data: [] });
      }

      if (studentsRes.status === "fulfilled") {
        const responseData = studentsRes.value.data as Record<string, unknown>;
        const students = (responseData.students ?? responseData.data ?? responseData ?? []) as Record<string, unknown>[];
        const data = Array.isArray(students)
          ? students.slice(0, 3).map((s) => ({
              id: String(s.id ?? ""),
              full_name: String(s.full_name ?? s.fullName ?? s.name ?? ""),
              email: String(s.email ?? ""),
              created_at: String(s.createdAt ?? s.created_at ?? ""),
            }))
          : [];
        previews.push({ id: "students", title: "Recent Students", description: "Latest student enrollments", data });
      } else {
        previews.push({ id: "students", title: "Recent Students", description: "Latest student enrollments", data: [] });
      }

      if (coursesRes.status === "fulfilled") {
        const responseData = coursesRes.value.data as Record<string, unknown>;
        const courses = (responseData.courses ?? responseData.data ?? responseData ?? []) as Record<string, unknown>[];
        const data = Array.isArray(courses)
          ? courses.slice(0, 3).map((c) => ({
              id: String(c.id ?? ""),
              title: String(c.title ?? c.course_name ?? c.name ?? ""),
              status: String(c.status ?? (c.isPublished ? "published" : "draft")),
              created_at: String(c.createdAt ?? c.created_at ?? ""),
            }))
          : [];
        previews.push({ id: "courses", title: "Recent Courses", description: "Latest course publications", data });
      } else {
        previews.push({ id: "courses", title: "Recent Courses", description: "Latest course publications", data: [] });
      }

      return { previews, inactiveSchoolCount };
    },
    staleTime: 60_000,
  });
}

/** Real, actionable counts only — no fabricated "activity" timestamps. */
export function useAdminNeedsAttention() {
  return useQuery({
    queryKey: queryKeys.admin.needsAttention,
    queryFn: async (): Promise<NeedsAttentionItem[]> => {
      await ensureAccessToken();

      const [leavesRes, passwordRes, contactRes, schoolsRes, alertsRes] = await Promise.allSettled([
        adminApi.dashboard.stats(),
        adminApi.passwordResetRequests.pendingCount(),
        adminApi.contactSubmissions.list({ status: "new", limit: 1 }),
        adminApi.schools.list({ limit: 500 }),
        adminApi.alerts(),
      ]);

      const items: NeedsAttentionItem[] = [];

      // Server-computed threshold alerts (failed sign-ins, failing admin ops,
      // stale password resets / contact submissions) — already in item shape.
      if (alertsRes.status === "fulfilled") {
        const serverAlerts = (alertsRes.value.data as { alerts?: NeedsAttentionItem[] })?.alerts;
        if (Array.isArray(serverAlerts)) items.push(...serverAlerts);
      }

      if (leavesRes.status === "fulfilled") {
        const raw = (leavesRes.value.data as { stats?: { pendingLeaves?: number } })?.stats;
        const pendingLeaves = raw?.pendingLeaves ?? 0;
        if (pendingLeaves > 0) {
          items.push({
            id: "leaves",
            label: `${pendingLeaves} pending leave request${pendingLeaves !== 1 ? "s" : ""}`,
            count: pendingLeaves,
            // Leave review lives as a tab on Teachers Management, not its own route.
            href: "/lms/admin/teachers?tab=leaves",
            tone: "amber",
          });
        }
      }

      if (passwordRes.status === "fulfilled") {
        const count = (passwordRes.value.data as { count?: number })?.count ?? 0;
        if (count > 0) {
          items.push({
            id: "password-resets",
            label: `${count} password reset request${count !== 1 ? "s" : ""}`,
            count,
            href: "/lms/admin/password-reset-requests",
            tone: "red",
          });
        }
      }

      if (contactRes.status === "fulfilled") {
        const counts = (contactRes.value.data as { status_counts?: { new?: number } })?.status_counts;
        const count = counts?.new ?? 0;
        if (count > 0) {
          items.push({
            id: "contact-submissions",
            label: `${count} new contact submission${count !== 1 ? "s" : ""}`,
            count,
            href: "/lms/admin/contact-submissions",
            tone: "amber",
          });
        }
      }

      if (schoolsRes.status === "fulfilled") {
        // Same `{ data: { schools } }` envelope as useAdminQuickPreviews above.
        const d = schoolsRes.value.data as
          | { data?: { schools?: Record<string, unknown>[] }; schools?: Record<string, unknown>[] }
          | Record<string, unknown>[];
        const raw: Record<string, unknown>[] = Array.isArray(d) ? d : d?.data?.schools ?? d?.schools ?? [];
        const count = raw.filter((s) => s.isActive === false).length;
        if (count > 0) {
          items.push({
            id: "inactive-schools",
            label: `${count} inactive school${count !== 1 ? "s" : ""}`,
            count,
            href: "/lms/admin/schools",
            tone: "red",
          });
        }
      }

      return items;
    },
    staleTime: 60_000,
  });
}
