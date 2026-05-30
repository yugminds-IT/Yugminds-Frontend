import type { QueryKeyLike } from '../query-keys';
import { queryKeys } from '../query-keys';

export type RealtimeEventName = 'notification:new' | 'notification:read' | 'notification:unread_count' | 'dashboard:stats';

export type EventQueryMap = Partial<Record<RealtimeEventName, QueryKeyLike[]>>;

export const baseEventQueryMap: EventQueryMap = {
  'notification:unread_count': [queryKeys.shared.unreadNotificationCount],
};

export const roleEventQueryOverrides: Record<'admin' | 'school_admin' | 'teacher' | 'student', EventQueryMap> = {
  admin: {
    'notification:new': [queryKeys.admin.notifications, queryKeys.admin.dashboardStats, queryKeys.admin.recentActivity],
    'notification:read': [queryKeys.admin.notifications, queryKeys.admin.dashboardStats],
    'dashboard:stats': [queryKeys.admin.dashboardStats],
  },
  school_admin: {
    'notification:new': [
      queryKeys.schoolAdmin.notifications,
      queryKeys.schoolAdmin.dashboardStats,
      queryKeys.schoolAdmin.recentActivity,
      queryKeys.schoolAdmin.quickPreviews,
    ],
    'notification:read': [queryKeys.schoolAdmin.notifications, queryKeys.schoolAdmin.dashboardStats],
    'dashboard:stats': [queryKeys.schoolAdmin.dashboardStats],
  },
  teacher: {
    'notification:new': [queryKeys.teacher.notifications, queryKeys.teacher.dashboard, queryKeys.teacher.studentProgress],
    'notification:read': [queryKeys.teacher.notifications, queryKeys.teacher.dashboard, queryKeys.teacher.studentProgress],
    'dashboard:stats': [queryKeys.teacher.dashboard],
  },
  student: {
    'notification:new': [queryKeys.student.notifications, queryKeys.student.dashboardStats],
    'notification:read': [queryKeys.student.notifications, queryKeys.student.dashboardStats],
    'dashboard:stats': [queryKeys.student.dashboardStats, queryKeys.student.courses, queryKeys.student.assignments],
  },
};

export function resolveEventQueryMap(
  role?: 'admin' | 'school_admin' | 'teacher' | 'student',
  customMap?: EventQueryMap,
): EventQueryMap {
  return {
    ...baseEventQueryMap,
    ...(role ? roleEventQueryOverrides[role] : {}),
    ...(customMap ?? {}),
  };
}
