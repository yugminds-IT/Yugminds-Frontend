"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  FileText,
} from "lucide-react";
import { FileUploadZone } from "./FileUploadZone";
import { ChapterContent } from "./ChapterContentManager";
import { Assignment } from "./AssignmentBuilder";
import { ChapterBuilderCard, type Chapter } from "./ChapterBuilderCard";
import { generateUUID } from "../../lib/uuid-utils";

export type { Chapter };

export interface AssignmentFromAPI {
  id?: string;
  title?: string;
  description?: string;
  chapter_id?: string;
  max_score?: number;
  max_marks?: number;
  auto_grading_enabled?: boolean;
  assignment_type?: string;
  questions?: unknown[];
  config?: string | Record<string, unknown>;
  [key: string]: unknown;
}

interface ChapterContentFromAPI {
  id?: string;
  content_id?: string;
  chapter_id?: string;
  content_type?: string;
  title?: string;
  content_url?: string;
  content_text?: string;
  duration_minutes?: number;
  storage_path?: string;
  order_index?: number;
  [key: string]: unknown;
}

interface VideoFromAPI {
  chapter_id?: string;
  title?: string;
  video_url?: string;
  duration?: number;
  [key: string]: unknown;
}

interface CourseFromAPI {
  id: string;
  name?: string;
  course_name?: string;
  title?: string;
  description?: string;
  thumbnail_url?: string;
  school_ids?: string[];
  grades?: string[];
  status?: "Draft" | "Published" | "Archived";
  chapters?: Chapter[];
  assignments?: AssignmentFromAPI[];
  chapter_contents?: ChapterContentFromAPI[];
  videos?: VideoFromAPI[];
  /** Drip schedule: chapter K unlocks K * this many days after enrollment. null/0 = no drip. */
  chapter_unlock_interval_days?: number | null;
  [key: string]: unknown;
}

interface CourseData {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  chapter_unlock_interval_days?: number;
  chapters: Chapter[];
  assignments?: AssignmentFromAPI[];
  videos?: Array<{ chapter_id: string; title: string; video_url: string; duration?: number }>;
  [key: string]: unknown;
}

interface CourseEditorProps {
  course: CourseFromAPI;
  onSave: (courseData: CourseData) => void | Promise<void>;
  onCancel?: () => void;
}

function normalizeContent(
  content: ChapterContent | ChapterContentFromAPI,
  chapterId: string
): ChapterContent {
  return {
    id: content.id ?? (content as ChapterContentFromAPI).content_id,
    content_id: (content as ChapterContentFromAPI).content_id ?? content.id,
    chapter_id: ((content as { chapter_id?: string }).chapter_id ?? chapterId) as string,
    content_type: (
      (content as { content_type?: string }).content_type === "material"
        ? "text"
        : (content as { content_type?: string }).content_type ?? "text"
    ) as ChapterContent["content_type"],
    title: content.title ?? "",
    content_url: (content as { content_url?: string | null }).content_url ?? undefined,
    content_text: (content as { content_text?: string | null }).content_text ?? undefined,
    duration_minutes:
      (content as { duration_minutes?: number | null }).duration_minutes ?? undefined,
    storage_path: (content as { storage_path?: string | null }).storage_path ?? undefined,
    order_index: (content as { order_index?: number }).order_index ?? 0,
  };
}

function computeInitialChapterContents(
  course: CourseFromAPI
): Record<string, ChapterContent[]> {
  const contents: Record<string, ChapterContent[]> = {};

  (course.chapters || []).forEach((ch: Chapter) => {
    if (!ch.id) return;
    const nested = ch.contents || [];
    contents[ch.id] = nested.map((c) => normalizeContent(c, ch.id!));
  });

  const totalNested = Object.values(contents).reduce((s, a) => s + a.length, 0);
  if (totalNested === 0 && course.chapter_contents) {
    course.chapter_contents.forEach((c) => {
      const cid = c.chapter_id;
      if (!cid) return;
      if (!contents[cid]) contents[cid] = [];
      contents[cid].push(normalizeContent(c, cid));
    });
  }

  return contents;
}

function computeInitialAssignments(course: CourseFromAPI): Record<string, Assignment> {
  const chaptersToUse = course.chapters || [];
  const apiAssignments = course.assignments || [];
  const result: Record<string, Assignment> = {};

  apiAssignments.forEach((a: AssignmentFromAPI) => {
    let chapterId = a.chapter_id || null;

    // Fallback: parse from config for old data
    if (!chapterId && a.config) {
      try {
        const cfg = typeof a.config === "string" ? JSON.parse(a.config) : a.config;
        chapterId = cfg.chapter_id || null;
      } catch {
        // ignore
      }
    }

    if (!chapterId) return;

    const matchingChapter = chaptersToUse.find((ch) => ch.id === chapterId);
    const key = matchingChapter?.id || chapterId;

    result[key] = {
      id: a.id,
      chapter_id: key,
      title: a.title || "",
      description: a.description || "",
      max_score: a.max_score ?? a.max_marks ?? 100,
      auto_grading_enabled: a.auto_grading_enabled ?? false,
      questions: (a.questions as Assignment["questions"]) || [],
    };
  });

  return result;
}

function dedupeChapters(chapters: Chapter[]): Chapter[] {
  const seen = new Set<string>();
  return chapters.reduce<Chapter[]>((acc, ch) => {
    const id = ch.id || generateUUID();
    if (!seen.has(id)) {
      seen.add(id);
      acc.push({ ...ch, id });
    }
    return acc;
  }, []);
}

export function CourseEditor({ course, onSave, onCancel }: CourseEditorProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");

  const [basicInfo, setBasicInfo] = useState({
    name: course.name || "",
    description: course.description || "",
    thumbnail_url: course.thumbnail_url || "",
    chapter_unlock_interval_days: course.chapter_unlock_interval_days?.toString() || "",
  });

  const [chapters, setChapters] = useState<Chapter[]>(() =>
    dedupeChapters(course.chapters || [])
  );
  // Collapsed-by-default chapter list — only one chapter's content/assignment
  // builder is ever mounted at a time (see ChapterBuilderCard).
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);

  // Seeded once from the initial `course` prop (CourseEditor is remounted
  // fresh per edit session, see admin/courses/page.tsx). Must NOT be a
  // useEffect keyed off `course`/`chapters`: chapters state changes on every
  // add/delete/reorder, and re-deriving these from the original prop on each
  // of those changes silently wiped unsaved content/assignment edits.
  const [chapterContents, setChapterContents] = useState<Record<string, ChapterContent[]>>(
    () => computeInitialChapterContents(course)
  );
  const [assignments, setAssignments] = useState<Record<string, Assignment>>(() =>
    computeInitialAssignments(course)
  );
  const [videos, setVideos] = useState<
    Array<{ chapter_id: string; title: string; video_url: string; duration?: number }>
  >([]);

  useEffect(() => {
    if (course.videos && Array.isArray(course.videos)) {
      setVideos(
        course.videos.map((v: VideoFromAPI) => ({
          chapter_id: v.chapter_id || "",
          title: v.title || "",
          video_url: v.video_url || "",
          duration: v.duration || undefined,
        }))
      );
    }
  }, [course.videos]);

  const addChapter = () => {
    const newChapter: Chapter = {
      id: generateUUID(),
      name: "",
      description: "",
      learning_outcomes: [],
      order_number: chapters.length + 1,
    };
    setChapters([...chapters, newChapter]);
    setExpandedChapterId(newChapter.id ?? null);
  };

  const updateChapter = (index: number, updates: Partial<Chapter>) => {
    const updated = [...chapters];
    updated[index] = { ...updated[index], ...updates };
    setChapters(updated);
  };

  const moveChapter = (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= chapters.length) return;
    const updated = [...chapters];
    [updated[index], updated[swapIndex]] = [updated[swapIndex], updated[index]];
    setChapters(updated.map((ch, i) => ({ ...ch, order_number: i + 1 })));
  };

  const deleteChapter = (index: number) => {
    const chapterId = chapters[index].id;
    const updated = chapters
      .filter((_, i) => i !== index)
      .map((ch, i) => ({ ...ch, order_number: i + 1 }));
    setChapters(updated);
    if (chapterId) {
      setChapterContents((prev) => {
        const next = { ...prev };
        delete next[chapterId];
        return next;
      });
      setAssignments((prev) => {
        const next = { ...prev };
        delete next[chapterId];
        return next;
      });
      if (expandedChapterId === chapterId) setExpandedChapterId(null);
    }
  };

  const handleSave = async () => {
    if (!basicInfo.name.trim()) {
      setError("Course name is required");
      setActiveTab("basic");
      return;
    }

    // Validate assignments
    for (const [chapterId, a] of Object.entries(assignments)) {
      if (!a.title?.trim()) {
        setError(`Assignment for chapter is missing a title`);
        setActiveTab("chapters");
        return;
      }
      if (!chapterId) {
        setError(`Assignment "${a.title}" is missing a chapter`);
        setActiveTab("chapters");
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const assignmentsArray: AssignmentFromAPI[] = Object.entries(assignments).map(
        ([chapterId, a]) => ({
          ...a,
          id: a.id ?? generateUUID(),
          chapter_id: chapterId,
          assignment_type:
            (a as AssignmentFromAPI).assignment_type ?? "essay",
          max_score: a.max_score ?? 100,
          max_marks: (a as AssignmentFromAPI).max_marks ?? a.max_score ?? 100,
        })
      );

      const courseData: CourseData = {
        id: course.id,
        name: basicInfo.name.trim(),
        description: basicInfo.description || undefined,
        thumbnail_url: basicInfo.thumbnail_url || undefined,
        // Always sent explicitly (0 when cleared, not undefined) — unlike
        // the other optional fields above, the backend only touches this
        // column when the key is present at all, so omitting it would make
        // clearing the field in this editor silently no-op instead of
        // actually turning drip off.
        chapter_unlock_interval_days: basicInfo.chapter_unlock_interval_days
          ? parseInt(basicInfo.chapter_unlock_interval_days)
          : 0,
        chapters: chapters.map((ch) => ({ ...ch, name: ch.name.trim() })),
        chapter_contents: Object.entries(chapterContents).flatMap(
          ([chapterId, contents]) =>
            contents.map((c) => ({ ...c, chapter_id: chapterId }))
        ),
        assignments: assignmentsArray,
        videos:
          videos.length > 0
            ? videos.map((v) => ({
                chapter_id: v.chapter_id,
                title: v.title,
                video_url: v.video_url,
                duration: v.duration || undefined,
              }))
            : undefined,
        status: course.status,
      };

      await Promise.resolve(onSave(courseData));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save course");
    } finally {
      setSaving(false);
    }
  };

  return (
    /* Same pinned-header / scrolling-body / pinned-footer shape as the create
       wizard, so the tab bar and Save button never scroll out of reach. */
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="grid min-h-0 grid-rows-[auto_1fr_auto] gap-0 overflow-hidden"
    >
      <div className="border-b px-6 pt-5 pb-4">
        <TabsList>
          <TabsTrigger value="basic">
            <BookOpen className="h-4 w-4 mr-2" />
            Basic Info
          </TabsTrigger>
          <TabsTrigger value="chapters">
            <FileText className="h-4 w-4 mr-2" />
            Chapters
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-5">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-600">
            Course saved successfully!
          </AlertDescription>
        </Alert>
      )}

        {/* Basic Info */}
        <TabsContent value="basic" className="mt-0">
          <div className="max-w-2xl space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="course-name" className="text-sm font-medium">
                  Course name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="course-name"
                  value={basicInfo.name}
                  onChange={(e) =>
                    setBasicInfo({ ...basicInfo, name: e.target.value })
                  }
                  placeholder="e.g. Introduction to Block Coding"
                />
                <p className="text-xs text-gray-500">
                  Shown to students in the course catalog.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="course-description" className="text-sm font-medium">
                  Description
                </Label>
                <Textarea
                  id="course-description"
                  value={basicInfo.description}
                  onChange={(e) =>
                    setBasicInfo({ ...basicInfo, description: e.target.value })
                  }
                  placeholder="What students will learn in this course"
                  rows={4}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Course thumbnail</Label>
                {basicInfo.thumbnail_url ? (
                  <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                    <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded border bg-gray-50">
                      <Image
                        src={basicInfo.thumbnail_url}
                        alt="Course thumbnail"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">Thumbnail uploaded</p>
                      <p className="text-xs text-gray-500">Recommended 800×600px</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setBasicInfo({ ...basicInfo, thumbnail_url: "" })}
                    >
                      Replace
                    </Button>
                  </div>
                ) : (
                  <FileUploadZone
                    type="thumbnail"
                    courseId={course.id}
                    onUploadComplete={(url) =>
                      setBasicInfo({ ...basicInfo, thumbnail_url: url })
                    }
                    description="PNG or JPG, recommended 800×600px, max 5MB"
                  />
                )}
              </div>
          </div>
        </TabsContent>

        {/* Chapters */}
        <TabsContent value="chapters" className="mt-0">
          <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900">Curriculum</h3>
                  <p className="text-sm text-gray-500">
                    {chapters.length === 0
                      ? "Add chapters and organize course content"
                      : `${chapters.length} chapter${chapters.length !== 1 ? "s" : ""} • ${Object.values(chapterContents).reduce((sum, list) => sum + list.length, 0)} content item${Object.values(chapterContents).reduce((sum, list) => sum + list.length, 0) !== 1 ? "s" : ""} • ${Object.keys(assignments).length} assignment${Object.keys(assignments).length !== 1 ? "s" : ""}`}
                  </p>
                </div>
                <Button type="button" onClick={addChapter}>
                  <span className="mr-1">+</span> Add Chapter
                </Button>
              </div>
              <div className="rounded-md border p-3 space-y-2">
                <Label htmlFor="edit_chapter_unlock_interval_days" className="text-sm font-medium">
                  Chapter release schedule
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="edit_chapter_unlock_interval_days"
                    type="number"
                    min="0"
                    className="w-28"
                    placeholder="0"
                    value={basicInfo.chapter_unlock_interval_days}
                    onChange={(e) =>
                      setBasicInfo({ ...basicInfo, chapter_unlock_interval_days: e.target.value })
                    }
                  />
                  <span className="text-sm text-gray-500">day(s) between each chapter unlocking</span>
                  <div className="flex gap-1 ml-2">
                    {[
                      { label: "Daily", value: "1" },
                      { label: "Weekly", value: "7" },
                      { label: "Every 2 weeks", value: "14" },
                    ].map((preset) => (
                      <Button
                        key={preset.value}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setBasicInfo({ ...basicInfo, chapter_unlock_interval_days: preset.value })
                        }
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  {basicInfo.chapter_unlock_interval_days && Number(basicInfo.chapter_unlock_interval_days) > 0
                    ? `Chapter 1 unlocks at enrollment; each later chapter unlocks ${basicInfo.chapter_unlock_interval_days} day(s) after enrollment, per chapter position — but only once the previous chapter is also completed. Applies immediately to every enrolled student.`
                    : "No drip — chapters unlock as soon as the previous one is completed."}
                </p>
              </div>

              {chapters.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-6 py-12 text-center">
                  <FileText className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                  <p className="font-medium text-gray-700">No chapters yet</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Chapters group your videos, readings and assignments.
                  </p>
                  <Button type="button" onClick={addChapter} className="mt-4">
                    <span className="mr-1">+</span> Add First Chapter
                  </Button>
                </div>
              ) : (
                chapters.map((chapter, index) => {
                  const chapterId = chapter.id!;
                  return (
                    <ChapterBuilderCard
                      key={chapterId}
                      chapter={chapter}
                      chapterKey={chapterId}
                      index={index}
                      isExpanded={expandedChapterId === chapterId}
                      onToggleExpand={() =>
                        setExpandedChapterId(expandedChapterId === chapterId ? null : chapterId)
                      }
                      onUpdate={(updates) => updateChapter(index, updates)}
                      onDelete={() => deleteChapter(index)}
                      onMoveUp={index === 0 ? undefined : () => moveChapter(index, 'up')}
                      onMoveDown={index === chapters.length - 1 ? undefined : () => moveChapter(index, 'down')}
                      contents={chapterContents[chapterId] || []}
                      onContentsChange={(contents) =>
                        setChapterContents((prev) => ({
                          ...prev,
                          [chapterId]: contents,
                        }))
                      }
                      assignment={
                        assignments[chapterId]
                          ? {
                              ...assignments[chapterId],
                              questions: Array.isArray(
                                assignments[chapterId].questions
                              )
                                ? assignments[chapterId].questions
                                : [],
                            }
                          : null
                      }
                      onAssignmentChange={(assignment) => {
                        if (assignment) {
                          setAssignments((prev) => ({
                            ...prev,
                            [chapterId]: {
                              ...assignment,
                              chapter_id: chapterId,
                              id: assignment.id || generateUUID(),
                            },
                          }));
                        } else {
                          setAssignments((prev) => {
                            const next = { ...prev };
                            delete next[chapterId];
                            return next;
                          });
                        }
                      }}
                      courseId={course.id}
                      onVideoAdded={(video) =>
                        setVideos((prev) => [...prev, video])
                      }
                    />
                  );
                })
              )}
          </div>
        </TabsContent>
      </div>

      <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </Tabs>
  );
}
