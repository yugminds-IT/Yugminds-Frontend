/**
 * Course Synchronization Hook (polling-based)
 * 
 * Provides periodic query invalidation as a lightweight replacement
 * for the previous Supabase realtime subscriptions.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface UseCourseRealtimeSyncOptions {
  courseId: string;
  enabled?: boolean;
  debounceMs?: number;
}

export function useCourseRealtimeSync({
  courseId,
  enabled = true,
}: UseCourseRealtimeSyncOptions) {
  const queryClient = useQueryClient();
  const [isConnected] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const refreshCourseData = useCallback(() => {
    if (!courseId) return;
    queryClient.invalidateQueries({ queryKey: ['studentCourse', courseId] });
    queryClient.invalidateQueries({ queryKey: ['courseChapters', courseId] });
    queryClient.invalidateQueries({ queryKey: ['chapterContents'] });
  }, [queryClient, courseId]);

  useEffect(() => {
    if (!enabled || !courseId || courseId.trim() === '') return;

    // Refresh on window focus
    const onFocus = () => refreshCourseData();
    window.addEventListener('focus', onFocus);

    // Periodic polling every 2 minutes
    intervalRef.current = setInterval(refreshCourseData, 120_000);

    return () => {
      window.removeEventListener('focus', onFocus);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [courseId, enabled, refreshCourseData]);

  return { isConnected };
}
