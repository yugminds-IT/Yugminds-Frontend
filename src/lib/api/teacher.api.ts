/**
 * Teacher API - dashboard, schools, classes, reports, attendance,
 * leaves, schedules, periods, notifications, analytics
 */

import { apiClient } from './axios';
import { withParams } from './utils';

const TEACHER = '/teacher';

export const teacherApi = {
  /** Dashboard */
  dashboard: {
    get: () => apiClient.get(`${TEACHER}/dashboard`),
  },

  /** Schools */
  schools: {
    list: () => apiClient.get(`${TEACHER}/schools`),
  },

  /** Classes */
  classes: {
    list: (schoolId?: string) =>
      apiClient.get(withParams(`${TEACHER}/classes`, { school_id: schoolId })),
  },

  /** Reports */
  reports: {
    list: (params?: { school_id?: string; date?: string; class_id?: string; limit?: number }) =>
      apiClient.get(withParams(`${TEACHER}/reports`, params)),
    submit: (data: Record<string, unknown>) =>
      apiClient.post(`${TEACHER}/reports`, data),
  },

  /** Attendance */
  attendance: {
    today: (params?: { school_id?: string; date?: string }) =>
      apiClient.get(withParams(`${TEACHER}/attendance/today`, params)),
    monthly: (params?: { school_id?: string; limit?: number; yearMonth?: string }) =>
      apiClient.get(withParams(`${TEACHER}/attendance/monthly`, params)),
    list: (params?: { school_id?: string; from?: string; to?: string }) =>
      apiClient.get(withParams(`${TEACHER}/attendance`, params)),
  },

  /** Leaves */
  leaves: {
    list: (schoolId?: string) =>
      apiClient.get(withParams(`${TEACHER}/leaves`, { school_id: schoolId })),
    create: (data: Record<string, unknown>) =>
      apiClient.post(`${TEACHER}/leaves`, data),
  },

  /** Schedules */
  schedules: {
    list: (params?: { school_id?: string; day?: string }) =>
      apiClient.get(withParams(`${TEACHER}/schedules`, params)),
  },

  /** Periods */
  periods: {
    list: (params?: { school_id?: string; day?: string }) =>
      apiClient.get(withParams(`${TEACHER}/periods`, params)),
  },

  /** Notifications */
  notifications: {
    list: (params?: { limit?: number }) =>
      apiClient.get(withParams(`${TEACHER}/notifications`, params)),
    get: (id: string) => apiClient.get(`${TEACHER}/notifications/${id}`),
    recipients: (params?: { school_id?: string }) =>
      apiClient.get(withParams(`${TEACHER}/notifications/recipients`, params)),
    create: (data: {
      title: string;
      message: string;
      type?: string;
      recipientType?: string;
      recipients?: string[];
      school_id?: string;
      allowReplies?: boolean;
    }) => apiClient.post(`${TEACHER}/notifications`, data),
    markRead: (id: string) =>
      apiClient.patch(`${TEACHER}/notifications/${id}`, { is_read: true }),
  },

  /** Student progress */
  studentProgress: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${TEACHER}/student-progress`, params)),
  },

  /** Analytics */
  analytics: {
    get: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${TEACHER}/analytics`, params)),
  },

  /** Assignment management + analytics */
  assignments: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${TEACHER}/assignments`, params)),
    create: (data: Record<string, unknown>) =>
      apiClient.post(`${TEACHER}/assignments`, data),
    get: (assignmentId: string) =>
      apiClient.get(`${TEACHER}/assignments/${assignmentId}`),
    update: (assignmentId: string, data: Record<string, unknown>) =>
      apiClient.patch(`${TEACHER}/assignments/${assignmentId}`, data),
    delete: (assignmentId: string) =>
      apiClient.delete(`${TEACHER}/assignments/${assignmentId}`),
    submissions: (assignmentId: string) =>
      apiClient.get(`${TEACHER}/assignments/${assignmentId}/submissions`),
    grade: (assignmentId: string, submissionId: string, data: Record<string, unknown>) =>
      apiClient.patch(`${TEACHER}/assignments/${assignmentId}/submissions/${submissionId}/grade`, data),
    updateRetakeSettings: (assignmentId: string, data: Record<string, unknown>) =>
      apiClient.patch(`${TEACHER}/assignments/${assignmentId}/retake-settings`, data),
    grantRetake: (assignmentId: string, data: Record<string, unknown>) =>
      apiClient.post(`${TEACHER}/assignments/${assignmentId}/retake-grants`, data),
    openRetakeForAll: (assignmentId: string, data?: Record<string, unknown>) =>
      apiClient.post(`${TEACHER}/assignments/${assignmentId}/retake-open-all`, data ?? {}),
    closeRetake: (assignmentId: string) =>
      apiClient.post(`${TEACHER}/assignments/${assignmentId}/retake-close`, {}),
    attemptHistory: (assignmentId: string, studentId: string | number) =>
      apiClient.get(`${TEACHER}/assignments/${assignmentId}/attempt-history/${studentId}`),
    progressDashboard: (assignmentId: string) =>
      apiClient.get(`${TEACHER}/assignments/${assignmentId}/progress-dashboard`),
    analytics: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${TEACHER}/assignment-analytics`, params)),
  },
};
