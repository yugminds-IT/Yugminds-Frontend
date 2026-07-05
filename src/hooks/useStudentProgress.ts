/**
 * Student progress hooks - API-driven.
 *
 * These hooks use centralized API clients which call `/api/**`
 * (proxied to the backend).
 */

import { useQuery } from "@tanstack/react-query";
import { adminApi, teacherApi } from "../lib/api";
import { schoolAdminApi } from "../lib/api/school-admin.api";

// ==================== Types ====================

export interface CourseProgress {
  course_id: string;
  course_name: string;
  total_chapters: number;
  completed_chapters: number;
  progress_percentage: number;
  last_accessed: string;
  enrolled_on: string;
  status: "completed" | "in_progress" | "not_started";
}

export interface StudentProgressData {
  student_id: string;
  full_name: string;
  email: string;
  grade: string;
  section?: string;
  school_id?: string;
  school_name?: string;
  total_courses: number;
  completed_courses: number;
  in_progress_courses: number;
  average_progress: number;
  courses: CourseProgress[];
  last_activity: Date | null;
}

export interface ProgressSummary {
  total_students: number;
  students_with_progress: number;
  students_completed: number;
  average_school_progress?: number;
  average_system_progress?: number;
  total_courses: number;
  total_teachers?: number;
  total_schools?: number;
}

export interface TeacherProgressResponse {
  students: StudentProgressData[];
  summary: ProgressSummary;
}

export interface SchoolAdminProgressResponse {
  students: StudentProgressData[];
  teachers: Array<{
    teacher_id: string;
    full_name: string;
    email: string;
  }>;
  courses: Array<{
    course_id: string;
    course_name: string;
    grade: string;
    total_chapters: number;
    enrolled_students: number;
    completed_students: number;
    average_progress: number;
    completion_rate: number;
  }>;
  summary: ProgressSummary;
}

export interface AdminProgressResponse {
  students: StudentProgressData[];
  schools: Array<{
    school_id: string;
    school_name: string;
    total_students: number;
    average_progress: number;
  }>;
  courses: Array<{
    course_id: string;
    course_name: string;
    total_chapters: number;
    enrolled_students: number;
    completed_students: number;
    average_progress: number;
    completion_rate: number;
  }>;
  summary: ProgressSummary;
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

// ==================== Hooks ====================

export function useTeacherStudentProgress(
  schoolId?: string,
  filters?: { courseId?: string; studentId?: string; section?: string }
) {
  return useQuery({
    queryKey: ["teacher", "student-progress", schoolId, filters],
    queryFn: async () => {
      const res = await teacherApi.studentProgress.list({
        school_id: schoolId,
        course_id: filters?.courseId,
        student_id: filters?.studentId,
        section: filters?.section,
      });
      return res.data as TeacherProgressResponse;
    },
    enabled: true,
    staleTime: 30_000,
  });
}

export function useSchoolAdminStudentProgress(
  filters?: { courseId?: string; studentId?: string; grade?: string; section?: string }
) {
  return useQuery({
    queryKey: ["school-admin", "student-progress", filters],
    queryFn: async () => {
      const res = await schoolAdminApi.studentProgress.list({
        course_id: filters?.courseId,
        student_id: filters?.studentId,
        grade: filters?.grade,
        section: filters?.section,
      });
      return res.data as SchoolAdminProgressResponse;
    },
    enabled: true,
    staleTime: 30_000,
  });
}

export function useAdminStudentProgress(
  filters?: { schoolId?: string; courseId?: string; studentId?: string; grade?: string; limit?: number; offset?: number }
) {
  return useQuery({
    queryKey: ["admin", "student-progress", filters],
    queryFn: async () => {
      const res = await adminApi.studentProgress.list({
        school_id: filters?.schoolId,
        course_id: filters?.courseId,
        student_id: filters?.studentId,
        grade: filters?.grade,
        limit: filters?.limit,
        offset: filters?.offset,
      });
      return res.data as AdminProgressResponse;
    },
    enabled: true,
    staleTime: 30_000,
  });
}
