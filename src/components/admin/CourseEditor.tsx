"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  FileText,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { FileUploadZone } from "./FileUploadZone";
import { ChapterContentManager, ChapterContent } from "./ChapterContentManager";
import { AssignmentBuilder, Assignment } from "./AssignmentBuilder";
import { adminApi } from "../../lib/api/admin.api";
import { generateUUID } from "../../lib/uuid-utils";

export interface Chapter {
  id?: string;
  course_id?: string;
  name: string;
  description?: string;
  learning_outcomes: string[];
  order_number: number;
  contents?: ChapterContent[];
  title?: string;
  [key: string]: unknown;
}

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
  duration_weeks?: number;
  prerequisites_course_ids?: string[];
  prerequisites_text?: string;
  thumbnail_url?: string;
  school_ids?: string[];
  grades?: string[];
  status?: "Draft" | "Published" | "Archived";
  chapters?: Chapter[];
  assignments?: AssignmentFromAPI[];
  chapter_contents?: ChapterContentFromAPI[];
  videos?: VideoFromAPI[];
  difficulty_level?: string;
  [key: string]: unknown;
}

interface CourseData {
  id: string;
  name: string;
  description?: string;
  duration_weeks?: number;
  prerequisites_course_ids?: string[];
  prerequisites_text?: string;
  thumbnail_url?: string;
  difficulty_level?: string;
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
    duration_weeks: course.duration_weeks?.toString() || "",
    prerequisites_text: course.prerequisites_text || "",
    prerequisites_course_ids: course.prerequisites_course_ids || [] as string[],
    thumbnail_url: course.thumbnail_url || "",
    difficulty_level: course.difficulty_level || "Beginner",
  });

  const [allCourses, setAllCourses] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    adminApi.courses.list().then(({ data }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list = (data as any)?.courses ?? (Array.isArray(data) ? data : []);
      setAllCourses(
        (list as Array<{ id: string; title?: string; name?: string }>)
          .filter((c) => c.id !== course.id)
          .map((c) => ({ id: c.id, name: c.title ?? c.name ?? c.id }))
      );
    }).catch(() => {});
  }, [course.id]);

  const [chapters, setChapters] = useState<Chapter[]>(() =>
    dedupeChapters(course.chapters || [])
  );
  const [pendingDeleteChapterIndex, setPendingDeleteChapterIndex] = useState<number | null>(null);

  const [chapterContents, setChapterContents] = useState<Record<string, ChapterContent[]>>({});
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [videos, setVideos] = useState<
    Array<{ chapter_id: string; title: string; video_url: string; duration?: number }>
  >([]);

  // Load chapter contents from nested chapters or top-level chapter_contents
  const loadChapterContents = useCallback(() => {
    const chaptersToUse = course.chapters || chapters;
    const contents: Record<string, ChapterContent[]> = {};

    chaptersToUse.forEach((ch: Chapter) => {
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

    setChapterContents(contents);
  }, [course.chapters, course.chapter_contents, chapters]);

  // Load assignments: group by chapter_id
  const loadAssignments = useCallback(() => {
    const chaptersToUse = course.chapters || chapters;
    const apiAssignments = course.assignments || [];
    const result: Record<string, Assignment> = {};

    apiAssignments.forEach((a: AssignmentFromAPI) => {
      let chapterId = a.chapter_id || null;

      // Fallback: parse from config for old data
      if (!chapterId && a.config) {
        try {
          const cfg =
            typeof a.config === "string" ? JSON.parse(a.config) : a.config;
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

    setAssignments(result);
  }, [course.assignments, course.chapters, chapters]);

  useEffect(() => {
    setChapters(dedupeChapters(course.chapters || []));
  }, [course.chapters]);

  useEffect(() => {
    loadChapterContents();
  }, [loadChapterContents]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

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
    }
    setPendingDeleteChapterIndex(null);
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
        duration_weeks: basicInfo.duration_weeks
          ? parseInt(basicInfo.duration_weeks)
          : undefined,
        prerequisites_course_ids:
          basicInfo.prerequisites_course_ids.length > 0
            ? basicInfo.prerequisites_course_ids
            : undefined,
        prerequisites_text: basicInfo.prerequisites_text || undefined,
        thumbnail_url: basicInfo.thumbnail_url || undefined,
        difficulty_level: basicInfo.difficulty_level || "Beginner",
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
    <div className="space-y-4">
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="basic">
            <BookOpen className="h-4 w-4 mr-2" />
            Basic Info
          </TabsTrigger>
          <TabsTrigger value="chapters">
            <FileText className="h-4 w-4 mr-2" />
            Chapters
          </TabsTrigger>
        </TabsList>

        {/* Basic Info */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Update course name, description, and other basic details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="course-name">
                  Course Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="course-name"
                  value={basicInfo.name}
                  onChange={(e) =>
                    setBasicInfo({ ...basicInfo, name: e.target.value })
                  }
                  placeholder="Enter course name"
                />
              </div>

              <div>
                <Label htmlFor="course-description">Description</Label>
                <Textarea
                  id="course-description"
                  value={basicInfo.description}
                  onChange={(e) =>
                    setBasicInfo({ ...basicInfo, description: e.target.value })
                  }
                  placeholder="Enter course description"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="duration">Duration (weeks)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    value={basicInfo.duration_weeks}
                    onChange={(e) =>
                      setBasicInfo({ ...basicInfo, duration_weeks: e.target.value })
                    }
                    placeholder="e.g., 8"
                  />
                </div>
                <div>
                  <Label htmlFor="difficulty">Difficulty Level</Label>
                  <Select
                    value={basicInfo.difficulty_level}
                    onValueChange={(value) =>
                      setBasicInfo({
                        ...basicInfo,
                        difficulty_level: value as "Beginner" | "Intermediate" | "Advanced",
                      })
                    }
                  >
                    <SelectTrigger id="difficulty">
                      <SelectValue placeholder="Select difficulty level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Beginner">Beginner</SelectItem>
                      <SelectItem value="Intermediate">Intermediate</SelectItem>
                      <SelectItem value="Advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Prerequisites</Label>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="prerequisites-text" className="text-sm font-normal">
                      Prerequisites Description
                    </Label>
                    <Textarea
                      id="prerequisites-text"
                      value={basicInfo.prerequisites_text}
                      onChange={(e) =>
                        setBasicInfo({ ...basicInfo, prerequisites_text: e.target.value })
                      }
                      placeholder="e.g., Basic programming knowledge recommended"
                      rows={2}
                    />
                  </div>
                  {allCourses.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-normal">Prerequisite Courses</Label>
                      <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-1.5">
                        {allCourses.map((c) => {
                          const checked = basicInfo.prerequisites_course_ids.includes(c.id);
                          return (
                            <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const ids = e.target.checked
                                    ? [...basicInfo.prerequisites_course_ids, c.id]
                                    : basicInfo.prerequisites_course_ids.filter((id) => id !== c.id);
                                  setBasicInfo({ ...basicInfo, prerequisites_course_ids: ids });
                                }}
                                className="rounded"
                              />
                              <span>{c.name}</span>
                            </label>
                          );
                        })}
                      </div>
                      {basicInfo.prerequisites_course_ids.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {basicInfo.prerequisites_course_ids.map((id) => {
                            const c = allCourses.find((x) => x.id === id);
                            return c ? (
                              <Badge key={id} variant="secondary" className="text-xs">
                                {c.name}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>Course Thumbnail</Label>
                <FileUploadZone
                  type="thumbnail"
                  courseId={course.id}
                  onUploadComplete={(url) =>
                    setBasicInfo({ ...basicInfo, thumbnail_url: url })
                  }
                  label="Upload thumbnail image"
                  description="Recommended: 800x600px, max 5MB"
                />
                {basicInfo.thumbnail_url && (
                  <div className="mt-2 relative h-32 w-48">
                    <Image
                      src={basicInfo.thumbnail_url}
                      alt="Course thumbnail"
                      fill
                      className="object-contain rounded border"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chapters */}
        <TabsContent value="chapters" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Chapters & Content</CardTitle>
                  <CardDescription>
                    Manage chapters, content, and assignments
                  </CardDescription>
                </div>
                <Button type="button" onClick={addChapter}>
                  <span className="mr-1">+</span> Add Chapter
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {chapters.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No chapters added yet</p>
                  <Button type="button" onClick={addChapter} className="mt-4">
                    Add First Chapter
                  </Button>
                </div>
              ) : (
                chapters.map((chapter, index) => {
                  const chapterId = chapter.id!;
                  return (
                    <Card key={chapterId}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <Input
                              value={chapter.name}
                              onChange={(e) =>
                                updateChapter(index, { name: e.target.value })
                              }
                              placeholder="Chapter name"
                              className="font-medium"
                            />
                            <Textarea
                              value={chapter.description || ""}
                              onChange={(e) =>
                                updateChapter(index, { description: e.target.value })
                              }
                              placeholder="Chapter description"
                              rows={2}
                            />
                          </div>
                          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => moveChapter(index, 'up')}
                              disabled={index === 0}
                              title="Move up"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => moveChapter(index, 'down')}
                              disabled={index === chapters.length - 1}
                              title="Move down"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                            {pendingDeleteChapterIndex === index ? (
                              <>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteChapter(index)}
                                >
                                  Confirm
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPendingDeleteChapterIndex(null)}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setPendingDeleteChapterIndex(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <ChapterContentManager
                          chapterId={chapterId}
                          chapterName={chapter.name || `Chapter ${index + 1}`}
                          contents={chapterContents[chapterId] || []}
                          onContentsChange={(contents) =>
                            setChapterContents((prev) => ({
                              ...prev,
                              [chapterId]: contents,
                            }))
                          }
                          courseId={course.id}
                          onVideoAdded={(video) =>
                            setVideos((prev) => [...prev, video])
                          }
                        />
                        <AssignmentBuilder
                          chapterId={chapterId}
                          chapterName={chapter.name || `Chapter ${index + 1}`}
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
                        />
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <div className="flex items-center justify-end gap-2">
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
    </div>
  );
}
