import type { Chapter } from "@/components/admin/ChapterBuilderCard";
import type { ChapterContent } from "@/components/admin/ChapterContentManager";
import type { Assignment } from "@/components/admin/AssignmentBuilder";

export type CourseEditorDraft = {
  courseId: string;
  name: string;
  savedAt: number;
  activeTab: string;
  expandedChapterId: string | null;
  basicInfo: {
    name: string;
    description: string;
    thumbnail_url: string;
    chapter_unlock_interval_days: string;
  };
  chapters: Chapter[];
  chapterContents: Record<string, ChapterContent[]>;
  assignments: Record<string, Assignment>;
};

const KEY = "admin_course_editor_draft_v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function loadCourseEditorDraft(courseId: string): CourseEditorDraft | null {
  const draft = readDraft();
  if (!draft || draft.courseId !== courseId) return null;
  return draft;
}

export function peekCourseEditorDraft(): { courseId: string; name: string; savedAt: number } | null {
  const draft = readDraft();
  if (!draft) return null;
  return { courseId: draft.courseId, name: draft.name, savedAt: draft.savedAt };
}

export function saveCourseEditorDraft(
  draft: Omit<CourseEditorDraft, "savedAt">,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    /* quota — drafting is best-effort */
  }
}

export function clearCourseEditorDraft(courseId?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (courseId) {
      const draft = readDraft();
      if (draft && draft.courseId !== courseId) return;
    }
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

function readDraft(): CourseEditorDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as CourseEditorDraft;
    if (!draft?.courseId || !draft.savedAt || Date.now() - draft.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}
