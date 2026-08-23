"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  BookOpen,
  FileText,
  Eye,
  AlertCircle,
  Loader2
} from "lucide-react";
import { FileUploadZone } from "./FileUploadZone";
import { ChapterContent } from "./ChapterContentManager";
import { Assignment } from "./AssignmentBuilder";
import { ChapterBuilderCard, type Chapter } from "./ChapterBuilderCard";
import { generateUUID } from "../../lib/uuid-utils";

export type { Chapter };

interface BasicInfo {
  name: string;
  description: string;
  thumbnail_url: string;
  /** Drip schedule: chapter K unlocks K * this many days after enrollment. Blank/0 = no drip. */
  chapter_unlock_interval_days: string;
}

interface WizardDraft {
  savedAt: number;
  basicInfo: BasicInfo;
  chapters: Chapter[];
  chapterContents: Record<string, ChapterContent[]>;
  assignments: Record<string, Assignment>;
  currentStep: number;
}

// Self-contained draft persistence so an in-progress course survives an
// accidental close/refresh. Restores the *complete* wizard state (including
// chapter content and assignments), unlike the previous write-only helper.
const DRAFT_KEY = "admin_course_wizard_draft_v1";
const DRAFT_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

function loadWizardDraft(): WizardDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as WizardDraft;
    if (!draft?.savedAt || Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
      window.localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function saveWizardDraft(draft: Omit<WizardDraft, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...draft, savedAt: Date.now() }),
    );
  } catch {
    // ignore quota / serialization errors — drafting is best-effort
  }
}

function clearWizardDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

/** Whether an in-progress (non-expired) wizard draft exists. */
export function hasWizardDraft(): boolean {
  return loadWizardDraft() !== null;
}

interface CourseCreationWizardProps {
  courseId?: string; // If provided, we're editing
  initialData?: {
    name?: string;
    description?: string;
    thumbnail_url?: string;
    school_ids?: string[];
    grades?: string[];
    chapters?: Chapter[];
  };
  onComplete: (courseData: Record<string, unknown>) => void | Promise<void>;
  onCancel: () => void;
}

// The builder is content-only. School / grade / section targeting is done
// separately in the Publish flow (setAccess), so there is no school step here.
const STEPS = [
  { id: 1, title: "Basic Information", icon: BookOpen },
  { id: 2, title: "Chapters & Content", icon: FileText },
  { id: 3, title: "Review", icon: Eye },
];

export function CourseCreationWizard({
  courseId,
  initialData,
  onComplete,
  onCancel,
}: CourseCreationWizardProps) {
  // Restore an in-progress draft only when creating (not editing an existing course).
  const draftRef = useRef<WizardDraft | null>(courseId ? null : loadWizardDraft());
  const draft = draftRef.current;

  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoredFromDraft, setRestoredFromDraft] = useState(!!draft);

  // Step 1: Basic Information
  const [basicInfo, setBasicInfo] = useState<BasicInfo>(
    draft?.basicInfo ?? {
      name: initialData?.name || "",
      description: initialData?.description || "",
      thumbnail_url: initialData?.thumbnail_url || "",
      chapter_unlock_interval_days:
        (initialData as { chapter_unlock_interval_days?: number })?.chapter_unlock_interval_days?.toString() || "",
    },
  );

  // Step 3: Chapters
  const [chapters, setChapters] = useState<Chapter[]>(
    draft?.chapters ?? initialData?.chapters ?? []
  );
  // Collapsed-by-default chapter list — only one chapter's content/assignment
  // builder is ever mounted at a time, so adding more chapters doesn't turn
  // this step into a long scroll (see ChapterBuilderCard).
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [chapterContents, setChapterContents] = useState<Record<string, ChapterContent[]>>(
    draft?.chapterContents ?? {}
  );
  const [assignments, setAssignments] = useState<Record<string, Assignment>>(
    draft?.assignments ?? {}
  );
  // Auto-save the full wizard state so an accidental close/refresh can be
  // recovered. Only persist when the form actually has content, and never
  // while editing an existing course.
  useEffect(() => {
    if (courseId) return;
    const hasContent =
      basicInfo.name.trim() !== "" ||
      basicInfo.description.trim() !== "" ||
      chapters.length > 0;
    if (!hasContent) {
      clearWizardDraft();
      return;
    }
    saveWizardDraft({
      basicInfo,
      chapters,
      chapterContents,
      assignments,
      currentStep,
    });
  }, [
    courseId,
    basicInfo,
    chapters,
    chapterContents,
    assignments,
    currentStep,
  ]);

  const validateStep = (step: number): boolean => {
    setError(null);
    
    switch (step) {
      case 1:
        if (!basicInfo.name.trim()) {
          setError("Course name is required");
          return false;
        }
        return true;
      
      case 2:
        if (chapters.length === 0) {
          setError("Please add at least one chapter");
          return false;
        }
        // Validate each chapter has a name
        for (const chapter of chapters) {
          if (!chapter.name.trim()) {
            setError("All chapters must have a name");
            return false;
          }
        }
        return true;

      case 3:
        return true; // Review step is always valid

      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < STEPS.length) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Jump directly to an already-visited step (validating each forward hop).
  const goToStep = (target: number) => {
    if (target === currentStep) return;
    if (target < currentStep) {
      setError(null);
      setCurrentStep(target);
      return;
    }
    for (let s = currentStep; s < target; s++) {
      if (!validateStep(s)) {
        setCurrentStep(s);
        return;
      }
    }
    setCurrentStep(target);
  };

  // Discard the recovered draft and start with an empty form.
  const startFresh = () => {
    clearWizardDraft();
    setBasicInfo({
      name: "",
      description: "",
      thumbnail_url: "",
      chapter_unlock_interval_days: "",
    });
    setChapters([]);
    setChapterContents({});
    setAssignments({});
    setCurrentStep(1);
    setError(null);
    setRestoredFromDraft(false);
  };

  const handleThumbnailUpload = (fileUrl: string) => {
    setBasicInfo({ ...basicInfo, thumbnail_url: fileUrl });
  };

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
    const updated = chapters
      .filter((_, i) => i !== index)
      .map((ch, i) => ({ ...ch, order_number: i + 1 }));
    setChapters(updated);
    const chapterId = chapters[index].id;
    if (chapterId) {
      const newContents = { ...chapterContents };
      const newAssignments = { ...assignments };
      delete newContents[chapterId];
      delete newAssignments[chapterId];
      setChapterContents(newContents);
      setAssignments(newAssignments);
      if (expandedChapterId === chapterId) setExpandedChapterId(null);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      setCurrentStep(1);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const courseData = {
        id: courseId,
        name: basicInfo.name,
        description: basicInfo.description || undefined,
        thumbnail_url: basicInfo.thumbnail_url || undefined,
        chapter_unlock_interval_days: basicInfo.chapter_unlock_interval_days
          ? parseInt(basicInfo.chapter_unlock_interval_days)
          : undefined,
        chapters: chapters.map((ch: Chapter) => ({
          ...ch,
          name: ch.name.trim(),
        })),
        chapter_contents: Object.entries(chapterContents).flatMap(([chapterId, contents]) =>
          contents.map((content, idx) => ({
            ...content,
            chapter_id: chapterId, // This should be the chapter UUID or temp ID
            order_index: content.order_index || idx + 1, // Ensure order_index is set
          }))
        ),
        assignments: Object.entries(assignments).map(([chapterId, assignment]) => ({
          ...assignment,
          chapter_id: chapterId,
        })),
        status: 'Draft',
      };

      // Await the parent's save so the button stays disabled until the
      // request actually resolves (prevents duplicate course creation), and
      // only clear the recovery draft once the save succeeds.
      await onComplete(courseData);
      clearWizardDraft();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save course");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onCancel(); }}>
      {/* Sized to always fit the viewport (never wider/taller than the frame),
          with the stepper and nav pinned and only the step body scrolling. */}
      <DialogContent className="grid max-h-[90vh] w-[calc(100vw-2rem)] grid-rows-[auto_1fr_auto] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <div className="border-b px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle>
              {courseId ? "Edit Course" : "Create New Course"}
            </DialogTitle>
            <DialogDescription>
              Follow the steps to create a comprehensive course
            </DialogDescription>
          </DialogHeader>

        {/* Step indicator — completed steps are clickable to jump back */}
        <div className="mt-5 flex items-center">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            const isClickable = step.id < currentStep && !loading;

            return (
              <div key={step.id} className="flex flex-1 items-center last:flex-none">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => goToStep(step.id)}
                  title={isClickable ? `Go to ${step.title}` : undefined}
                  className={`flex items-center gap-2.5 rounded-md px-1 py-1 text-left transition-colors ${
                    isClickable ? "cursor-pointer hover:opacity-80" : "cursor-default"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm transition-colors ${
                      isCompleted
                        ? "bg-blue-600 text-white"
                        : isActive
                        ? "bg-white text-blue-600 ring-2 ring-blue-600"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                  </span>
                  <span
                    className={`hidden text-sm sm:inline ${
                      isActive
                        ? "font-semibold text-gray-900"
                        : isCompleted
                        ? "font-medium text-gray-600"
                        : "text-gray-400"
                    }`}
                  >
                    {step.title}
                  </span>
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    className={`mx-3 h-px flex-1 transition-colors ${
                      isCompleted ? "bg-blue-600" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
        </div>

        {/* Scrollable step body — the only part that scrolls */}
        <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-5">
        {restoredFromDraft && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between gap-2">
            <span className="text-sm text-amber-800">
              Restored your unsaved course draft. Continue where you left off, or start over.
            </span>
            <Button type="button" variant="outline" size="sm" onClick={startFresh}>
              Start fresh
            </Button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-sm text-red-600">{error}</span>
          </div>
        )}

        {/* Step Content */}
        <div className="min-h-[400px]">
          {currentStep === 1 && (
            <div className="max-w-2xl space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="course-name" className="text-sm font-medium">
                  Course name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="course-name"
                  value={basicInfo.name}
                  onChange={(e) => setBasicInfo({ ...basicInfo, name: e.target.value })}
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
                  onChange={(e) => setBasicInfo({ ...basicInfo, description: e.target.value })}
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
                    courseId={courseId}
                    onUploadComplete={handleThumbnailUpload}
                    description="PNG or JPG, recommended 800×600px, max 5MB"
                  />
                )}
              </div>
            </div>
          )}

          {currentStep === 2 && (
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

              <Card>
                <CardContent className="py-4 space-y-2">
                  <Label htmlFor="chapter_unlock_interval_days" className="text-sm font-medium">
                    Chapter release schedule
                  </Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id="chapter_unlock_interval_days"
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
                      ? `Chapter 1 unlocks at enrollment; each later chapter unlocks ${basicInfo.chapter_unlock_interval_days} day(s) after enrollment, per chapter position — but only once the previous chapter is also completed.`
                      : "No drip — chapters unlock as soon as the previous one is completed (today's default behavior)."}
                  </p>
                </CardContent>
              </Card>

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
                <div className="space-y-3">
                  {chapters.map((chapter, index) => {
                    // Stable key shared by the React key, the content/assignment
                    // store, and the child managers so nothing desyncs when a
                    // chapter is deleted or reordered.
                    const chapterKey = chapter.id || `temp-${index}`;
                    return (
                    <ChapterBuilderCard
                      key={chapterKey}
                      chapter={chapter}
                      chapterKey={chapterKey}
                      index={index}
                      isExpanded={expandedChapterId === chapterKey}
                      onToggleExpand={() =>
                        setExpandedChapterId(expandedChapterId === chapterKey ? null : chapterKey)
                      }
                      onUpdate={(updates) => updateChapter(index, updates)}
                      onDelete={() => deleteChapter(index)}
                      onMoveUp={index === 0 ? undefined : () => moveChapter(index, 'up')}
                      onMoveDown={index === chapters.length - 1 ? undefined : () => moveChapter(index, 'down')}
                      contents={chapterContents[chapterKey] || []}
                      onContentsChange={(contents) => {
                        setChapterContents({
                          ...chapterContents,
                          [chapterKey]: contents,
                        });
                      }}
                      assignment={assignments[chapterKey] || null}
                      onAssignmentChange={(assignment) => {
                        if (assignment) {
                          setAssignments({
                            ...assignments,
                            [chapterKey]: assignment,
                          });
                        } else {
                          const updated = { ...assignments };
                          delete updated[chapterKey];
                          setAssignments(updated);
                        }
                      }}
                      courseId={courseId}
                    />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="font-medium text-lg">Review Course Details</h3>

              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <span className="font-medium">Name:</span> {basicInfo.name}
                  </div>
                  {basicInfo.description && (
                    <div>
                      <span className="font-medium">Description:</span> {basicInfo.description}
                    </div>
                  )}
                  {basicInfo.thumbnail_url && (
                    <div className="relative h-24 w-36 mt-1">
                      <Image
                        src={basicInfo.thumbnail_url}
                        alt="Course thumbnail"
                        fill
                        className="object-contain rounded border"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                This saves the course content as a <strong>Draft</strong>. Choose which
                schools, grades and sections get it — and publish — from the course&apos;s
                <strong> Publish</strong> action afterward.
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Chapters & Content</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    <span>
                      <span className="font-medium">Chapters:</span> {chapters.length}
                    </span>
                    <span>
                      <span className="font-medium">Content items:</span>{" "}
                      {Object.values(chapterContents).reduce((sum, list) => sum + list.length, 0)}
                    </span>
                    <span>
                      <span className="font-medium">Assignments:</span> {Object.keys(assignments).length}
                    </span>
                  </div>
                  <div className="divide-y rounded-md border">
                    {chapters.map((chapter, index) => {
                      const chapterKey = chapter.id || `temp-${index}`;
                      const contentCount = (chapterContents[chapterKey] || []).length;
                      const hasAssignment = !!assignments[chapterKey];
                      return (
                        <div key={chapterKey} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="font-medium text-gray-800">
                            {index + 1}. {chapter.name.trim() || `Chapter ${index + 1}`}
                          </span>
                          <span className="flex items-center gap-2 text-xs text-gray-500">
                            <Badge variant="secondary">{contentCount} content</Badge>
                            <Badge variant={hasAssignment ? "default" : "outline"}>
                              {hasAssignment ? "Assignment" : "No assignment"}
                            </Badge>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        </div>

        {/* Navigation */}
        <DialogFooter className="flex items-center justify-between border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={currentStep === 1 ? onCancel : handlePrevious}
            disabled={loading}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {currentStep === 1 ? "Cancel" : "Previous"}
          </Button>
          
          <div className="flex gap-2">
            {currentStep < STEPS.length ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={loading}
              >
                Next
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Save Course
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

