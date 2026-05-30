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
  },

  /** Analytics */
  analytics: {
    get: () => apiClient.get(`${STUDENT}/analytics`),
  },

  /** Certificates */
  certificates: {
    list: () => apiClient.get(`${STUDENT}/certificates`),
    generate: (data?: Record<string, unknown>) =>
      apiClient.post(`${STUDENT}/certificates/generate`, data ?? {}),
  },
};
