"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  BookOpen,
  FileText,
  Eye,
  AlertCircle,
  Loader2
} from "lucide-react";
import { FileUploadZone } from "./FileUploadZone";
import { ChapterContentManager, ChapterContent } from "./ChapterContentManager";
import { AssignmentBuilder, Assignment } from "./AssignmentBuilder";
import { adminApi } from "../../lib/api/admin.api";

export interface Chapter {
  id?: string;
  course_id?: string;
  name: string;
  description?: string;
  learning_outcomes: string[];
  order_number: number;
  [key: string]: unknown;
}

interface BasicInfo {
  name: string;
  description: string;
  duration_weeks: string;
  prerequisites_text: string;
  prerequisites_course_ids: string[];
  thumbnail_url: string;
  difficulty_level: string;
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

interface CourseCreationWizardProps {
  courseId?: string; // If provided, we're editing
  initialData?: {
    name?: string;
    description?: string;
    duration_weeks?: number;
    prerequisites_course_ids?: string[];
    prerequisites_text?: string;
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
      duration_weeks: initialData?.duration_weeks?.toString() || "",
      prerequisites_text: initialData?.prerequisites_text || "",
      prerequisites_course_ids: initialData?.prerequisites_course_ids || [],
      thumbnail_url: initialData?.thumbnail_url || "",
      difficulty_level: (initialData as { difficulty_level?: string })?.difficulty_level || "Beginner",
    },
  );

  // Step 3: Chapters
  const [chapters, setChapters] = useState<Chapter[]>(
    draft?.chapters ?? initialData?.chapters ?? []
  );
  const [pendingDeleteChapterIndex, setPendingDeleteChapterIndex] = useState<number | null>(null);
  const [chapterContents, setChapterContents] = useState<Record<string, ChapterContent[]>>(
    draft?.chapterContents ?? {}
  );
  const [assignments, setAssignments] = useState<Record<string, Assignment>>(
    draft?.assignments ?? {}
  );
  const [availableCourses, setAvailableCourses] = useState<Array<{ id: string; name: string }>>([]);

  // Load available courses for prerequisites once on mount (needed by both the
  // basic-info step and the review step, which a restored draft can open on).
  useEffect(() => {
    loadAvailableCourses();
  /* eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount */
  }, []);

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

  const loadAvailableCourses = async () => {
    try {
      const { data } = await adminApi.courses.list();
      type CourseItem = { id: string; name?: string; course_name?: string; title?: string };
      const raw = (data?.courses || data || []) as CourseItem[];
      const courses = raw
        .filter((c: CourseItem) => !courseId || c.id !== courseId)
        .map((c: CourseItem) => ({
          id: c.id,
          name: c.name || c.course_name || c.title || "Untitled Course",
        }));
      setAvailableCourses(courses);
    } catch {
      // non-critical: prerequisite courses list is optional
    }
  };

  const validateStep = (step: number): boolean => {
    setError(null);
    
    switch (step) {
      case 1:
        if (!basicInfo.name.trim()) {
          setError("Course name is required");
          return false;
        }
        if (basicInfo.duration_weeks.trim() !== "") {
          const weeks = Number(basicInfo.duration_weeks);
          if (!Number.isInteger(weeks) || weeks < 1) {
            setError("Duration must be a whole number of weeks (1 or more)");
            return false;
          }
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
      duration_weeks: "",
      prerequisites_text: "",
      prerequisites_course_ids: [],
      thumbnail_url: "",
      difficulty_level: "Beginner",
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

  // Generate UUID for new chapters
  const generateChapterId = () => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `chapter-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  };

  const addChapter = () => {
    const newChapter: Chapter = {
      id: generateChapterId(), // Generate UUID for new chapter
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

  const deleteChapter = (index: number) => {
    const updated = chapters.filter((_, i) => i !== index);
    updated.forEach((ch, i) => {
      ch.order_number = i + 1;
    });
    setChapters(updated);
    const chapterId = chapters[index].id;
    if (chapterId) {
      const newContents = { ...chapterContents };
      const newAssignments = { ...assignments };
      delete newContents[chapterId];
      delete newAssignments[chapterId];
      setChapterContents(newContents);
      setAssignments(newAssignments);
    }
    setPendingDeleteChapterIndex(null);
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
        duration_weeks: basicInfo.duration_weeks ? parseInt(basicInfo.duration_weeks) : undefined,
        prerequisites_course_ids: basicInfo.prerequisites_course_ids.length > 0 
          ? basicInfo.prerequisites_course_ids 
          : undefined,
        prerequisites_text: basicInfo.prerequisites_text || undefined,
        thumbnail_url: basicInfo.thumbnail_url || undefined,
        difficulty_level: basicInfo.difficulty_level || "Beginner",
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

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {courseId ? "Edit Course" : "Create New Course"}
          </DialogTitle>
          <DialogDescription>
            Follow the steps to create a comprehensive course
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              const Icon = isCompleted ? CheckCircle2 : isActive ? StepIcon : Circle;
              
              const isClickable = step.id < currentStep && !loading;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <button
                      type="button"
                      disabled={!isClickable}
                      onClick={() => goToStep(step.id)}
                      title={isClickable ? `Go to ${step.title}` : undefined}
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                        isActive
                          ? "border-blue-500 bg-blue-50 text-blue-600"
                          : isCompleted
                          ? "border-green-500 bg-green-50 text-green-600"
                          : "border-gray-300 bg-white text-gray-400"
                      } ${isClickable ? "cursor-pointer hover:border-green-600" : "cursor-default"}`}
                    >
                      <Icon className="h-5 w-5" />
                    </button>
                    <span className={`text-xs mt-1 ${isActive ? "font-medium text-blue-600" : "text-gray-500"}`}>
                      {step.title}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 ${
                      isCompleted ? "bg-green-500" : "bg-gray-300"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

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
            <div className="space-y-4">
              <div>
                <Label htmlFor="course-name">
                  Course Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="course-name"
                  value={basicInfo.name}
                  onChange={(e) => setBasicInfo({ ...basicInfo, name: e.target.value })}
                  placeholder="Enter course name"
                />
              </div>

              <div>
                <Label htmlFor="course-description">Description</Label>
                <Textarea
                  id="course-description"
                  value={basicInfo.description}
                  onChange={(e) => setBasicInfo({ ...basicInfo, description: e.target.value })}
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
                    onChange={(e) => setBasicInfo({ ...basicInfo, duration_weeks: e.target.value })}
                    placeholder="e.g., 8"
                  />
                </div>
                <div>
                  <Label htmlFor="difficulty">Difficulty Level</Label>
                  <Select
                    value={basicInfo.difficulty_level}
                    onValueChange={(value) => setBasicInfo({ ...basicInfo, difficulty_level: value })}
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
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="prerequisites-text" className="text-sm font-normal">
                      Prerequisites Description
                    </Label>
                    <Textarea
                      id="prerequisites-text"
                      value={basicInfo.prerequisites_text}
                      onChange={(e) => setBasicInfo({ ...basicInfo, prerequisites_text: e.target.value })}
                      placeholder="e.g., Basic programming knowledge recommended"
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-normal">Prerequisite Courses</Label>
                    <Select
                      value=""
                      onValueChange={(value) => {
                        if (value && !basicInfo.prerequisites_course_ids.includes(value)) {
                          setBasicInfo({
                            ...basicInfo,
                            prerequisites_course_ids: [...basicInfo.prerequisites_course_ids, value],
                          });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select prerequisite course" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCourses.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {basicInfo.prerequisites_course_ids.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {basicInfo.prerequisites_course_ids.map((courseId) => {
                          const course = availableCourses.find((c: { id: string; name: string }) => c.id === courseId);
                          return (
                            <Badge key={courseId} variant="secondary" className="flex items-center gap-1">
                              {course?.name || courseId}
                              <button
                                type="button"
                                onClick={() => {
                                  setBasicInfo({
                                    ...basicInfo,
                                    prerequisites_course_ids: basicInfo.prerequisites_course_ids.filter((id: string) => id !== courseId),
                                  });
                                }}
                                className="ml-1"
                              >
                                <span className="sr-only">Remove</span>
                                ×
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label>Course Thumbnail</Label>
                <FileUploadZone
                  type="thumbnail"
                  courseId={courseId}
                  onUploadComplete={handleThumbnailUpload}
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
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Chapters</h3>
                  <p className="text-sm text-gray-500">
                    Add chapters and organize course content
                  </p>
                </div>
                <Button type="button" onClick={addChapter}>
                  <span className="mr-1">+</span> Add Chapter
                </Button>
              </div>

              {chapters.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-gray-500">No chapters added yet</p>
                    <Button type="button" onClick={addChapter} className="mt-4">
                      Add First Chapter
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {chapters.map((chapter, index) => {
                    // Stable key shared by the React key, the content/assignment
                    // store, and the child managers so nothing desyncs when a
                    // chapter is deleted or reordered.
                    const chapterKey = chapter.id || `temp-${index}`;
                    return (
                    <Card key={chapterKey}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <Input
                              value={chapter.name}
                              onChange={(e) => updateChapter(index, { name: e.target.value })}
                              placeholder="Chapter name"
                              className="font-medium"
                            />
                            <Textarea
                              value={chapter.description || ""}
                              onChange={(e) => updateChapter(index, { description: e.target.value })}
                              placeholder="Chapter description"
                              rows={2}
                            />
                          </div>
                          {pendingDeleteChapterIndex === index ? (
                            <div className="flex gap-1">
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
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setPendingDeleteChapterIndex(index);
                              }}
                              title="Delete chapter"
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <ChapterContentManager
                          chapterId={chapterKey}
                          chapterName={chapter.name || `Chapter ${index + 1}`}
                          contents={chapterContents[chapterKey] || []}
                          onContentsChange={(contents) => {
                            setChapterContents({
                              ...chapterContents,
                              [chapterKey]: contents,
                            });
                          }}
                          courseId={courseId}
                        />
                        <AssignmentBuilder
                          chapterId={chapterKey}
                          chapterName={chapter.name || `Chapter ${index + 1}`}
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
                        />
                      </CardContent>
                    </Card>
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
                  {basicInfo.duration_weeks && (
                    <div>
                      <span className="font-medium">Duration:</span> {basicInfo.duration_weeks} weeks
                    </div>
                  )}
                  {basicInfo.difficulty_level && (
                    <div>
                      <span className="font-medium">Difficulty Level:</span> {basicInfo.difficulty_level}
                    </div>
                  )}
                  {basicInfo.prerequisites_text && (
                    <div>
                      <span className="font-medium">Prerequisites:</span> {basicInfo.prerequisites_text}
                    </div>
                  )}
                  {basicInfo.prerequisites_course_ids.length > 0 && (
                    <div>
                      <span className="font-medium">Prerequisite Courses:</span>{" "}
                      {basicInfo.prerequisites_course_ids
                        .map((id) => availableCourses.find((c) => c.id === id)?.name || id)
                        .join(", ")}
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

        {/* Navigation */}
        <DialogFooter className="flex items-center justify-between">
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

