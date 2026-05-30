/**
 * Course Synchronization Utilities
 * 
 * Handles synchronization between course builder and student view.
 * Uses polling-based invalidation instead of Supabase realtime.
 */

export interface CourseSyncConfig {
  courseId: string;
  onCourseUpdate?: (payload: Record<string, unknown>) => void;
  onChapterUpdate?: (payload: Record<string, unknown>) => void;
  onContentUpdate?: (payload: Record<string, unknown>) => void;
  onMaterialUpdate?: (payload: Record<string, unknown>) => void;
  onAssignmentUpdate?: (payload: Record<string, unknown>) => void;
}

export interface SyncChannel {
  channel: null;
  unsubscribe: () => void;
}

/**
 * Create a no-op sync channel (realtime removed; use query invalidation instead)
 */
export function createCourseSyncChannel(config: CourseSyncConfig): SyncChannel {
  if (!config.courseId || config.courseId.trim() === '') {
    console.warn('[createCourseSyncChannel] Invalid courseId, skipping');
  }

  return {
    channel: null,
    unsubscribe: () => {},
  };
}

/**
 * Debounce function for rapid updates
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Optimistic update with rollback capability
 */
export interface OptimisticUpdate<T> {
  optimisticData: T;
  rollback: () => void;
  commit: () => void;
}

export function createOptimisticUpdate<T extends Record<string, unknown>>(
  currentData: T,
  updateFn: (data: T) => T
): OptimisticUpdate<T> {
  const originalData = { ...currentData };
  const optimisticData = updateFn(currentData);
  
  return {
    optimisticData,
    rollback: () => {
      Object.assign(currentData, originalData);
    },
    commit: () => {
      // Update is confirmed, no rollback needed
    },
  };
}
