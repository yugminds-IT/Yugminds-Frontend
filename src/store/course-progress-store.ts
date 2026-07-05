import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Safe storage adapter for SSR
const getSafeStorage = () => {
  if (typeof window === 'undefined') {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    } as unknown as Storage;
  }
  return localStorage;
};

/**
 * Course Progress Store
 *
 * The SERVER is the source of truth for completion. This store is a thin,
 * per-user client cache:
 *   - `videoPositions` / `lastViewed` are PERSISTED (so resume works across reloads).
 *   - `contentProgress` / `chapterProgress` are an IN-MEMORY optimistic overlay only
 *     (instant tick right after "Mark complete"); they are NOT persisted and are
 *     reconciled away once React Query refetches the authoritative `is_completed`.
 *
 * `ownerUserId` guards against cross-user contamination on a shared browser: whenever
 * a different user is detected (login/logout), the entire store is reset.
 */

export interface LastViewedEntry {
  chapterId: string;
  contentId?: string;
  chapterTitle?: string;
  contentTitle?: string;
  savedAt: string;
}

export interface ContentProgress {
  contentId: string;
  chapterId: string;
  courseId: string;
  isCompleted: boolean;
  completedAt?: string;
  lastPosition?: number; // For video resume
  timeSpent?: number; // In seconds
}

export interface ChapterProgress {
  chapterId: string;
  courseId: string;
  isCompleted: boolean;
  completedAt?: string;
  progressPercent: number;
}

export interface CourseProgressState {
  // Identity of the user this cache belongs to (guards shared-browser leakage)
  ownerUserId: string | null;

  // Optimistic overlay keyed by contentId (in-memory only, not persisted)
  contentProgress: Record<string, ContentProgress>;

  // Optimistic chapter overlay keyed by chapterId (in-memory only, not persisted)
  chapterProgress: Record<string, ChapterProgress>;

  // Last viewed position keyed by courseId (persisted, per-user)
  lastViewed: Record<string, LastViewedEntry>;

  // Video positions keyed by contentId (persisted, per-user)
  videoPositions: Record<string, number>;

  // Loading states
  savingProgress: Set<string>;

  // Identity / lifecycle
  ensureOwner: (userId: string | null) => void;
  clearAllProgress: () => void;

  // Actions
  setContentCompleted: (contentId: string, chapterId: string, courseId: string, completed: boolean) => void;
  setChapterCompleted: (chapterId: string, courseId: string, completed: boolean, progressPercent?: number) => void;
  setLastViewed: (courseId: string, entry: Omit<LastViewedEntry, 'savedAt'>) => void;
  getLastViewed: (courseId: string) => LastViewedEntry | null;
  setVideoPosition: (contentId: string, position: number) => void;
  getVideoPosition: (contentId: string) => number;
  isContentCompleted: (contentId: string) => boolean;
  isChapterCompleted: (chapterId: string) => boolean;
  getChapterProgress: (chapterId: string) => number;
  setSavingProgress: (contentId: string, saving: boolean) => void;
  isSaving: (contentId: string) => boolean;

  // Bulk operations
  loadProgressFromServer: (progress: ContentProgress[]) => void;
  loadChapterProgressFromServer: (progress: ChapterProgress[]) => void;
  clearCourseProgress: (courseId: string) => void;
}

const emptyMaps = () => ({
  contentProgress: {} as Record<string, ContentProgress>,
  chapterProgress: {} as Record<string, ChapterProgress>,
  lastViewed: {} as Record<string, LastViewedEntry>,
  videoPositions: {} as Record<string, number>,
});

export const useCourseProgressStore = create<CourseProgressState>()(
  persist(
    (set, get) => ({
      ownerUserId: null,
      contentProgress: {},
      chapterProgress: {},
      lastViewed: {},
      videoPositions: {},
      savingProgress: new Set<string>(),

      // If the active user differs from the cached owner, wipe everything and
      // re-own. This is the single guarantee against cross-user contamination.
      ensureOwner: (userId) => {
        const current = get().ownerUserId;
        if (current === userId) return;
        set({
          ownerUserId: userId,
          ...emptyMaps(),
          savingProgress: new Set<string>(),
        });
      },

      clearAllProgress: () => {
        set({
          ownerUserId: null,
          ...emptyMaps(),
          savingProgress: new Set<string>(),
        });
      },

      setContentCompleted: (contentId, chapterId, courseId, completed) => {
        set((state) => ({
          contentProgress: {
            ...state.contentProgress,
            [contentId]: {
              contentId,
              chapterId,
              courseId,
              isCompleted: completed,
              completedAt: completed ? new Date().toISOString() : undefined,
            },
          },
        }));
      },

      setChapterCompleted: (chapterId, courseId, completed, progressPercent = 100) => {
        set((state) => ({
          chapterProgress: {
            ...state.chapterProgress,
            [chapterId]: {
              chapterId,
              courseId,
              isCompleted: completed,
              completedAt: completed ? new Date().toISOString() : undefined,
              progressPercent,
            },
          },
        }));
      },

      setLastViewed: (courseId, entry) => {
        set((state) => ({
          lastViewed: {
            ...state.lastViewed,
            [courseId]: { ...entry, savedAt: new Date().toISOString() },
          },
        }));
      },

      getLastViewed: (courseId) => {
        return get().lastViewed[courseId] ?? null;
      },

      setVideoPosition: (contentId, position) => {
        set((state) => ({
          videoPositions: {
            ...state.videoPositions,
            [contentId]: position,
          },
        }));
      },

      getVideoPosition: (contentId) => {
        return get().videoPositions[contentId] || 0;
      },

      isContentCompleted: (contentId) => {
        return get().contentProgress[contentId]?.isCompleted || false;
      },

      isChapterCompleted: (chapterId) => {
        return get().chapterProgress[chapterId]?.isCompleted || false;
      },

      getChapterProgress: (chapterId) => {
        return get().chapterProgress[chapterId]?.progressPercent || 0;
      },

      setSavingProgress: (contentId, saving) => {
        set((state) => {
          const newSaving = new Set(state.savingProgress);
          if (saving) {
            newSaving.add(contentId);
          } else {
            newSaving.delete(contentId);
          }
          return { savingProgress: newSaving };
        });
      },

      isSaving: (contentId) => {
        return get().savingProgress.has(contentId);
      },

      loadProgressFromServer: (progress) => {
        set((state) => {
          const newProgress = { ...state.contentProgress };
          progress.forEach((p) => {
            newProgress[p.contentId] = p;
          });
          return { contentProgress: newProgress };
        });
      },

      loadChapterProgressFromServer: (progress) => {
        set((state) => {
          const newProgress = { ...state.chapterProgress };
          progress.forEach((p) => {
            newProgress[p.chapterId] = p;
          });
          return { chapterProgress: newProgress };
        });
      },

      clearCourseProgress: (courseId) => {
        set((state) => {
          const newContentProgress = { ...state.contentProgress };
          const newChapterProgress = { ...state.chapterProgress };
          const newVideoPositions = { ...state.videoPositions };

          Object.keys(newContentProgress).forEach((key) => {
            if (newContentProgress[key].courseId === courseId) {
              delete newContentProgress[key];
            }
          });

          Object.keys(newChapterProgress).forEach((key) => {
            if (newChapterProgress[key].courseId === courseId) {
              delete newChapterProgress[key];
            }
          });

          const newLastViewed = { ...state.lastViewed };
          delete newLastViewed[courseId];

          return {
            contentProgress: newContentProgress,
            chapterProgress: newChapterProgress,
            lastViewed: newLastViewed,
            videoPositions: newVideoPositions,
          };
        });
      },
    }),
    {
      name: 'course-progress-store',
      storage: createJSONStorage(() => getSafeStorage()),
      // Persist ONLY resume data + owner identity. Completion overlays
      // (contentProgress / chapterProgress) are intentionally in-memory so
      // stale completion can never survive a reload or leak across users.
      partialize: (state) => ({
        ownerUserId: state.ownerUserId,
        lastViewed: state.lastViewed,
        videoPositions: state.videoPositions,
      }),
      merge: (persistedState: unknown, currentState: CourseProgressState): CourseProgressState => ({
        ...currentState,
        ...(persistedState as Partial<CourseProgressState>),
        // Overlays always start empty on a fresh page load
        contentProgress: {} as Record<string, ContentProgress>,
        chapterProgress: {} as Record<string, ChapterProgress>,
        savingProgress: new Set<string>(),
      }),
    }
  )
);

/**
 * Imperative reset for non-React callers (e.g. logout in session-utils).
 * Clears in-memory state AND the persisted localStorage entry.
 */
export function resetCourseProgressStore(): void {
  try {
    useCourseProgressStore.getState().clearAllProgress();
  } catch {
    // store may not be initialised yet
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem('course-progress-store');
    } catch {
      // ignore storage errors
    }
  }
}
