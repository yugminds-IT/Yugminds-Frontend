/**
 * API module - centralized API client and endpoints by role
 *
 * Usage:
 *   import { authApi, adminApi, teacherApi, schoolAdminApi, studentApi, commonApi } from '@/lib/api';
 *
 *   // Auth (backend)
 *   const res = await authApi.login({ email, password });
 *
 *   // Admin dashboard
 *   const { data } = await adminApi.dashboard.stats();
 *
 *   // Teacher dashboard
 *   const { data } = await teacherApi.dashboard.get();
 *
 *   // School admin
 *   const { data } = await schoolAdminApi.school.get();
 *
 *   // Student
 *   const { data } = await studentApi.courses.list();
 */

export { apiClient, setAuthToken, getAuthToken } from './axios';
export type { AxiosInstance, AxiosRequestConfig } from './axios';

export { login, signup, refresh, authApi } from './auth.api';
export { adminApi } from './admin.api';
export { teacherApi } from './teacher.api';
export { schoolAdminApi } from './school-admin.api';
export { studentApi } from './student.api';
export { commonApi } from './common.api';

export { buildParams, withParams } from './utils';
export * from './types';
