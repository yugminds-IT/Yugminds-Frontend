 
 
"use client"

import { useState, useEffect, useRef } from "react";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useAdminSchools } from "@/hooks/useAdminSchools";
import { requestClose } from "@/hooks/useUnsavedCloseGuard";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle
} from "@/components/ui/dialog";
import { adminApi } from '@/lib/api/admin.api';
import { toast } from '@/components/ui/toast';
import {
  CourseCreationWizard,
  hasWizardDraft,
  getWizardDraftSummary,
  clearWizardDraftFromStorage,
} from '@/components/admin/CourseCreationWizard';
import { CourseEditor, type Chapter as EditorChapter, type AssignmentFromAPI as EditorAssignmentFromAPI } from '@/components/admin/CourseEditor';
import { clearCourseEditorDraft, peekCourseEditorDraft } from '@/lib/course-editor-draft';
import { CoursePublishDialog } from '@/components/admin/CoursePublishDialog';
import { CourseVersionHistory } from '@/components/admin/CourseVersionHistory';
import Modal from "@/components/portal/Modal";
import ConfirmModal from "@/components/portal/ConfirmModal";
import StageRun from "@/components/admin/courses/StageRun";
import CoursesTab from "@/components/admin/courses/CoursesTab";
import { chaptersOf, classesOf, day, plural, schoolsOf, stageOf, titleOf, type Stage } from "@/components/admin/courses/utils";
import "@/components/school-admin/overview.css"; // hero meta
import "@/components/teacher/overview/overview.css"; // track
import "@/components/school-admin/students.css"; // sm- chips
import "@/components/school-admin/teachers.css"; // tm- track nodes
import "@/components/admin/courses/courses.css";
import { Plus, Edit, School, RefreshCw } from "lucide-react";

interface Course {
  id: string;
  name: string;
  course_name?: string; // For backward compatibility
  title?: string; // For backward compatibility
  description: string;
  created_by?: string;
  school_id?: string;
  grade?: string;
  status: 'Draft' | 'Published';
  total_chapters: number;
  num_chapters?: number; // For backward compatibility
  total_videos: number;
  total_materials: number;
  total_assignments: number;
  release_type: 'Daily' | 'Weekly' | 'Bi-weekly';
  thumbnail_url?: string;
  /** Drip schedule: chapter K unlocks K * this many days after enrollment. null/0 = no drip. */
  chapter_unlock_interval_days?: number | null;
  assignments?: Assignment[];
  content_summary?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  course_access?: CourseAccess[];
  /** Structured school → grade → section targeting for the Publish dialog. */
  access?: Array<{ school_id: string; grades: Array<{ grade: string; sections: string[] }> }>;
  chapters?: Chapter[];
}

interface CourseAccess {
  id: string;
  course_id: string;
  school_id: string;
  grade: string;
  sections?: string[];
  schools?: { name: string };
 
}

 
interface Chapter {
  id?: string;
  course_id?: string;
  name: string;
  description?: string;
  learning_outcomes: string[];
   
  order_number: number;
  release_date?: string;
  created_at?: string;
 
}

 
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for future use
interface Material {
  id?: string;
  chapter_id: string;
  title: string;
  file_url: string;
  file_type: string;
  uploaded_by?: string;
  created_at?: string;
  storage_path?: string;
   
  content_id?: string;
  content_order?: number;
   
  content_metadata?: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for content type checks
type ChapterContentType =
  | 'text'
  | 'video'
  | 'video_link'
  | 'pdf'
  | 'image'
  | 'file'
  | 'audio'
  | 'html'
  | 'link';

interface Assignment {
  id?: string;
  chapter_id: string;
  title: string;
  description?: string;
  auto_grading_enabled: boolean;
  max_score: number;
   
  created_by?: string;
  created_at?: string;
  questions?: AssignmentQuestion[];
 
}

interface AssignmentQuestion {
  id?: string;
  assignment_id: string;
  question_type: 'MCQ' | 'FillBlank';
  question_text: string;
  options?: string[];
  correct_answer: string;
  marks: number;
 
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for form typing
interface CourseFormData {
  id?: string;
  name: string;
  description: string;
  school_ids: string[];
  grades: string[];
  total_chapters: number;
  total_videos: number;
  total_materials: number;
  total_assignments: number;
   
  release_type: 'Daily' | 'Weekly' | 'Bi-weekly';
  status: 'Draft' | 'Published';
}

interface School {
  id: string;
  name: string;
  address?: string;
  grades_offered?: string[];
}

export default function CoursesManagement() {

  const [courses, setCourses] = useState<Course[]>([]);
  const { schools: rawSchools } = useAdminSchools();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const schools = (rawSchools ?? []) as School[];
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [stageFilter, setStageFilter] = useState<Stage | null>(null);
   
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [wizardDraftSummary, setWizardDraftSummary] = useState<ReturnType<
    typeof getWizardDraftSummary
  >>(null);
   
  const [_isChapterDialogOpen, _setIsChapterDialogOpen] = useState(false);
  const [_isResourceDialogOpen, _setIsResourceDialogOpen] = useState(false);
   
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const courseEditorDirtyRef = useRef(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [isCloningCourse, setIsCloningCourse] = useState<string | null>(null);
  const [editStartedUpdatedAt, setEditStartedUpdatedAt] = useState<string | null>(null);
  const [concurrentEditWarning, setConcurrentEditWarning] = useState<{ show: boolean; proceed: () => void } | null>(null);
  const [publishCourse, setPublishCourse] = useState<Course | null>(null);
  const [versionHistoryCourse, setVersionHistoryCourse] = useState<Course | null>(null);
   
  const [viewingCourse, setViewingCourse] = useState<Course | null>(null);
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);
   
  const [_selectedCourse, _setSelectedCourse] = useState<Course | null>(null);
  const [_selectedChapter, _setSelectedChapter] = useState<Chapter | null>(null);
  const [_selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [_selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [_currentAssignment, _setCurrentAssignment] = useState<Assignment>({
    chapter_id: '',
    title: '',
    description: '',
    auto_grading_enabled: true,
    max_score: 100,
    questions: []
  });
  const [_isTextContentDialogOpen, _setIsTextContentDialogOpen] = useState(false);
  const [_textContentData, _setTextContentData] = useState({ title: '', content_text: '' });
  const [_textContentChapterId, _setTextContentChapterId] = useState<string | null>(null);
  const [_editingTextContentId, _setEditingTextContentId] = useState<string | null>(null);
  const [_editingTextContentIndex, _setEditingTextContentIndex] = useState<number | null>(null);

  const refreshWizardDraftSummary = () => {
    setWizardDraftSummary(getWizardDraftSummary());
  };

  // Surface local recovery drafts after session expiry / refresh — they are not
  // saved courses, so they never appear in the table until the wizard is resumed.
  useEffect(() => {
    refreshWizardDraftSummary();
  }, []);

  useEffect(() => {
    if (!isCreateDialogOpen) {
      refreshWizardDraftSummary();
    }
  }, [isCreateDialogOpen]);

  // Helper function to normalize grade format (e.g., "Grade 4" -> "grade4")
  const normalizeGradeToValue = (grade: string): string | null => {
    if (!grade) return null;
    
    // Remove "Grade " prefix if present
    const normalized = grade.replace(/^Grade\s+/i, '').trim();
      
    

    const lower = normalized.toLowerCase();
    if (lower === 'pre-k' || lower === 'prek' || lower === 'pre-kg') {
      return 'pre-k';
    }
    if (lower === 'k' || lower === 'kindergarten' || lower === 'kg') {
      return 'kindergarten';
    }
    
    // Extract number from grade (e.g., "4" -> "grade4", "12" -> "grade12")
    const numMatch = normalized.match(/(\d{1,2})/);
    if (numMatch) {
      const num = numMatch[1];
      return `grade${num}`;
    }
    
    return null;
  };

  useEffect(() => {
    loadData();
  }, []);

  // NOTE: Old form persistence/recovery useEffect hooks removed
  // CourseCreationWizard manages its own state and auto-save functionality
  // When editing course and schools are loaded, set the selected schools/grades from the course data
  useEffect(() => {
    if (editingCourse && schools.length > 0 && isCreateDialogOpen) {
      // Get schools and grades from the course
      const course = editingCourse;
      let schoolIds: string[] = [];
      let gradesList: string[] = [];
      
      // Try course_access first - get ALL unique schools and grades
      if (course.course_access && course.course_access.length > 0) {
        // Get unique school IDs
        schoolIds = [...new Set(course.course_access.map((ca: { school_id?: string }) => ca.school_id).filter(Boolean))] as string[];
        // Get unique grades and normalize them
        const rawGrades = [...new Set(course.course_access.map((ca: { grade?: string }) => ca.grade).filter(Boolean))] as string[];
        gradesList = rawGrades.map((grade: string) => {
          const normalized = normalizeGradeToValue(grade);
          return normalized || grade;
        }).filter(Boolean) as string[];
        // extracted from course_access
      }
      
      // Fallback to direct school_id and grade
      if (schoolIds.length === 0 && course.school_id) {
         
        schoolIds = [course.school_id];
      }
      if (gradesList.length === 0 && course.grade) {
        const normalized = normalizeGradeToValue(course.grade);
        gradesList = normalized ? [normalized] : [course.grade];
      }
      
      if (schoolIds.length > 0 || gradesList.length > 0) {
        setSelectedSchools(schoolIds);
        setSelectedGrades(gradesList);
      }
    }
  }, [editingCourse, schools, isCreateDialogOpen]);

  const loadData = async () => {
    setLoadingCourses(true);
    setLoadFailed(false);
    try {
      const { data: responseData } = await adminApi.courses.list();
      const root = responseData as Record<string, unknown> | undefined;
      const payload =
        root?.data && typeof root.data === 'object'
          ? (root.data as Record<string, unknown>)
          : root;
      const coursesData = payload?.courses as Course[] | undefined;
      if (payload?.error) {
        setCourses([]);
      } else {
        setCourses(Array.isArray(coursesData) ? coursesData : []);
        if (payload?.truncated) {
          toast.error(
            'Course list exceeds the display cap — some courses are not shown. Contact engineering to raise the limit.',
          );
        }
      }
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        toast.error('Authentication required. Please log in again.');
      }
      // Keep what is already on screen; only say "failed" when there is nothing to show.
      setLoadFailed(true);
    } finally {
      setLoadingCourses(false);
    }
  };

  // Use smart refresh for tab switching - increased interval to prevent refreshes during short tab switches
  useSmartRefresh({
    customRefresh: loadData,
    minRefreshInterval: 180000, // 3 minutes minimum between refreshes (prevents refresh during 1-minute tab switches)
    hasUnsavedData: () => {
      // Check if any dialog is open OR if there's a recoverable wizard draft
      return isCreateDialogOpen || isEditDialogOpen || hasWizardDraft();
    },
  });

  // NOTE: buildChapterContentsPayload and handleCreateCourse removed
  // These functions are no longer used since we're using CourseCreationWizard and CourseEditor components
  // They managed the old form state which has been replaced

  const handleViewCourse = (course: Course) => {
    setViewingCourse(course);
    setIsViewDialogOpen(true);
  };

  // Shared by both the table-view and grid-view Edit buttons — previously
  // duplicated verbatim in each render block, which risked the two views
  // silently drifting apart.
  const handleEditCourse = async (course: Course) => {
    try {
      const { data } = await adminApi.courses.get(course.id);
      const fullCourse = (data?.course ?? data) as Course;
      if (!fullCourse || typeof fullCourse !== 'object' || !('id' in fullCourse)) {
        throw new Error('Course data not found in response');
      }
      setEditStartedUpdatedAt(fullCourse.updated_at || course.updated_at || null);
      setEditingCourse({ ...course, ...fullCourse, name: fullCourse.name || fullCourse.course_name || course.name });
      setIsEditDialogOpen(true);
    } catch (error: unknown) {
      toast.error((error instanceof Error ? error.message : String(error)) || 'Failed to open edit dialog.');
    }
  };

  const editorResumeAttempted = useRef(false);
  useEffect(() => {
    if (editorResumeAttempted.current || isEditDialogOpen || isCreateDialogOpen) return;
    if (loadingCourses || courses.length === 0) return;
    const draft = peekCourseEditorDraft();
    if (!draft) {
      editorResumeAttempted.current = true;
      return;
    }
    const course = courses.find((c) => c.id === draft.courseId);
    if (!course) {
      clearCourseEditorDraft(draft.courseId);
      editorResumeAttempted.current = true;
      return;
    }
    editorResumeAttempted.current = true;
    void handleEditCourse(course);
  }, [courses, loadingCourses, isEditDialogOpen, isCreateDialogOpen]);

  const handleDeleteCourse = (course: Course) => {
    setDeletingCourse(course);
  };

  const confirmDeleteCourse = async () => {
    if (!deletingCourse) return;

    try {
      await adminApi.courses.delete(deletingCourse.id);
      setDeletingCourse(null);
      loadData();
      toast.success(`${titleOf(deletingCourse)} was moved to Trash.`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete course. Please try again.';
      toast.error(msg);
    }
  };

  const handleCloneCourse = async (courseId: string) => {
    setIsCloningCourse(courseId);
    try {
      await adminApi.courses.duplicate(courseId);
      loadData();
      toast.success('Course cloned successfully.');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to clone course';
      toast.error(msg);
    } finally {
      setIsCloningCourse(null);
    }
  };

  const handleBulkDeleteRequest = () => {
    if (selectedCourseIds.size === 0) return;
    setIsBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = async () => {
    const count = selectedCourseIds.size;
    if (count === 0) return;
    try {
      await Promise.all(Array.from(selectedCourseIds).map((id) => adminApi.courses.delete(id)));
      setSelectedCourseIds(new Set());
      setIsBulkDeleteDialogOpen(false);
      loadData();
      toast.success(`Deleted ${count} course(s).`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Bulk delete failed';
      toast.error(msg);
    }
  };

  const handleBulkPublish = async (publish: boolean) => {
    const count = selectedCourseIds.size;
    try {
      await Promise.all(
        Array.from(selectedCourseIds).map((id) =>
          adminApi.courses.publish(id, { publish, changes_summary: publish ? 'Bulk publish' : 'Bulk unpublish' })
        )
      );
      setSelectedCourseIds(new Set());
      loadData();
      toast.success(`${publish ? 'Published' : 'Unpublished'} ${count} course(s).`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Bulk action failed';
      toast.error(msg);
    }
  };

  // NOTE: Auto-save useEffect removed - CourseCreationWizard manages its own auto-save functionality

  // Warn before leaving page with unsaved data
  useEffect(() => {
    if (!isCreateDialogOpen && !isEditDialogOpen) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (
        (isCreateDialogOpen && hasWizardDraft()) ||
        (isEditDialogOpen && courseEditorDirtyRef.current)
      ) {
        e.preventDefault();
        e.returnValue = 'You have unsaved course data. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isCreateDialogOpen, isEditDialogOpen]);

  // NOTE: resetForm removed - CourseCreationWizard manages its own state
  // Simple helper to clear dialog state when opening create dialog
  const resetForm = () => {
    setSelectedSchools([]);
    setSelectedGrades([]);
    // CourseCreationWizard will handle its own state initialization
  };

  // NOTE: handleGradeToggle removed - not used with new CourseCreationWizard component



  // NOTE: handleSchoolToggle removed - not used with new CourseCreationWizard component

  // NOTE: addChapter, removeChapter, addLearningOutcome, removeLearningOutcome removed
  // These functions referenced removed state variables and are no longer used
  // Chapter management is now handled by CourseEditor component

  // NOTE: handleAddChapter removed - it referenced removed state variables and is no longer used
  // Chapter management is now handled by CourseEditor component


  // NOTE: renderStepContent() function removed - replaced by CourseCreationWizard component
  // The old 6-step form implementation is no longer used.
  // All the old form code (cases 1-6) has been removed since we now use CourseCreationWizard.

  const findCourse = (id: string) => courses.find((c) => c.id === id);
  const counts: Record<Stage, number> = { empty: 0, ready: 0, live: 0 };
  courses.forEach((c) => { counts[stageOf(c)] += 1; });
  const chapterTotal = courses.reduce((n, c) => n + chaptersOf(c), 0);
  const assignmentTotal = courses.reduce((n, c) => n + (c.total_assignments || 0), 0);
  const openCreate = () => {
    resetForm();
    setEditingCourse(null);
    setIsCreateDialogOpen(true);
  };

  let statusLine: React.ReactNode;
  if (loadingCourses && courses.length === 0) statusLine = 'Loading courses…';
  else if (loadFailed && courses.length === 0) statusLine = 'The courses did not load. Try again.';
  else if (courses.length === 0) statusLine = 'No courses yet. Create the first one to get started.';
  else statusLine = <><strong>{counts.live} of {plural(courses.length, 'course')}</strong> {counts.live === 1 ? 'is' : 'are'} live for students{counts.empty > 0 ? `. ${counts.empty} still ${counts.empty === 1 ? 'needs' : 'need'} content.` : counts.ready > 0 ? `. ${counts.ready} ${counts.ready === 1 ? 'is' : 'are'} ready to publish.` : '.'}</>;
  const runCaption = counts.empty + counts.ready > 0 ? `${plural(counts.empty + counts.ready, 'course')} not live yet` : courses.length ? 'Every course is live' : 'Nothing to show yet';

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="co-title">
        <div className="sd-hero-copy">
          <h1 id="co-title" className="mc-hero-title">Courses</h1>
          <p className="sd-where">Everything students learn</p>
          <p className="sd-status">{statusLine}</p>
          <div className="sd-hero-actions">
            <button className="sd-btn sd-btn--amber" onClick={openCreate}><Plus aria-hidden="true" />Create course</button>
            {counts.ready > 0 && stageFilter !== 'ready' && (
              <button className="sd-btn sd-btn--ghost-dark" onClick={() => setStageFilter('ready')}>Show {counts.ready} ready to publish</button>
            )}
            <button className="so-refresh" style={{ alignSelf: "center" }} onClick={() => void loadData()} disabled={loadingCourses} aria-label={loadingCourses ? 'Refreshing' : 'Refresh'} title="Refresh">
              <RefreshCw className={loadingCourses ? 'animate-spin' : ''} aria-hidden="true" />
            </button>
          </div>
        </div>
        {loadingCourses && courses.length === 0 ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: '9rem' }} /></div>
        ) : (
          <StageRun counts={counts} selected={stageFilter} onSelect={setStageFilter} caption={runCaption} />
        )}
      </section>

      <div className="sd-ledger" role="group" aria-label="Course numbers">
        <button type="button" aria-pressed={stageFilter === null} onClick={() => setStageFilter(null)}>
          <span className="sd-l">Courses</span><b className="sd-n">{courses.length}</b><small>{counts.live} live, {courses.length - counts.live} not live</small>
        </button>
        <button type="button" aria-pressed={stageFilter === 'live'} onClick={() => setStageFilter(stageFilter === 'live' ? null : 'live')}>
          <span className="sd-l">Live for students</span><b className="sd-n">{counts.live}</b><small>Tap to see which</small>
        </button>
        <div><span className="sd-l">Chapters</span><b className="sd-n">{chapterTotal}</b><small>Across all courses</small></div>
        <div><span className="sd-l">Assignments</span><b className="sd-n">{assignmentTotal}</b><small>Across all courses</small></div>
      </div>

      {wizardDraftSummary && !isCreateDialogOpen && (
        <div className="co-draft" role="status">
          <div>
            <b>Unfinished course: {wizardDraftSummary.name}</b>
            <p>Saved on this device at step {wizardDraftSummary.currentStep} of 3. It is not in the list until you finish creating it.</p>
          </div>
          <span>
            <button className="sd-btn sd-btn--line" onClick={() => { clearWizardDraftFromStorage(); setWizardDraftSummary(null); }}>Discard</button>
            <button className="sd-btn sd-btn--amber" onClick={() => { setEditingCourse(null); setIsCreateDialogOpen(true); }}>Resume draft</button>
          </span>
        </div>
      )}

      {loadFailed && courses.length === 0 && !loadingCourses ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>We could not load the courses</b>
            <p>Check your connection, then try again. Nothing was changed.</p>
            <button className="sd-btn sd-btn--amber" onClick={() => void loadData()}>Try again</button>
          </div>
        </section>
      ) : (
      <CoursesTab
        courses={courses}
        loading={loadingCourses}
        stage={stageFilter}
        onClearStage={() => setStageFilter(null)}
        selected={selectedCourseIds}
        onSelectedChange={setSelectedCourseIds}
        cloningId={isCloningCourse}
        onCreate={openCreate}
        onView={(id) => { const c = findCourse(id); if (c) handleViewCourse(c); }}
        onEdit={(id) => { const c = findCourse(id); if (c) void handleEditCourse(c); }}
        onPublish={(id) => { const c = findCourse(id); if (c) { setPublishCourse(c); setIsPublishDialogOpen(true); } }}
        onHistory={(id) => { const c = findCourse(id); if (c) { setVersionHistoryCourse(c); setIsVersionHistoryOpen(true); } }}
        onClone={(id) => void handleCloneCourse(id)}
        onDelete={(id) => { const c = findCourse(id); if (c) handleDeleteCourse(c); }}
        onBulkPublish={(publish) => void handleBulkPublish(publish)}
        onBulkDelete={handleBulkDeleteRequest}
      />
      )}

      <Modal
        open={isViewDialogOpen && !!viewingCourse}
        onClose={() => setIsViewDialogOpen(false)}
        wide
        title={viewingCourse ? titleOf(viewingCourse) : 'Course'}
        subtitle={viewingCourse ? (stageOf(viewingCourse) === 'live' ? 'Live for students' : stageOf(viewingCourse) === 'ready' ? 'Ready to publish' : 'Needs content') : undefined}
        footer={
          <>
            <button className="sd-btn sd-btn--line" onClick={() => setIsViewDialogOpen(false)}>Close</button>
            {viewingCourse && (
              <button className="sd-btn sd-btn--amber" onClick={() => { setIsViewDialogOpen(false); void handleEditCourse(viewingCourse); }}>
                <Edit aria-hidden="true" />Edit course
              </button>
            )}
          </>
        }
      >
        {viewingCourse && (
          <div className="co-view">
            <p className="co-view-desc">{viewingCourse.description || 'No description yet.'}</p>
            <div className="co-view-stats">
              <div><b>{chaptersOf(viewingCourse)}</b><span>Chapters</span></div>
              <div><b>{viewingCourse.total_videos || 0}</b><span>Videos</span></div>
              <div><b>{viewingCourse.total_materials || 0}</b><span>Files</span></div>
              <div><b>{viewingCourse.total_assignments || 0}</b><span>Assignments</span></div>
            </div>
            <section aria-labelledby="co-view-where">
              <h3 id="co-view-where">Schools and classes</h3>
              {viewingCourse.course_access && viewingCourse.course_access.length > 0 ? (
                viewingCourse.course_access.map((access, idx) => {
                  const labels = classesOf({ ...viewingCourse, course_access: [access] });
                  return (
                    <div key={idx} className="co-view-row">
                      <b>{access.schools?.name || 'Unknown school'}</b>
                      {labels.map((l) => <span key={l} className="sm-chip">{l}</span>)}
                    </div>
                  );
                })
              ) : (
                <p className="co-view-none">Not shared with any school yet. Publish it to choose schools and classes.</p>
              )}
              {schoolsOf(viewingCourse).length > 0 && viewingCourse.status !== 'Published' && <p className="co-view-meta">This is saved targeting. Students see the course once it is published.</p>}
            </section>
            {viewingCourse.chapter_unlock_interval_days ? (
              <p className="co-view-meta">Chapters unlock every {plural(viewingCourse.chapter_unlock_interval_days, 'day')} after a student enrolls.</p>
            ) : null}
            <p className="co-view-meta">Created {day(viewingCourse.created_at)}. Last changed {day(viewingCourse.updated_at)}.</p>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={deletingCourse !== null}
        onClose={() => setDeletingCourse(null)}
        title="Move this course to Trash?"
        subtitle={deletingCourse ? titleOf(deletingCourse) : undefined}
        confirmLabel="Move to Trash"
        danger
        onConfirm={() => void confirmDeleteCourse()}
      >
        <p>Students lose access straight away. You can restore the course from Trash later.</p>
      </ConfirmModal>

      <ConfirmModal
        open={isBulkDeleteDialogOpen}
        onClose={() => setIsBulkDeleteDialogOpen(false)}
        title={`Move ${plural(selectedCourseIds.size, 'course')} to Trash?`}
        confirmLabel="Move to Trash"
        danger
        onConfirm={() => void confirmBulkDelete()}
      >
        <p>Students lose access straight away. You can restore them from Trash later.</p>
      </ConfirmModal>

      <ConfirmModal
        open={!!concurrentEditWarning?.show}
        onClose={() => setConcurrentEditWarning(null)}
        title="Someone else changed this course"
        confirmLabel="Save anyway"
        danger
        onConfirm={async () => {
          if (concurrentEditWarning?.proceed) {
            const proceed = concurrentEditWarning.proceed;
            setConcurrentEditWarning(null);
            await proceed();
          }
        }}
      >
        <p>It was updated after you started editing. Saving now overwrites those changes.</p>
      </ConfirmModal>

      {/* Course Creation Wizard */}
      {isCreateDialogOpen && !editingCourse && (
        <CourseCreationWizard
          onComplete={async (courseData) => {
            try {
              await adminApi.courses.create({
                ...courseData,
                status: 'Draft',
              });
              setIsCreateDialogOpen(false);
              setWizardDraftSummary(null);
              setStageFilter(null);
              loadData();
              toast.success('Course created successfully.');
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to create course';
              toast.error(errorMessage);
              // Re-throw so the wizard keeps the dialog open, preserves the
              // recovery draft, and shows the error instead of resetting.
              throw error instanceof Error ? error : new Error(errorMessage);
            }
          }}
          onCancel={() => {
            setIsCreateDialogOpen(false);
            setEditingCourse(null);
            refreshWizardDraftSummary();
          }}
        />
      )}

      {/* Course Editor */}
      {isEditDialogOpen && editingCourse && (
        <Dialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            if (open) {
              setIsEditDialogOpen(true);
              return;
            }
            void requestClose(courseEditorDirtyRef.current, () => {
              if (editingCourse?.id) clearCourseEditorDraft(editingCourse.id);
              setIsEditDialogOpen(false);
              setEditingCourse(null);
            });
          }}
        >
          <DialogContent className="grid max-h-[90vh] w-[calc(100vw-2rem)] grid-rows-[auto_1fr] gap-0 overflow-hidden p-0 sm:max-w-5xl">
            <DialogHeader className="border-b px-6 pt-6 pb-4">
              <DialogTitle>Edit Course</DialogTitle>
              <DialogDescription>
                {editingCourse.name || editingCourse.course_name || 'Update course details, chapters, content, and assignments.'}
              </DialogDescription>
            </DialogHeader>
            <CourseEditor
              course={{
                ...editingCourse,
                id: editingCourse.id,
                name: editingCourse.name || editingCourse.course_name || '',
                description: editingCourse.description || '',
                thumbnail_url: editingCourse.thumbnail_url || '',
                status: editingCourse.status || 'Draft',
                chapters: (editingCourse.chapters || []) as unknown as EditorChapter[],
                assignments: (editingCourse.assignments || []) as unknown as EditorAssignmentFromAPI[],
              }}
              onDirtyChange={(dirty) => {
                courseEditorDirtyRef.current = dirty;
              }}
              onSave={async (courseData) => {
                const doSave = async () => {
                  await adminApi.courses.update(editingCourse.id, courseData as Record<string, unknown>);
                  loadData();
                  setIsEditDialogOpen(false);
                  setEditingCourse(null);
                  setEditStartedUpdatedAt(null);
                  toast.success('Course updated successfully.');
                };

                try {
                  // Concurrent edit check: compare updatedAt from when editor opened vs current
                  if (editStartedUpdatedAt) {
                    const { data: fresh } = await adminApi.courses.get(editingCourse.id);
                    const freshCourse = (fresh?.course ?? fresh) as Course;
                    if (freshCourse?.updated_at && freshCourse.updated_at !== editStartedUpdatedAt) {
                      setConcurrentEditWarning({ show: true, proceed: doSave });
                      return;
                    }
                  }
                  await doSave();
                } catch (error: unknown) {
                  const errMsg = error instanceof Error ? error.message : String(error);
                  toast.error(errMsg || 'Failed to update course');
                  throw error instanceof Error ? error : new Error(errMsg || 'Failed to update course');
                }
              }}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setEditingCourse(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Publish Dialog */}
      {publishCourse && (
        <CoursePublishDialog
          open={isPublishDialogOpen}
          onOpenChange={(open) => {
            setIsPublishDialogOpen(open);
            if (!open) setPublishCourse(null);
          }}
          course={{
            id: publishCourse.id,
            name: publishCourse.name || publishCourse.course_name || '',
            status: publishCourse.status || 'Draft',
            is_published: (publishCourse as Course & { is_published?: boolean }).is_published || false,
            access: publishCourse.access ?? [],
          }}
          onPublishChange={() => {
            loadData();
            setPublishCourse(null);
          }}
        />
      )}

      {/* Version History Dialog */}
      {versionHistoryCourse && (
        <Dialog open={isVersionHistoryOpen} onOpenChange={(open) => {
          setIsVersionHistoryOpen(open);
          if (!open) setVersionHistoryCourse(null);
        }}>
          <DialogContent className="flex h-[80vh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
            <DialogHeader className="sr-only">
              <DialogTitle>Version History</DialogTitle>
              <DialogDescription>View and manage course version history</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-hidden p-6">
              <CourseVersionHistory
                courseId={versionHistoryCourse.id}
                courseName={versionHistoryCourse.name || versionHistoryCourse.course_name || 'Unnamed Course'}
                onVersionRevert={() => {
                  loadData();
                  setIsVersionHistoryOpen(false);
                  setVersionHistoryCourse(null);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
