/**
 * React Query hooks for Teacher Dashboard
 * Provides data fetching, caching, and mutations for teacher-related operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSession } from '../lib/session-utils';
import { setAuthToken, teacherApi } from '../lib/api';

// ==================== Shared types ====================

export interface TeacherSchool {
  id?: string;
  name?: string;
  school_id?: string;
  school_name?: string;
  [key: string]: unknown;
}

export interface TeacherClassRow {
  id?: string;
  grade?: string;
  subject?: string;
  class_name?: string;
  school_id?: string;
  academic_year?: string;
  is_active?: boolean;
  max_students?: number;
  [key: string]: unknown;
}

export interface TeacherScheduleRow {
  id?: string;
  day_of_week?: string;
  grade?: string;
  subject?: string;
  school_id?: string;
  period?: string | number | { start_time?: string; end_time?: string };
  start_time?: string;
  end_time?: string;
  room?: string | { room_number?: string; room_name?: string };
  school?: { name?: string };
  class_id?: string;
  [key: string]: unknown;
}

export interface TeacherReport {
  id?: string;
  date?: string;
  grade?: string;
  status?: string;
  report_status?: string;
  topics_taught?: string;
  created_at?: string;
  classes?: Array<{ grade?: string }> | { grade?: string };
  [key: string]: unknown;
}

export interface TeacherLeave {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  reason?: string;
  school_id?: string;
  [key: string]: unknown;
}

export interface TeacherAttendanceRecord {
  id: string;
  date: string;
  status: string;
  recorded_at?: string;
  [key: string]: unknown;
}

export interface TeacherMonthlyLog {
  month?: string;
  school_id?: string;
  present_days?: number;
  absent_days?: number;
  leave_days?: number;
  unreported_days?: number;
  total_working_days?: number;
  attendance_percentage?: number;
  [key: string]: unknown;
}

export interface MonthlyDataItem {
  month?: string;
  school_id?: string;
  present_days?: number;
  absent_days?: number;
  leave_days?: number;
  unreported_days?: number;
  total_working_days?: number;
  attendance_percentage?: number;
}

// ==================== Shared helpers ====================

/**
 * Format a "YYYY-MM" month key as a label, parsing in LOCAL time.
 * `new Date("2026-07")` parses as UTC midnight and renders as the previous
 * month in timezones behind UTC — appending a day + local time avoids that.
 */
export function formatMonthLabel(
  month: string | Date | undefined,
  options: Intl.DateTimeFormatOptions = { month: 'short' },
): string {
  if (!month) return '';
  const d = typeof month === 'string' ? new Date(`${month.slice(0, 7)}-01T00:00:00`) : month;
  if (isNaN(d.getTime())) return String(month);
  return d.toLocaleDateString('en-US', options);
}

/** Current month as a "YYYY-MM" key (local time). */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ==================== Data Fetching Hooks ====================

/**
 * Get teacher's assigned schools
 * Uses API route to bypass RLS securely
 */
export function useTeacherSchools() {
  return useQuery<TeacherSchool[]>({
    queryKey: ['teacher', 'schools'],
    queryFn: async () => {
      const { data: { session } } = await getSession();
      if (!session) throw new Error('Not authenticated');
      setAuthToken(session.access_token || null);

      const { data } = await teacherApi.schools.list();
      return ((data as { schools?: TeacherSchool[] })?.schools || []) as TeacherSchool[];
    },
  });
}

/**
 * Get teacher's assigned classes for a specific school
 * Uses API route to bypass RLS securely
 */
export function useTeacherClasses(schoolId?: string) {
  return useQuery<TeacherClassRow[]>({
    queryKey: ['teacher', 'classes', schoolId],
    queryFn: async () => {
      const { data: { session } } = await getSession();
      if (!session) throw new Error('Not authenticated');
      setAuthToken(session.access_token || null);

      const { data } = await teacherApi.classes.list(schoolId);
      const payload = data as { classes?: TeacherClassRow[]; data?: TeacherClassRow[] };
      return payload?.classes ?? payload?.data ?? [];
    },
    enabled: true, // Always enabled - API will handle school filtering
    retry: 1,
  });
}

/**
 * Get teacher's reports (with optional filters)
 * Uses API route to bypass RLS securely
 */
export function useTeacherReports(schoolId?: string, filters?: { date?: string; classId?: string; limit?: number }) {
  return useQuery<TeacherReport[]>({
    queryKey: ['teacher', 'reports', schoolId, filters],
    queryFn: async () => {
      const { data: { session } } = await getSession();
      if (!session) throw new Error('Not authenticated');
      setAuthToken(session.access_token || null);

      const { data } = await teacherApi.reports.list({
        school_id: schoolId,
        date: filters?.date,
        class_id: filters?.classId,
        limit: filters?.limit,
      });
      return (data as { reports?: TeacherReport[] })?.reports || [];
    },
  });
}

/**
 * Get today's attendance status and report progress
 * Uses API route to bypass RLS securely
 */
export function useTodayAttendanceStatus(schoolId?: string, date?: string) {
  return useQuery({
    queryKey: ['teacher', 'today-attendance', schoolId, date],
    queryFn: async () => {
      const { data: { session } } = await getSession();
      if (!session) throw new Error('Not authenticated');
      setAuthToken(session.access_token || null);

      const { data } = await teacherApi.attendance.today({ school_id: schoolId, date });
      return data;
    },
    enabled: true,
    retry: 1,
  });
}

/**
 * Get teacher's monthly attendance data
 * Uses the monthly attendance API endpoint which provides accurate data from teacher_monthly_attendance_log
 */
export function useTeacherMonthlyAttendance(schoolId?: string, months?: number) {
  return useQuery({
    queryKey: ['teacher', 'monthly-attendance', schoolId, months],
    queryFn: async () => {
      const { data: { session } } = await getSession();
      if (!session) throw new Error('Not authenticated');
      setAuthToken(session.access_token || null);

      const { data } = await teacherApi.attendance.monthly({ school_id: schoolId, limit: months });
      // The monthly endpoint returns monthlyData array from teacher_monthly_attendance_log
      const monthlyData = (data as { monthlyData?: MonthlyDataItem[] })?.monthlyData || [];
      
      // Filter by school_id if provided (API may return data for all schools)
      let filteredData = monthlyData;
      if (schoolId && monthlyData.length > 0) {
        filteredData = monthlyData.filter((item) => item.school_id === schoolId);
      }
      
      // Transform to match expected format with present_count, absent_count, etc.
      // Data is already sorted descending (most recent first) by the API
      const transformed = filteredData.map((item: MonthlyDataItem) => ({
        month: item.month,
        present_count: item.present_days || 0,
        absent_count: item.absent_days || 0,
        leave_count: item.leave_days || 0,
        unreported_count: item.unreported_days || 0,
        total_days: item.total_working_days || 0,
        attendance_percentage: item.attendance_percentage || 0
      }));
      
      return transformed;
    },
    enabled: true, // Always enabled
  });
}

/**
 * Get teacher's monthly attendance log data (from teacher_monthly_attendance_log table)
 * Uses API route to bypass RLS securely
 * Returns detailed monthly breakdown with all metrics
 */
export function useTeacherMonthlyAttendanceLog(schoolId?: string, yearMonth?: string) {
  return useQuery<{ monthlyData: TeacherMonthlyLog[]; summary: Record<string, unknown> }>({
    queryKey: ['teacher', 'monthly-attendance-log', schoolId, yearMonth],
    queryFn: async () => {
      const { data: { session } } = await getSession();
      if (!session) throw new Error('Not authenticated');
      setAuthToken(session.access_token || null);
      const { data } = await teacherApi.attendance.monthly({
        school_id: schoolId,
        limit: 12,
        yearMonth,
      });
      const monthlyData = (data as { monthlyData?: TeacherMonthlyLog[] })?.monthlyData || [];
      const forMonth = yearMonth
        ? monthlyData.filter((m) => m.month === yearMonth)
        : monthlyData;
      return { monthlyData: forMonth, summary: {} as Record<string, unknown> };
    },
    // schoolId omitted -> the backend combines every assigned school ("All
    // Schools" mode), so this doesn't need to wait for one to be picked.
    enabled: true,
  });
}

/**
 * Get teacher's leave requests
 * Uses API route to bypass RLS securely
 */
export function useTeacherLeaves(schoolId?: string) {
  return useQuery<TeacherLeave[]>({
    queryKey: ['teacher', 'leaves', schoolId],
    queryFn: async () => {
      const { data: { session } } = await getSession();
      if (!session) throw new Error('Not authenticated');
      setAuthToken(session.access_token || null);

      const { data } = await teacherApi.leaves.list(schoolId);
      return (data as { leaves?: TeacherLeave[] })?.leaves || [];
    },
  });
}

/**
 * Get teacher's attendance records (daily)
 * Uses API route to bypass RLS securely
 */
export function useTeacherAttendance(schoolId?: string, month?: string) {
  return useQuery<TeacherAttendanceRecord[]>({
    queryKey: ['teacher', 'attendance', schoolId, month],
    queryFn: async () => {
      const { data: { session } } = await getSession();
      if (!session) throw new Error('Not authenticated');
      setAuthToken(session.access_token || null);

      // month format is "YYYY-MM", convert to date range (YYYY-MM-DD)
      let from: string | undefined;
      let to: string | undefined;
      if (month) {
        const [year, monthNum] = month.split('-').map(Number);
        const startDate = new Date(year, monthNum - 1, 1);
        const endDate = new Date(year, monthNum, 0);
        from = startDate.toISOString().split('T')[0];
        to = endDate.toISOString().split('T')[0];
      }

      const { data } = await teacherApi.attendance.list({ school_id: schoolId, from, to });
      return (data as { attendance?: TeacherAttendanceRecord[] })?.attendance || [];
    },
  });
}

/**
 * Get teacher's class schedules
 * Uses API route to bypass RLS securely
 */
export function useTeacherSchedules(schoolId?: string, day?: string) {
  return useQuery<TeacherScheduleRow[]>({
    queryKey: ['teacher', 'schedules', schoolId, day],
    queryFn: async () => {
      const { data: { session } } = await getSession();
      if (!session) throw new Error('Not authenticated');
      setAuthToken(session.access_token || null);
      const { data } = await teacherApi.schedules.list({ school_id: schoolId, day });
      return (data as { schedules?: TeacherScheduleRow[] })?.schedules || [];
    },
    enabled: true, // Always enabled - API will get school_id from database or use provided one
    retry: 1,
    staleTime: 0, // Always consider data stale, so it refetches when needed
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Refetch when component mounts
  });
}

/**
 * Get today's classes for the teacher.
 *
 * Backed by /teacher/attendance/today (TeacherAttendanceService.getToday),
 * which resolves "today" through TeacherWorkingDaysHistory + SchoolCalendar
 * before falling back to ClassSchedule — not ClassSchedule.dayOfWeek alone.
 * A prior version of this hook queried schedules.list() by day-of-week
 * directly, so a school on a declared holiday, or a stale ClassSchedule row
 * left over from a since-changed working-days pattern, would still show up
 * as "today's classes."
 */
export function useTodaysClasses(schoolId?: string) {
  return useQuery({
    queryKey: ['teacher', 'today-classes', schoolId],
    queryFn: async () => {
      const { data: { session } } = await getSession();
      if (!session) throw new Error('Not authenticated');
      setAuthToken(session.access_token || null);

      interface ClassItem {
        id?: string;
        grade?: string;
        subject?: string;
        class_name?: string;
        school_id?: string;
        schedule_id?: string;
        period_id?: string;
        start_time?: string;
        end_time?: string;
        hasReport: boolean;
      }

      type TodayPeriod = {
        period_id?: string;
        grade?: string;
        subject?: string;
        start_time?: string;
        end_time?: string;
      };

      const { data } = await teacherApi.attendance.today({ school_id: schoolId });
      const today = data as {
        submittedPeriods?: TodayPeriod[];
        pendingPeriods?: TodayPeriod[];
      };

      const toClassItem = (p: TodayPeriod, hasReport: boolean): ClassItem => ({
        id: p.period_id || '',
        grade: p.grade,
        subject: p.subject,
        class_name: p.grade,
        school_id: schoolId,
        schedule_id: p.period_id,
        period_id: p.period_id,
        start_time: p.start_time,
        end_time: p.end_time,
        hasReport,
      });

      const result: ClassItem[] = [
        ...(today.submittedPeriods ?? []).map((p) => toClassItem(p, true)),
        ...(today.pendingPeriods ?? []).map((p) => toClassItem(p, false)),
      ];
      // Earliest period first — matches how the teaching day actually runs.
      result.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
      return result;
    },
    // schoolId omitted -> "All Schools" mode; the backend aggregates today's
    // periods across every assigned school instead of requiring one pick.
    enabled: true,
    // WebSocket updates trigger invalidation; keep no fixed polling.
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

/**
 * Get periods for the teacher's school
 * Uses API route to bypass RLS securely
 */
export function useTeacherPeriods(schoolId?: string, day?: string) {
  return useQuery({
    queryKey: ['teacher', 'periods', schoolId, day],
    queryFn: async () => {
      const { data: { session } } = await getSession();
      if (!session) throw new Error('Not authenticated');
      setAuthToken(session.access_token || null);
      const { data } = await teacherApi.periods.list({ school_id: schoolId, day });
      return (data as { periods?: unknown[] })?.periods || [];
    },
    enabled: true, // Always enabled - API will get school_id from database
    retry: 1,
  });
}

// ==================== Mutation Hooks ====================

/**
 * Submit a daily teaching report (auto-marks attendance as Present)
 * Uses API route to bypass RLS securely
 */
export function useSubmitReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportData: {
      school_id: string;
      period_id: string;
      grade: string;
      date: string;
      start_time?: string;
      end_time?: string;
      topics_taught?: string;
      activities?: string;
      notes?: string;
      student_count?: number;
    }) => {
      const { data: { session } } = await getSession();
      if (!session) throw new Error('Not authenticated');
      setAuthToken(session.access_token || null);

      try {
        const { data } = await teacherApi.reports.submit({
          school_id: reportData.school_id,
          period_id: reportData.period_id,
          grade: reportData.grade,
          date: reportData.date,
          start_time: reportData.start_time,
          end_time: reportData.end_time,
          topics_taught: reportData.topics_taught,
          activities: reportData.activities,
          notes: reportData.notes,
          student_count: reportData.student_count,
        });
        return (data as { report?: unknown })?.report ?? data;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to submit report';
        throw new Error(msg);
      }
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['teacher', 'reports'] });
      queryClient.invalidateQueries({ queryKey: ['teacher', 'attendance'] });
      queryClient.invalidateQueries({ queryKey: ['teacher', 'monthly-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['teacher', 'today-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['teacher', 'today-classes'] });
      
    },
     
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : 'Failed to submit report');
      console.error('Error submitting report:', errorMessage);
    },
  });
}

/**
 * Apply for leave
 * Uses API route to bypass RLS securely
 */
export function useApplyLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leaveData: {
      school_id: string;
      start_date: string;
      end_date: string;
      reason: string;
      substitute_required?: boolean;
    }) => {
      const { data: { session } } = await getSession();
      if (!session) throw new Error('Not authenticated');
      setAuthToken(session.access_token || null);

      try {
        const { data } = await teacherApi.leaves.create({
          school_id: leaveData.school_id,
          start_date: leaveData.start_date,
          end_date: leaveData.end_date,
          reason: leaveData.reason,
          substitute_required: leaveData.substitute_required,
        });
        return (data as { leave?: unknown })?.leave ?? data;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to submit leave request';
        throw new Error(msg);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'leaves'] });
      
    },
     
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit leave request';
      console.error('Error submitting leave request:', errorMessage);
    },
  });
}

