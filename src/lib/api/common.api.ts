/**
 * Common API - auth, profile, role, notifications, contact, shared endpoints
 */

import { apiClient } from './axios';
import { withParams } from './utils';

export const commonApi = {
  /** Get user role (used after login) - calls backend GET /get-role */
  getRole: (userId: string) =>
    apiClient.get(withParams('/get-role', { userId })),

  /** Profile (generic) */
  profile: {
    get: (params?: { userId?: string }) =>
      apiClient.get(withParams('/profile', params)),
    update: (data: Record<string, unknown>) => apiClient.patch('/profile', data),
  },

  /** Auth activity */
  auth: {
    trackLogin: (data: Record<string, unknown>) =>
      apiClient.post('/auth/track-login', data),
    activity: {
      get: (params?: { user_id?: string; limit?: number }) =>
        apiClient.get(withParams('/auth/activity', params)),
      post: (data: Record<string, unknown>) =>
        apiClient.post('/auth/activity', data),
    },
    passwordResetRequest: (data: Record<string, unknown>) =>
      apiClient.post('/auth/password-reset-request', data),
  },

  /** Notifications (user-level) */
  notifications: {
    user: {
      get: () => apiClient.get('/notifications/user'),
      getUnreadCount: (params?: { user_id?: string }) =>
        apiClient.get(withParams('/notifications/unread-count', params)),
      update: (data: Record<string, unknown>) =>
        apiClient.patch('/notifications/user', data),
    },
    reply: (params: { notification_id: string }) =>
      apiClient.get(withParams('/notifications/reply', params)),
    createReply: (data: { notification_id: string; reply_text: string }) =>
      apiClient.post('/notifications/reply', data),
  },

  /** Contact form */
  contact: (data: Record<string, unknown>) =>
    apiClient.post('/contact', data),

  /** Public logos */
  logos: {
    list: () => apiClient.get('/api/logos'),
  },

  /** Community page (public) */
  community: {
    get: () => apiClient.get('/community'),
  },

  /** Validate joining code */
  validateJoiningCode: (data: { code: string; studentData?: Record<string, unknown> }) =>
    apiClient.post('/validate-joining-code', data),

  /** Schools (public) */
  schools: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiClient.get(withParams('/api/schools', params)),
  },

  /** Health check */
  health: () => apiClient.get('/health'),

  /** CSRF token */
  csrfToken: () => apiClient.get('/api/csrf-token'),

  /** Metrics (admin monitoring) */
  metrics: (params?: { recent?: number; t?: number }) =>
    apiClient.get(withParams('/metrics', params)),

  /** Public certificate verification (no auth required) */
  verifyCertificate: (shortId: string) =>
    apiClient.get(`/verify/${encodeURIComponent(shortId)}`),
};
