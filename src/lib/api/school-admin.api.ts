/**
 * School Admin API - dashboard, school, courses, students, teachers,
 * schedules, reports, notifications, leaves, rooms, periods
 */

import { apiClient } from './axios';
import { withParams } from './utils';

const SCHOOL_ADMIN = '/school-admin';

export const schoolAdminApi = {
  /** School info */
  school: {
    get: () => apiClient.get(`${SCHOOL_ADMIN}/school`),
  },

  /** Stats / dashboard */
  stats: {
    get: () => apiClient.get(`${SCHOOL_ADMIN}/stats`),
    assignmentAnalytics: () => apiClient.get(`${SCHOOL_ADMIN}/assignment-analytics`),
    leaderboard: () => apiClient.get(`${SCHOOL_ADMIN}/leaderboard`),
  },

  /** Courses */
  courses: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${SCHOOL_ADMIN}/courses`, params)),
    progress: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${SCHOOL_ADMIN}/courses/progress`, params)),
    progressStudents: (params?: { courseId?: string }) =>
      apiClient.get(withParams(`${SCHOOL_ADMIN}/courses/progress/students`, params)),
    progressStudentDetail: (params: { courseId: string; studentId?: string }) =>
      apiClient.get(withParams(`${SCHOOL_ADMIN}/courses/progress/students/detail`, params)),
  },

  /** Students */
  students: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${SCHOOL_ADMIN}/students`, params)),
    create: (data: Record<string, unknown>) =>
      apiClient.post(`${SCHOOL_ADMIN}/students`, data),
    update: (studentId: string | number, data: Record<string, unknown>) =>
      apiClient.patch(`${SCHOOL_ADMIN}/students/${studentId}`, data),
    changePassword: (studentId: string | number, data: { password: string }) =>
      apiClient.patch(`${SCHOOL_ADMIN}/students/${studentId}/password`, data),
    delete: (studentId: string | number, params?: { hard?: boolean }) =>
      apiClient.delete(withParams(`${SCHOOL_ADMIN}/students/${studentId}`, params)),
    bulkImport: (data: {
      students: Array<Record<string, unknown>>;
      dry_run?: boolean;
    }) => apiClient.post(`${SCHOOL_ADMIN}/students/bulk-import`, data),
  },

  /** Teachers */
  teachers: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${SCHOOL_ADMIN}/teachers`, params)),
  },

  /** Student progress */
  studentProgress: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${SCHOOL_ADMIN}/student-progress`, params)),
  },

  /** Schedules */
  schedules: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${SCHOOL_ADMIN}/schedules`, params)),
    get: (id: string) => apiClient.get(`${SCHOOL_ADMIN}/schedules/${id}`),
    create: (data: Record<string, unknown>) =>
      apiClient.post(`${SCHOOL_ADMIN}/schedules`, data),
    update: (id: string, data: Record<string, unknown>) =>
      apiClient.patch(`${SCHOOL_ADMIN}/schedules/${id}`, data),
    delete: (id: string) => apiClient.delete(`${SCHOOL_ADMIN}/schedules/${id}`),
    syncToTeachers: (data?: { teacherIds?: string[] }) =>
      apiClient.post(`${SCHOOL_ADMIN}/schedules/sync-to-teachers`, data),
  },

  /** Periods */
  periods: {
    list: () => apiClient.get(`${SCHOOL_ADMIN}/periods`),
    get: (id: string) => apiClient.get(`${SCHOOL_ADMIN}/periods/${id}`),
    create: (data: Record<string, unknown>) =>
      apiClient.post(`${SCHOOL_ADMIN}/periods`, data),
    update: (id: string, data: Record<string, unknown>) =>
      apiClient.patch(`${SCHOOL_ADMIN}/periods/${id}`, data),
    delete: (id: string) => apiClient.delete(`${SCHOOL_ADMIN}/periods/${id}`),
  },

  /** Rooms */
  rooms: {
    list: () => apiClient.get(`${SCHOOL_ADMIN}/rooms`),
    get: (id: string) => apiClient.get(`${SCHOOL_ADMIN}/rooms/${id}`),
    create: (data: Record<string, unknown>) =>
      apiClient.post(`${SCHOOL_ADMIN}/rooms`, data),
    update: (id: string, data: Record<string, unknown>) =>
      apiClient.patch(`${SCHOOL_ADMIN}/rooms/${id}`, data),
    delete: (id: string) => apiClient.delete(`${SCHOOL_ADMIN}/rooms/${id}`),
  },

  /** Reports */
  reports: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${SCHOOL_ADMIN}/reports`, params)),
    get: (id: string) => apiClient.get(`${SCHOOL_ADMIN}/reports/${id}`),
    update: (id: string, data: Record<string, unknown>) =>
      apiClient.patch(`${SCHOOL_ADMIN}/reports/${id}`, data),
    bulk: (data: Record<string, unknown>) =>
      apiClient.patch(`${SCHOOL_ADMIN}/reports/bulk`, data),
  },

  /** Notifications */
  notifications: {
    list: (params?: { limit?: number; school_id?: string; mode?: string }) =>
      apiClient.get(withParams(`${SCHOOL_ADMIN}/notifications`, params)),
    create: (data: Record<string, unknown>) =>
      apiClient.post(`${SCHOOL_ADMIN}/notifications`, data),
    update: (id: string, data: Record<string, unknown>) =>
      apiClient.patch(`${SCHOOL_ADMIN}/notifications/${id}`, data),
    recipients: (params?: { school_id?: string }) =>
      apiClient.get(withParams(`${SCHOOL_ADMIN}/notifications/recipients`, params)),
  },

  /** Leaves */
  leaves: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${SCHOOL_ADMIN}/leaves`, params)),
    get: (id: string) => apiClient.get(`${SCHOOL_ADMIN}/leaves/${id}`),
    update: (id: string, data: Record<string, unknown>) =>
      apiClient.patch(`${SCHOOL_ADMIN}/leaves/${id}`, data),
  },

  /** Password reset requests */
  passwordResetRequests: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${SCHOOL_ADMIN}/password-reset-requests`, params)),
    update: (data: Record<string, unknown>) =>
      apiClient.patch(`${SCHOOL_ADMIN}/password-reset-requests`, data),
    delete: (id: string) =>
      apiClient.delete(withParams(`${SCHOOL_ADMIN}/password-reset-requests`, { id })),
  },

  /** Profile */
  profile: {
    get: () => apiClient.get(`${SCHOOL_ADMIN}/profile`),
    update: (data: Record<string, unknown>) =>
      apiClient.patch(`${SCHOOL_ADMIN}/profile`, data),
  },

  /** Data export/import */
  data: {
    export: () => apiClient.get(`${SCHOOL_ADMIN}/data/export`),
    import: (data: Record<string, unknown>) =>
      apiClient.post(`${SCHOOL_ADMIN}/data/import`, data),
  },
};
