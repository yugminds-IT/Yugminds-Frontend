/**
 * Admin API - full admin module including dashboard, schools, teachers, courses,
 * reports, settings, certificates, notifications, analytics, etc.
 */

import { apiClient } from './axios';
import { withParams } from './utils';

const ADMIN = '/admin';

export const adminApi = {
  /** Dashboard & stats */
  dashboard: {
    stats: () => apiClient.get(`${ADMIN}/stats`),
    analytics: (params?: { from?: string; to?: string }) =>
      apiClient.get(withParams(`${ADMIN}/analytics`, params)),
    assignmentAnalytics: () => apiClient.get(`${ADMIN}/assignment-analytics`),
    refreshViews: () => apiClient.post(`${ADMIN}/refresh-dashboard-views`),
    monitoring: () => apiClient.get(`${ADMIN}/monitoring-dashboard`),
    materializedViewStats: () => apiClient.get(`${ADMIN}/materialized-view-stats`),
  },

  /** Schools */
  schools: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${ADMIN}/schools`, params)),
    get: (id: string) => apiClient.get(`${ADMIN}/schools/${id}`),
    create: (data: Record<string, unknown>) => apiClient.post(`${ADMIN}/schools`, data),
    update: (id: string, data: Record<string, unknown>) =>
      apiClient.put(`${ADMIN}/schools`, { ...data, id }),
    delete: (id: string) => apiClient.delete(`${ADMIN}/schools/${id}`),
    initAcademicStructure: (id: string) =>
      apiClient.post(`${ADMIN}/schools/${id}/init-academic-structure`, {}),
    getTeacherAssignments: (id: string) =>
      apiClient.get(`${ADMIN}/schools/${id}/teacher-assignments`),
  },

  /** Teachers */
  teachers: {
    list: (params?: { school_id?: string }) =>
      apiClient.get(withParams(`${ADMIN}/teachers`, params)),
    get: (id: string) => apiClient.get(`${ADMIN}/teachers/${id}`),
    create: (data: Record<string, unknown>) => apiClient.post(`${ADMIN}/teachers`, data),
    update: (id: string, data: Record<string, unknown>) =>
      apiClient.put(`${ADMIN}/teachers/${id}`, data),
    delete: (id: string) => apiClient.delete(`${ADMIN}/teachers/${id}`),
  },

  /** School admins */
  schoolAdmins: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${ADMIN}/school-admins`, params)),
    create: (data: Record<string, unknown>) =>
      apiClient.post(`${ADMIN}/school-admins`, data),
    update: (data: Record<string, unknown>) =>
      apiClient.put(`${ADMIN}/school-admins`, data),
    delete: (id: string) =>
      apiClient.delete(`${ADMIN}/school-admins`, { params: { id }, data: { id } }),
  },

  /** Courses */
  courses: {
    list: () => apiClient.get(`${ADMIN}/courses`),
    get: (courseId: string) => apiClient.get(`${ADMIN}/courses/${courseId}`),
    create: (data: Record<string, unknown>) => apiClient.post(`${ADMIN}/courses`, data),
    update: (courseId: string, data: Record<string, unknown>) =>
      apiClient.patch(`${ADMIN}/courses/${courseId}`, data),
    delete: (courseId: string) => apiClient.delete(`${ADMIN}/courses/${courseId}`),
    getChapters: (courseId: string) => apiClient.get(`${ADMIN}/courses/${courseId}/chapters`),
    addChapter: (courseId: string, data: Record<string, unknown>) =>
      apiClient.post(`${ADMIN}/courses/${courseId}/chapters`, data),
    getVersions: (courseId: string) => apiClient.get(`${ADMIN}/courses/${courseId}/versions`),
    revertVersion: (courseId: string, data: Record<string, unknown>) =>
      apiClient.patch(`${ADMIN}/courses/${courseId}/versions`, data),
    publish: (courseId: string, data?: Record<string, unknown>) =>
      apiClient.post(`${ADMIN}/courses/${courseId}/publish`, data ?? {}),
    duplicate: (courseId: string) =>
      apiClient.post(`${ADMIN}/courses/${courseId}/duplicate`, {}),
    setAccess: (courseId: string, data: Record<string, unknown>) =>
      apiClient.post(`${ADMIN}/courses/${courseId}/access`, data),
  },

  /** Students */
  students: {
    list: (params?: { school_id?: string; limit?: number }) =>
      apiClient.get(withParams(`${ADMIN}/students`, params)),
    create: (data: Record<string, unknown>) => apiClient.post(`${ADMIN}/students`, data),
    delete: (studentId: string) => apiClient.delete(`${ADMIN}/students/${studentId}`),
    update: (studentId: string, data: Record<string, unknown>) =>
      apiClient.patch(`${ADMIN}/students/${studentId}`, data),
  },

  /** Reports */
  reports: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${ADMIN}/reports`, params)),
    /** Download report as PDF blob; returns axios response (response.data is Blob) */
    download: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${ADMIN}/reports`, params), { responseType: 'blob' }),
  },
  teacherReports: {
    list: (params?: { school_id?: string; from?: string; to?: string; search?: string; limit?: number }) =>
      apiClient.get(withParams(`${ADMIN}/teacher-reports`, params)),
    update: (body: { id: string; status?: string; admin_notes?: string }) =>
      apiClient.patch(`${ADMIN}/teacher-reports`, body),
  },
  auditLog: {
    list: (params?: { limit?: number }) =>
      apiClient.get(withParams(`${ADMIN}/audit-log`, params)),
  },
  teacherAttendance: {
    list: (params?: { school_id?: string; from?: string; to?: string; teacherId?: string }) =>
      apiClient.get(withParams(`${ADMIN}/teacher-attendance`, params)),
    monthly: (params?: { school_id?: string; month?: string }) =>
      apiClient.get(withParams(`${ADMIN}/teacher-attendance/monthly`, params)),
    markMissing: (data: Record<string, unknown>) =>
      apiClient.post(`${ADMIN}/teacher-attendance/mark-missing`, data),
  },

  /** Student progress */
  studentProgress: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${ADMIN}/student-progress`, params)),
  },

  /** Account creation */
  createAccount: (data: Record<string, unknown>) =>
    apiClient.post(`${ADMIN}/create-account`, data),

  /** Profile */
  profile: {
    get: (userId?: string) =>
      apiClient.get(withParams(`${ADMIN}/profile`, userId ? { user_id: userId } : undefined)),
    update: (data: Record<string, unknown>) =>
      apiClient.patch(`${ADMIN}/profile`, data),
  },

  /** Settings */
  settings: {
    get: () => apiClient.get(`${ADMIN}/settings`),
    update: (data: Record<string, unknown>) =>
      apiClient.post(`${ADMIN}/settings`, data),
    patch: (data: Record<string, unknown>) =>
      apiClient.patch(`${ADMIN}/settings`, data),
    export: () => apiClient.get(`${ADMIN}/settings/export`),
    /** POST export and return blob for file download */
    exportBlob: () =>
      apiClient.post(`${ADMIN}/settings/export`, {}, { responseType: 'blob' }),
    backup: () => apiClient.post(`${ADMIN}/settings/backup`),
    cleanup: () => apiClient.post(`${ADMIN}/settings/cleanup`),
    notifications: (data: Record<string, unknown>) =>
      apiClient.patch(`${ADMIN}/settings/notifications`, data),
  },

  /** Security & MFA */
  security: {
    get: () => apiClient.get(`${ADMIN}/security`),
    mfa: {
      enroll: (data: Record<string, unknown>) =>
        apiClient.post(`${ADMIN}/security/mfa`, data),
      verify: (data: Record<string, unknown>) =>
        apiClient.post(`${ADMIN}/security/mfa`, data),
      unenroll: (factorId: string) =>
        apiClient.delete(`${ADMIN}/security/mfa`, { params: { factorId } }),
    },
  },

  /** Notifications */
  notifications: {
    list: (params?: { limit?: number; mode?: string }) =>
      apiClient.get(withParams(`${ADMIN}/notifications`, params)),
    create: (data: Record<string, unknown>) =>
      apiClient.post(`${ADMIN}/notifications`, data),
    recipients: () => apiClient.get(`${ADMIN}/notifications/recipients`),
  },

  /** Password reset requests */
  passwordResetRequests: {
    pendingCount: () => apiClient.get(`${ADMIN}/password-reset-requests/pending-count`),
    list: (params?: { status?: string; limit?: number }) =>
      apiClient.get(withParams(`${ADMIN}/password-reset-requests`, params)),
    get: (id: string) => apiClient.get(withParams(`${ADMIN}/password-reset-requests`, { id })),
    update: (data: Record<string, unknown>) =>
      apiClient.patch(`${ADMIN}/password-reset-requests`, data),
    delete: (id: string) => apiClient.delete(withParams(`${ADMIN}/password-reset-requests`, { id })),
  },

  /** Certificates */
  certificates: {
    list: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
      apiClient.get(withParams(`${ADMIN}/certificates`, params as Record<string, string | number | undefined>)),
    regenerate: (id: string) =>
      apiClient.post(`${ADMIN}/certificates/${id}/regenerate`, {}),
    revoke: (id: string) =>
      apiClient.delete(`${ADMIN}/certificates/${id}`),
    generateAllEligible: () =>
      apiClient.post(`${ADMIN}/certificates/generate-all-eligible`),
    batchGenerate: (data: { course_ids?: string[]; student_ids?: number[]; dry_run?: boolean } | Record<string, unknown>) =>
      apiClient.post(`${ADMIN}/certificates/batch-generate`, data),
    getTemplate: () =>
      apiClient.get(`${ADMIN}/certificate-template`),
    saveTemplate: (template: string) =>
      apiClient.post(`${ADMIN}/certificate-template`, { template }),
    deleteTemplate: () =>
      apiClient.delete(`${ADMIN}/certificate-template`),
  },

  /** Community page CMS */
  community: {
    getConfig: () => apiClient.get(`${ADMIN}/community/config`),
    updateConfig: (formData: FormData) =>
      apiClient.put(`${ADMIN}/community/config`, formData),
    listItems: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${ADMIN}/community/items`, params)),
    getItem: (id: string) => apiClient.get(`${ADMIN}/community/items/${id}`),
    createItem: (formData: FormData) =>
      apiClient.post(`${ADMIN}/community/items`, formData),
    updateItem: (id: string, formData: FormData) =>
      apiClient.put(`${ADMIN}/community/items/${id}`, formData),
    deleteItem: (id: string) =>
      apiClient.delete(`${ADMIN}/community/items/${id}`),
    getVersions: (id: string) =>
      apiClient.get(`${ADMIN}/community/items/${id}/versions`),
    revert: (id: string, data?: Record<string, unknown>) =>
      apiClient.post(`${ADMIN}/community/items/${id}/revert`, data),
    migrateSuccessStories: () =>
      apiClient.post(`${ADMIN}/community/migrate-success-stories`),
  },

  /** Success stories */
  successStories: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${ADMIN}/success-stories`, params)),
    get: (id: string) => apiClient.get(`${ADMIN}/success-stories/${id}`),
    create: (formData: FormData) =>
      apiClient.post(`${ADMIN}/success-stories`, formData),
    update: (id: string, data: Record<string, unknown> | FormData) =>
      apiClient.put(`${ADMIN}/success-stories/${id}`, data),
    delete: (id: string) => apiClient.delete(`${ADMIN}/success-stories/${id}`),
    revert: (id: string, data?: Record<string, unknown>) =>
      apiClient.post(`${ADMIN}/success-stories/${id}/revert`, data),
    getVersions: (id: string) =>
      apiClient.get(`${ADMIN}/success-stories/${id}/versions`),
  },

  /** Logos */
  logos: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${ADMIN}/logos`, params)),
    get: (id: string) => apiClient.get(`${ADMIN}/logos/${id}`),
    create: (formData: FormData) =>
      apiClient.post(`${ADMIN}/logos`, formData),
    update: (id: string, formData: FormData) =>
      apiClient.put(`${ADMIN}/logos/${id}`, formData),
    delete: (id: string, hard?: boolean) =>
      apiClient.delete(
        withParams(`${ADMIN}/logos/${id}`, hard != null ? { hard } : undefined)
      ),
  },

  /** Joining codes */
  joiningCodes: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams(`${ADMIN}/joining-codes`, params)),
    create: (data: Record<string, unknown>) =>
      apiClient.post(`${ADMIN}/joining-codes`, data),
    update: (data: Record<string, unknown>) =>
      apiClient.patch(`${ADMIN}/joining-codes`, data),
  },

  /** Leaves */
  leaves: {
    list: (params?: { school_id?: string }) =>
      apiClient.get(withParams(`${ADMIN}/leaves`, params)),
    update: (data: Record<string, unknown>) => apiClient.put(`${ADMIN}/leaves`, data),
  },

  /** Upload */
  upload: (formData: FormData) => {
    return apiClient.post(`${ADMIN}/upload`, formData, {
      // Don't force Content-Type: axios will set proper multipart headers+boundary for FormData.
    });
  },

  /** Cache & maintenance */
  cache: {
    status: () => apiClient.get('/cache/status'),
    monitor: () => apiClient.get(`${ADMIN}/cache-monitor`),
    warm: () => apiClient.post(`${ADMIN}/warm-cache`),
  },
  restoreAllData: () => apiClient.post(`${ADMIN}/restore-all-data`),

  /** Contact Submissions */
  contactSubmissions: {
    list: (params?: { status?: string; page?: number; limit?: number; search?: string }) =>
      apiClient.get(withParams(`${ADMIN}/contact-submissions`, params as Record<string, string | number | undefined>)),
    update: (id: string, data: { status?: string; admin_notes?: string }) =>
      apiClient.patch(`${ADMIN}/contact-submissions/${id}`, data),
    delete: (id: string) =>
      apiClient.delete(`${ADMIN}/contact-submissions/${id}`),
  },
};
