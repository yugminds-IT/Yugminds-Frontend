/**
 * Student data hooks - API-driven.
 *
 * These hooks use centralized API clients (`studentApi`, `commonApi`)
 * with polling/invalidation for freshness.
 */

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi, commonApi, setAuthToken, studentApi } from "../lib/api";
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

export function useStudentCourse(courseId: string) {
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

export function useStudentAssignment(assignmentId: string) {
  return useQuery({
    queryKey: ["studentAssignment", assignmentId],
    enabled: !!assignmentId,
    queryFn: async () => {
      await ensureAccessToken();
      const { data } = await studentApi.assignments.get(assignmentId);
      return {
        assignment: (data as { assignment?: unknown })?.assignment,
        submission: (data as { submission?: unknown | null })?.submission || null,
      };
    },
  });
}

// NOT_IMPLEMENTED: Student attendance endpoint not yet built. Returns empty array.
export function useStudentAttendance(_month?: Date) {
  return useQuery({
    queryKey: ["studentAttendance", _month?.toISOString()],
    queryFn: async () => {
      await ensureAccessToken();
      return [] as never[];
    },
  });
}

// NOT_IMPLEMENTED: Student attendance stats endpoint not yet built. Returns zero stats.
export function useStudentAttendanceStats() {
  return useQuery({
    queryKey: ["studentAttendanceStats"],
    queryFn: async () => {
      await ensureAccessToken();
      return { total: 0, present: 0, absent: 0, late: 0, percentage: 0 };
    },
  });
}

// NOT_IMPLEMENTED: Student calendar endpoint not yet built. Returns empty array.
export function useStudentCalendar() {
  return useQuery({
    queryKey: ["studentCalendar"],
    queryFn: async () => {
      await ensureAccessToken();
      return [] as never[];
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

export function useUpdateStudentProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { courseId: string; chapterId?: string; isCompleted: boolean }) => {
      await ensureAccessToken();
      const { data: res } = await studentApi.progress.simpleSave({
        courseId: data.courseId,
        chapterId: data.chapterId ?? null,
        isCompleted: data.isCompleted,
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studentCourses"] });
      queryClient.invalidateQueries({ queryKey: ["courseChapters"] });
      queryClient.invalidateQueries({ queryKey: ["studentDashboardStats"] });
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

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      updates: {
        full_name?: string;
        email?: string;
        email_notifications?: boolean;
        assignment_reminders?: boolean;
        grade_notifications?: boolean;
        course_updates?: boolean;
      },
    ) => {
      await ensureAccessToken();
      const { data } = await commonApi.profile.update(updates as Record<string, unknown>);
      return (data as { profile?: unknown })?.profile ?? data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studentProfile"] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: { current_password: string; new_password: string }) => {
      await ensureAccessToken();
      const { data } = await authApi.updatePassword({
        current_password: payload.current_password,
        new_password: payload.new_password,
      });
      return data;
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
      return (data as { contents?: unknown[] })?.contents || [];
    },
  });
}

// NOT_IMPLEMENTED: Course materials endpoint not yet built. Returns empty array.
export function useCourseMaterials(_courseId: string) {
  return useQuery({
    queryKey: ["courseMaterials", _courseId],
    enabled: !!_courseId,
    queryFn: async () => {
      await ensureAccessToken();
      return [] as never[];
    },
  });
}
