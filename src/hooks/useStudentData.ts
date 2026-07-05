/**
 * Student data hooks - API-driven.
 *
 * These hooks use centralized API clients (`studentApi`, `commonApi`)
 * with polling/invalidation for freshness.
 */

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commonApi, setAuthToken, studentApi } from "../lib/api";
import { getSession, getStoredUserId } from "../lib/session-utils";

// -------------------- Helpers --------------------

async function ensureAccessToken(): Promise<string | null> {
  const { data } = await getSession();
  const token = data.session?.access_token ?? null;
  if (token) setAuthToken(token);
  return token;
}

// -------------------- Hooks --------------------

export function useStudentProfile() {
  return useQuery({
    queryKey: ["studentProfile"],
    queryFn: async () => {
      await ensureAccessToken();
      const userId = getStoredUserId();
      if (!userId) return null;
      const res = await commonApi.profile.get({ userId });
      return (res.data as { profile?: unknown })?.profile ?? null;
    },
    retry: 1,
  });
}

export function useStudentCourses() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["studentCourses"],
    retry: 2,
    retryDelay: 1000,
    queryFn: async () => {
      await ensureAccessToken();
      const { data } = await studentApi.courses.list();
      return (data as { courses?: unknown[] })?.courses || [];
    },
  });

  useEffect(() => {
    const onFocus = () => queryClient.invalidateQueries({ queryKey: ["studentCourses"] });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [queryClient]);

  return query;
}

function useStudentCourse(courseId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["studentCourse", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      await ensureAccessToken();
      // Read from the courses list cache first to avoid a redundant network request
      const cached = queryClient.getQueryData<Array<{ id: string }>>(["studentCourses"]);
      if (cached) {
        return cached.find((c) => c.id === courseId) ?? null;
      }
      const { data } = await studentApi.courses.list();
      const courses = (data as { courses?: Array<{ id: string }> })?.courses || [];
      return courses.find((c) => c.id === courseId) ?? null;
    },
  });
}

export function useCourseChapters(courseId: string) {
  return useQuery({
    queryKey: ["courseChapters", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      await ensureAccessToken();
      const { data } = await studentApi.courses.getChapters(courseId);
      return (data as { chapters?: unknown[] })?.chapters || [];
    },
    retry: 1,
  });
}

export function useStudentAssignments() {
  return useQuery({
    queryKey: ["studentAssignments"],
    retry: 2,
    retryDelay: 1000,
    queryFn: async () => {
      await ensureAccessToken();
      const { data } = await studentApi.assignments.list();
      return (data as { assignments?: unknown[] })?.assignments || [];
    },
  });
}

export function useStudentDailyAssignments() {
  return useQuery({
    queryKey: ["studentDailyAssignments"],
    retry: 2,
    retryDelay: 1000,
    queryFn: async () => {
      await ensureAccessToken();
      const { data } = await studentApi.assignments.list({ type: "DAILY" });
      return (data as { assignments?: unknown[] })?.assignments || [];
    },
  });
}

export interface StudentLastViewed {
  courseId: string;
  courseTitle: string;
  thumbnailUrl: string | null;
  chapterId: string | null;
  chapterTitle: string | null;
  contentId: string | null;
  contentTitle: string | null;
  contentType: string | null;
  progress: number;
  updatedAt: string;
}

export function useStudentLastViewed() {
  return useQuery({
    queryKey: ["studentLastViewed"],
    queryFn: async () => {
      await ensureAccessToken();
      const { data } = await studentApi.progress.getLastViewed();
      return ((data as { lastViewed?: StudentLastViewed | null })?.lastViewed ?? null);
    },
    staleTime: 60_000,
  });
}

export interface StudentActivity {
  activityDays: Array<{ date: string; hasLearning?: boolean; hasAssignment?: boolean }>;
  currentStreak: number;
  longestStreak: number;
  activeDaysLast28: number;
}

export function useStudentActivity() {
  return useQuery({
    queryKey: ["studentActivity"],
    queryFn: async (): Promise<StudentActivity> => {
      await ensureAccessToken();
      const { data } = await studentApi.activity.get();
      const d = (data as Partial<StudentActivity>) ?? {};
      return {
        activityDays: d.activityDays ?? [],
        currentStreak: Number(d.currentStreak ?? 0),
        longestStreak: Number(d.longestStreak ?? 0),
        activeDaysLast28: Number(d.activeDaysLast28 ?? 0),
      };
    },
    staleTime: 60_000,
  });
}

interface StudentRankScope {
  rank: number;
  total: number;
  percentile: number;
}

export interface StudentRankings {
  section?: StudentRankScope;
  grade?: StudentRankScope;
  school?: StudentRankScope;
  system?: StudentRankScope & { schools?: number };
}

export function useStudentRankings() {
  return useQuery({
    queryKey: ["studentRankings"],
    queryFn: async () => {
      await ensureAccessToken();
      const { data } = await studentApi.analytics.get({ historyLimit: 1 });
      const d = data as {
        rankings?: StudentRankings;
        summary?: { assignments_attempted?: number };
      };
      return {
        rankings: d?.rankings ?? null,
        attempted: Number(d?.summary?.assignments_attempted ?? 0),
      };
    },
    staleTime: 5 * 60_000,
  });
}

export function useStudentAssignment(assignmentId: string) {
  return useQuery({
    queryKey: ["studentAssignment", assignmentId],
    enabled: !!assignmentId,
    queryFn: async () => {
      await ensureAccessToken();
      const { data } = await studentApi.assignments.get(assignmentId);
      // Pass ALL four top-level fields through — previous bug silently dropped
      // `attempts` and `retake`, causing the retake button to never appear.
      const d = data as Record<string, unknown>;
      return {
        assignment: d?.assignment ?? null,
        submission: (d?.submission as unknown | null) ?? null,
        attempts: (d?.attempts as unknown[]) ?? [],
        retake: (d?.retake as unknown) ?? null,
      };
    },
  });
}

export function useStudentDashboardStats() {
  return useQuery({
    queryKey: ["studentDashboardStats"],
    queryFn: async () => {
      await ensureAccessToken();
      const { data } = await studentApi.dashboard.get();
      const stats = (data as { stats?: Record<string, unknown> })?.stats ?? {};
      return {
        activeCourses: Number((stats as { activeCourses?: unknown }).activeCourses ?? 0),
        pendingAssignments: Number((stats as { pendingAssignments?: unknown }).pendingAssignments ?? 0),
        attendancePercentage: 0,
        averageGrade: 0,
        completedAssignments: Number((stats as { completedAssignments?: unknown }).completedAssignments ?? 0),
        completedCourses: Number((stats as { completedCourses?: unknown }).completedCourses ?? 0),
        unreadNotifications: Number((stats as { unreadNotifications?: unknown }).unreadNotifications ?? 0),
      };
    },
  });
}

export function useStudentNotifications() {
  return useQuery({
    queryKey: ["studentNotifications"],
    queryFn: async () => {
      await ensureAccessToken();
      const res = await commonApi.notifications.user.get();
      return (res.data as { notifications?: unknown[] })?.notifications || (res.data as unknown[] | undefined) || [];
    },
    staleTime: 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: true,
  });
}

export interface StudentCertificate {
  id: string;
  course_id?: string;
  courses?: { id?: string; name?: string; title?: string; grade?: string; subject?: string };
  certificate_name: string;
  certificate_url?: string;
  issued_at: string;
  profiles?: { full_name?: string };
}

export function useStudentCertificates() {
  return useQuery<StudentCertificate[]>({
    queryKey: ["studentCertificates"],
    queryFn: async () => {
      await ensureAccessToken();
      const { data } = await studentApi.certificates.list();
      return (data as { certificates?: StudentCertificate[] })?.certificates || [];
    },
  });
}

export function useSubmitAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { assignmentId: string; answers?: Record<string, unknown>; fileUrl?: string; textContent?: string }) => {
      await ensureAccessToken();
      const { data } = await studentApi.assignments.submit(payload.assignmentId, {
        answers: payload.answers,
        fileUrl: payload.fileUrl,
        textContent: payload.textContent,
      });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["studentAssignments"] });
      queryClient.invalidateQueries({ queryKey: ["studentAssignment", variables.assignmentId] });
      // Refresh the combined pending count (sidebar badge + dashboard stat card).
      queryClient.invalidateQueries({ queryKey: ["studentDashboardStats"] });
    },
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await ensureAccessToken();
      const userId = getStoredUserId();
      if (!userId) throw new Error("No user session found");
      const { data } = await commonApi.notifications.user.update({
        notification_id: notificationId,
        user_id: userId,
        is_read: true,
      });
      return (data as { notification?: unknown })?.notification ?? data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studentNotifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadNotificationCount"] });
    },
  });
}

export function useCourseWithRealtime(courseId: string) {
  const courseQuery = useStudentCourse(courseId || "");
  return { ...courseQuery, isSynced: false };
}

export function useChapterContents(chapterId: string, courseId?: string) {
  return useQuery({
    queryKey: ["chapterContents", chapterId, courseId],
    enabled: !!chapterId,
    queryFn: async () => {
      await ensureAccessToken();
      const resolvedCourseId = courseId || "";
      if (!resolvedCourseId) {
        throw new Error("Course ID is required for chapter contents");
      }
      const { data } = await studentApi.courses.getChapterContents(resolvedCourseId, chapterId);
      const contents = (data as { contents?: unknown[] })?.contents || [];
      // Assignments always appear after regular content regardless of sortOrder
      return [
        ...contents.filter((c: unknown) => (c as { content_type?: string }).content_type !== "assignment"),
        ...contents.filter((c: unknown) => (c as { content_type?: string }).content_type === "assignment"),
      ];
    },
  });
}
