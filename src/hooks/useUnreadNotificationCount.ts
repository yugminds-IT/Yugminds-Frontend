/**
 * Shared hook for unread notification count across all dashboards.
 * Uses GET /notifications/unread-count (JWT auth; same API for admin, school_admin, teacher, student).
 * Only runs when enabled (e.g. after auth is ready) to avoid 401.
 */

import { useQuery } from '@tanstack/react-query';
import { commonApi } from '../lib/api';
import { useDashboardRealtime, type RealtimeRole } from './useDashboardRealtime';
import { queryKeys } from '../lib/query-keys';

const QUERY_KEY = ['unreadNotificationCount'];

export function useUnreadNotificationCount(options?: {
  enabled?: boolean;
  role?: RealtimeRole;
}): { count: number; isLoading: boolean } {
  const enabled = options?.enabled !== false;
  const role = options?.role ?? 'student';
  const { isConnected } = useDashboardRealtime(role, {
    enabled,
    debugLabel: `${role}-unread-count`,
    customEventMap: {
      'notification:new': [queryKeys.shared.unreadNotificationCount],
      'notification:read': [queryKeys.shared.unreadNotificationCount],
    },
  });
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data: res } = await commonApi.notifications.user.getUnreadCount();
      const count = Number((res as { count?: number })?.count ?? 0);
      return count;
    },
    staleTime: 30_000,
    refetchInterval: isConnected ? false : 60_000,
    refetchOnWindowFocus: true,
    enabled,
  });

  return {
    count: typeof data === 'number' ? data : 0,
    isLoading: !!isLoading,
  };
}
