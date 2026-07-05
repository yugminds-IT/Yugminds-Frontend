/**
 * Student API - dashboard, courses, assignments, progress, certificates
 */

import { apiClient } from './axios';
import { withParams } from './utils';

const STUDENT = '/student';

export const studentApi = {
  /** Dashboard */
  dashboard: {
    get: () => apiClient.get(`${STUDENT}/dashboard`),
  },

  /** Courses */
  courses: {
    list: () => apiClient.get(`${STUDENT}/courses`),
    getChapters: (courseId: string) =>
      apiClient.get(`${STUDENT}/courses/${courseId}/chapters`),
    getChapterContents: (courseId: string, chapterId: string) =>
      apiClient.get(`${STUDENT}/courses/${courseId}/chapters/${chapterId}/contents`),
  },

  /** Assignments */
  assignments: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${STUDENT}/assignments`, params)),
    getHierarchy: () => apiClient.get(`${STUDENT}/assignments/hierarchy`),
    get: (assignmentId: string) =>
      apiClient.get(`${STUDENT}/assignments/${assignmentId}`),
    submit: (assignmentId: string, data: Record<string, unknown>) =>
      apiClient.post(`${STUDENT}/assignments/${assignmentId}/submit`, data),
  },

  /** Progress */
  progress: {
    get: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${STUDENT}/progress`, params)),
    simple: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${STUDENT}/simple-progress`, params)),
    simpleSave: (data: Record<string, unknown>) =>
      apiClient.post(`${STUDENT}/simple-progress`, data),
    saveChapter: (data: Record<string, unknown>) =>
      apiClient.post(`${STUDENT}/save-chapter-progress`, data),
    saveLastViewed: (data: { courseId: string; chapterId: string; contentId?: string }) =>
      apiClient.post(`${STUDENT}/last-viewed`, data),
    getLastViewed: () => apiClient.get(`${STUDENT}/last-viewed`),
  },

  /** Activity feed + learning streak */
  activity: {
    get: () => apiClient.get(`${STUDENT}/activity`),
  },

  /** Analytics */
  analytics: {
    get: (params?: { historyLimit?: number; from?: string; to?: string }) => {
      const qs = new URLSearchParams();
      if (params?.historyLimit) qs.set("historyLimit", String(params.historyLimit));
      if (params?.from) qs.set("from", params.from);
      if (params?.to) qs.set("to", params.to);
      const query = qs.toString();
      return apiClient.get(`${STUDENT}/analytics${query ? `?${query}` : ""}`);
    },
  },

  /** Certificates */
  certificates: {
    list: () => apiClient.get(`${STUDENT}/certificates`),
    generate: (data?: Record<string, unknown>) =>
      apiClient.post(`${STUDENT}/certificates/generate`, data ?? {}),
  },

  /** Notifications (send to teachers in school) */
  notifications: {
    recipients: (params?: { school_id?: string }) =>
      apiClient.get(withParams(`${STUDENT}/notifications/recipients`, params)),
    create: (data: {
      title: string;
      message: string;
      school_id?: string;
      recipientType?: 'role' | 'individual';
      recipients?: string[];
    }) => apiClient.post(`${STUDENT}/notifications`, data),
  },
};
