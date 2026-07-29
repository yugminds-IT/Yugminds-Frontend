 
 
"use client"

import { useState, useEffect } from "react";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useAdminSchools } from "@/hooks/useAdminSchools";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { adminApi } from '@/lib/api/admin.api';
import { toast } from '@/components/ui/toast';
import {
  clearCourseFormState,
  hasCourseFormState,
} from '@/lib/course-form-persistence';
import { CourseCreationWizard } from '@/components/admin/CourseCreationWizard';
import { CourseEditor, type Chapter as EditorChapter, type AssignmentFromAPI as EditorAssignmentFromAPI } from '@/components/admin/CourseEditor';
import { CoursePublishDialog } from '@/components/admin/CoursePublishDialog';
import { CourseVersionHistory } from '@/components/admin/CourseVersionHistory';
import NextImage from "next/image";
import { 
  Plus,
  Edit,
  Trash2,
  Eye,
  Search,
  School,
  Play,
  Pause,
  FileText,
  Video,
  CheckSquare,
  Loader2,
  History,
  LayoutList,
  LayoutGrid,
  BookOpen,
  Copy,
  AlertTriangle,
} from "lucide-react";

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
  duration_weeks?: number;
  prerequisites_course_ids?: string[];
  prerequisites_text?: string;
  thumbnail_url?: string;
  difficulty_level?: string;
  assignments?: Assignment[];
  content_summary?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  course_access?: CourseAccess[];
  /** Structured school → grade → section targeting for the Publish dialog. */
  access?: Array<{ school_id: string; grades: Array<{ grade: string; sections: string[] }> }>;
  chapters?: Chapter[];
}

function formatCourseDate(value?: string): string {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface CourseAccess {
  id: string;
  course_id: string;
  school_id: string;
  grade: string;
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

interface Video {
  id?: string;
  chapter_id: string;
  title: string;
  video_url: string;
  duration?: string;
  uploaded_by?: string;
   
  created_at?: string;
  storage_path?: string;
  content_id?: string;
  content_order?: number;
   
  content_metadata?: Record<string, unknown>;
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

interface GradeOption {
  value: string;
  label: string;
}

export default function CoursesManagement() {

  const [courses, setCourses] = useState<Course[]>([]);
  const { schools: rawSchools } = useAdminSchools();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const schools = (rawSchools ?? []) as School[];
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
   
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'All' | 'Draft' | 'Published'>('All');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
   
  const [_isChapterDialogOpen, _setIsChapterDialogOpen] = useState(false);
  const [_isResourceDialogOpen, _setIsResourceDialogOpen] = useState(false);
   
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
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

  // State for editing content
  const gradeOptions = [
    { value: "grade1", label: "Grade 1" },
    { value: "grade2", label: "Grade 2" },
    { value: "grade3", label: "Grade 3" },
    { value: "grade4", label: "Grade 4" },
    { value: "grade5", label: "Grade 5" },
    { value: "grade6", label: "Grade 6" },
    { value: "grade7", label: "Grade 7" },
    { value: "grade8", label: "Grade 8" },
    { value: "grade9", label: "Grade 9" },
    { value: "grade10", label: "Grade 10" },
    { value: "grade11", label: "Grade 11" },
    { value: "grade12", label: "Grade 12" }
  ];


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
      setCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  };

  // Use smart refresh for tab switching - increased interval to prevent refreshes during short tab switches
  useSmartRefresh({
    customRefresh: loadData,
    minRefreshInterval: 180000, // 3 minutes minimum between refreshes (prevents refresh during 1-minute tab switches)
    hasUnsavedData: () => {
      // Check if any dialog is open OR if there's saved form data
      return isCreateDialogOpen || isEditDialogOpen || hasCourseFormState();
    },
  });

  // NOTE: buildChapterContentsPayload, handleCreateCourse, and handleEditCourse removed
  // These functions are no longer used since we're using CourseCreationWizard and CourseEditor components
  // They managed the old form state which has been replaced

  const handleViewCourse = (course: Course) => {
    setViewingCourse(course);
    setIsViewDialogOpen(true);
  };

  // NOTE: handleEditCourse removed - replaced by CourseEditor component
  // The old edit function is no longer used
  // NOTE: handleEditCoursePlaceholder removed - it was unused and referenced removed state variables

  const handleDeleteCourse = (course: Course) => {
    setDeletingCourse(course);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteCourse = async () => {
    if (!deletingCourse) return;

    try {
      await adminApi.courses.delete(deletingCourse.id);
      setIsDeleteDialogOpen(false);
      setDeletingCourse(null);
      loadData();
      toast.success('Course deleted successfully.');
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

  const toggleSelectAll = () => {
    if (selectedCourseIds.size === filteredCourses.length) {
      setSelectedCourseIds(new Set());
    } else {
      setSelectedCourseIds(new Set(filteredCourses.map((c) => c.id)));
    }
  };

  const toggleSelectCourse = (id: string) => {
    setSelectedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // NOTE: Auto-save useEffect removed - CourseCreationWizard manages its own auto-save functionality

  // Warn before leaving page with unsaved data
  useEffect(() => {
    if (!isCreateDialogOpen) return;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasCourseFormState()) {
        e.preventDefault();
        e.returnValue = 'You have unsaved course data. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isCreateDialogOpen]);

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


  const filteredCourses = courses.filter((course: Course) => {
    // Status filter
    if (statusFilter !== 'All' && course.status !== statusFilter) {
      return false;
    }
    
    // Search filter
    if (!searchTerm.trim()) return true; // Show all courses if no search term
    
    const courseName = course.name || course.course_name || '';
    const courseDescription = course.description || '';
    const matches = (
      courseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      courseDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.course_access?.some((access: CourseAccess) => 
        access.schools?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        access.grade?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
    return matches;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Published': return 'bg-green-100 text-green-800';
      case 'Draft': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };


  // NOTE: renderStepContent() function removed - replaced by CourseCreationWizard component
  // The old 6-step form implementation is no longer used.
  // All the old form code (cases 1-6) has been removed since we now use CourseCreationWizard.

  return (
    <div className="p-8 bg-white">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Course Management</h1>
        <p className="text-gray-600 mt-2">Create and manage courses with comprehensive content</p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value: 'All' | 'Draft' | 'Published') => setStatusFilter(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Courses</SelectItem>
            <SelectItem value="Published">Published</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
          </SelectContent>
        </Select>
        <Button 
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => {
            resetForm();
            setEditingCourse(null);
            setIsCreateDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Course
        </Button>
      </div>

      {/* Courses Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Courses</CardTitle>
              <CardDescription>
                Manage your courses and their content
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 border rounded-lg p-1">
              <Button
                type="button"
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                title="List view"
                className={viewMode === 'list' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
              >
                <LayoutList className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                title="Grid view"
                className={viewMode === 'grid' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Bulk action toolbar */}
          {selectedCourseIds.size > 0 && (
            <div className="mb-3 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-sm font-medium text-blue-800">
                {selectedCourseIds.size} selected
              </span>
              <Button size="sm" variant="outline" onClick={handleBulkDeleteRequest} className="text-red-600 border-red-300 hover:bg-red-50">
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkPublish(true)} className="text-green-600 border-green-300 hover:bg-green-50">
                <Play className="h-3 w-3 mr-1" /> Publish
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkPublish(false)} className="text-yellow-600 border-yellow-300 hover:bg-yellow-50">
                <Pause className="h-3 w-3 mr-1" /> Unpublish
              </Button>
              <button className="ml-auto text-blue-600 text-sm hover:underline" onClick={() => setSelectedCourseIds(new Set())}>
                Clear
              </button>
            </div>
          )}

          {loadingCourses ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
              <span className="text-gray-600">Loading courses...</span>
            </div>
          ) : viewMode === 'list' ? (
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={filteredCourses.length > 0 && selectedCourseIds.size === filteredCourses.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </TableHead>
                <TableHead>Course Name</TableHead>
                <TableHead>School</TableHead>
                <TableHead>Grades</TableHead>
                <TableHead>Chapters</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCourses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    {courses.length === 0 ? (
                      <>No courses found. Click &quot;Create Course&quot; to add your first course.</>
                    ) : (
                      <>No courses match your search. Try a different search term.</>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCourses.map((course) => {
                  // Get school names from course_access
                  const schoolNames = course.course_access
                    ?.map((access: CourseAccess) => access.schools?.name)
                    .filter(Boolean) || [];
                  const uniqueSchoolNames = [...new Set(schoolNames)];
                  
                  // Get unique grades from course_access
                  const grades = course.course_access
                    ?.map((access: CourseAccess) => access.grade)
                    .filter(Boolean) || [];
                  const uniqueGrades = [...new Set(grades)];
                  
                  return (
                  <TableRow key={course.id} className={selectedCourseIds.has(course.id) ? 'bg-blue-50' : ''}>
                    <TableCell className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedCourseIds.has(course.id)}
                        onChange={() => toggleSelectCourse(course.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {course.name || course.course_name || 'Unnamed Course'}
                    </TableCell>
                    <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                      {uniqueSchoolNames.length > 0 ? (
                        uniqueSchoolNames.join(', ')
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {uniqueGrades.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {uniqueGrades.map((grade: string, idx: number) => (
                            <Badge key={`${course.id}-${grade}-${idx}`} variant="secondary" className="text-xs">
                              {gradeOptions.find((go: GradeOption) => go.value === grade)?.label || grade}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </TableCell>
                  <TableCell>{course.total_chapters ?? course.num_chapters ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="flex items-center">
                        <Video className="h-4 w-4 mr-1 text-blue-500" />
                        {course.total_videos || 0}
                      </span>
                      <span className="flex items-center">
                        <FileText className="h-4 w-4 mr-1 text-green-500" />
                        {course.total_materials || 0}
                      </span>
                      <span className="flex items-center">
                        <CheckSquare className="h-4 w-4 mr-1 text-purple-500" />
                        {course.total_assignments || 0}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(course.status || 'Draft')}>
                      {course.status || 'Draft'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleViewCourse(course)}
                        title="View course details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
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
                        }}
                        title="Edit course"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteCourse(course)}
                        title="Delete course"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setPublishCourse(course);
                          setIsPublishDialogOpen(true);
                        }}
                        title={course.status === 'Published' ? 'Manage publishing (schools / grades / sections)' : 'Publish to schools, grades & sections'}
                        className={course.status === 'Published'
                          ? "text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                          : "text-green-600 hover:text-green-700 hover:bg-green-50"
                        }
                      >
                        {course.status === 'Published' ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setVersionHistoryCourse(course);
                          setIsVersionHistoryOpen(true);
                        }}
                        title="View version history (snapshots from saves and publishes)"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCloneCourse(course.id)}
                        disabled={isCloningCourse === course.id}
                        title="Clone course"
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {isCloningCourse === course.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          ) : (
            /* Grid View */
            filteredCourses.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {courses.length === 0 ? (
                  <>No courses found. Click &quot;Create Course&quot; to add your first course.</>
                ) : (
                  <>No courses match your search. Try a different search term.</>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredCourses.map((course) => {
                  const schoolNames = course.course_access
                    ?.map((access: CourseAccess) => access.schools?.name)
                    .filter(Boolean) || [];
                  const uniqueSchoolNames = [...new Set(schoolNames)];
                  const grades = course.course_access
                    ?.map((access: CourseAccess) => access.grade)
                    .filter(Boolean) || [];
                  const uniqueGrades = [...new Set(grades)];

                  return (
                    <div key={course.id} className="border rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col">
                      {/* Thumbnail */}
                      <div className="relative w-full pt-[56.25%] bg-gray-100">
                        {course.thumbnail_url ? (
                          <NextImage
                            src={course.thumbnail_url}
                            alt={course.name || 'Course thumbnail'}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
                            <BookOpen className="h-10 w-10 text-blue-300" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2">
                          <Badge className={getStatusColor(course.status || 'Draft')}>
                            {course.status || 'Draft'}
                          </Badge>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 flex flex-col flex-1 gap-2">
                        <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
                          {course.name || course.course_name || 'Unnamed Course'}
                        </p>

                        {uniqueSchoolNames.length > 0 && (
                          <p className="text-xs text-gray-500 truncate">{uniqueSchoolNames.join(', ')}</p>
                        )}

                        {uniqueGrades.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {uniqueGrades.map((grade: string, idx: number) => (
                              <Badge key={`${course.id}-${grade}-${idx}`} variant="secondary" className="text-xs">
                                {gradeOptions.find((go: GradeOption) => go.value === grade)?.label || grade}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-auto pt-2 border-t">
                          <span className="flex items-center gap-1">
                            <Video className="h-3 w-3 text-blue-500" />
                            {course.total_videos || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3 text-green-500" />
                            {course.total_materials || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <CheckSquare className="h-3 w-3 text-purple-500" />
                            {course.total_assignments || 0}
                          </span>
                          <span className="ml-auto text-gray-400">
                            {course.total_chapters ?? course.num_chapters ?? 0} ch.
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1 pt-1">
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleViewCourse(course)} title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Edit"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
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
                                const errorMessage = (error instanceof Error ? error.message : String(error)) || 'Failed to open edit dialog.';
                                toast.error(errorMessage);
                              }
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteCourse(course)} title="Delete" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => { setPublishCourse(course); setIsPublishDialogOpen(true); }}
                            title={course.status === 'Published' ? 'Manage publishing (schools / grades / sections)' : 'Publish to schools, grades & sections'}
                            className={course.status === 'Published' ? "text-yellow-600 hover:bg-yellow-50" : "text-green-600 hover:bg-green-50"}
                          >
                            {course.status === 'Published' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setVersionHistoryCourse(course);
                              setIsVersionHistoryOpen(true);
                            }}
                            title="Version history (snapshots from saves and publishes)"
                            className="text-blue-600 hover:bg-blue-50"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCloneCourse(course.id)}
                            disabled={isCloningCourse === course.id}
                            title="Clone course"
                            className="text-gray-500 hover:text-gray-700"
                          >
                            {isCloningCourse === course.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* View Course Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>Course Details</DialogTitle>
            <DialogDescription>View complete course information</DialogDescription>
          </DialogHeader>
          {viewingCourse && (
            <div className="space-y-6">
              <div>
                <Label className="text-sm font-semibold text-gray-700">Course Name</Label>
                <p className="text-lg font-medium text-gray-900 mt-1">{viewingCourse.name}</p>
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-700">Description</Label>
                <p className="text-gray-600 mt-1">{viewingCourse.description || 'No description provided'}</p>
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-700">Status</Label>
                <div className="mt-1">
                  <Badge className={getStatusColor(viewingCourse.status)}>{viewingCourse.status}</Badge>
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-700">Schools & Grades</Label>
                <div className="mt-2 space-y-2">
                  {viewingCourse.course_access && viewingCourse.course_access.length > 0 ? (
                    viewingCourse.course_access.map((access, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Badge variant="secondary">{access.schools?.name || 'Unknown School'}</Badge>
                        <Badge variant="outline">{access.grade}</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">No schools/grades assigned</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-gray-700">Chapters</Label>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{viewingCourse.total_chapters || 0}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-700">Videos</Label>
                  <p className="text-2xl font-bold text-purple-600 mt-1">{viewingCourse.total_videos || 0}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-700">Materials</Label>
                  <p className="text-2xl font-bold text-green-600 mt-1">{viewingCourse.total_materials || 0}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-700">Assignments</Label>
                  <p className="text-2xl font-bold text-orange-600 mt-1">{viewingCourse.total_assignments || 0}</p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-700">Created At</Label>
                <p className="text-gray-600 mt-1">{formatCourseDate(viewingCourse.created_at)}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Delete Course</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this course? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletingCourse && (
            <div className="py-4">
              <p className="text-sm text-gray-600">
                Course: <span className="font-semibold">{deletingCourse.name}</span>
              </p>
              <p className="text-sm text-red-600 mt-2">
                All course data including chapters, videos, materials, and assignments will be permanently deleted.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsDeleteDialogOpen(false);
              setDeletingCourse(null);
            }}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmDeleteCourse}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation */}
      <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Delete selected courses</DialogTitle>
            <DialogDescription>
              This will permanently delete {selectedCourseIds.size} course(s) and all related chapters, content, and assignments. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBulkDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
              onClick={() => void confirmBulkDelete()}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete {selectedCourseIds.size} course(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              clearCourseFormState();
              setStatusFilter('Draft'); // Show Draft courses to see the new one
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
          }}
        />
      )}

      {/* Course Editor */}
      {isEditDialogOpen && editingCourse && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="sr-only">
              <DialogTitle>Edit Course</DialogTitle>
              <DialogDescription>
                Update course details, chapters, content, and assignments.
              </DialogDescription>
            </DialogHeader>
            <CourseEditor
              course={{
                ...editingCourse,
                id: editingCourse.id,
                name: editingCourse.name || editingCourse.course_name || '',
                description: editingCourse.description || '',
                duration_weeks: editingCourse.duration_weeks,
                prerequisites_course_ids: editingCourse.prerequisites_course_ids || [],
                prerequisites_text: editingCourse.prerequisites_text || '',
                thumbnail_url: editingCourse.thumbnail_url || '',
                difficulty_level: editingCourse.difficulty_level || 'Beginner',
                status: editingCourse.status || 'Draft',
                chapters: (editingCourse.chapters || []) as unknown as EditorChapter[],
                assignments: (editingCourse.assignments || []) as unknown as EditorAssignmentFromAPI[],
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

      {/* Concurrent Edit Warning */}
      <Dialog open={!!concurrentEditWarning?.show} onOpenChange={(open) => { if (!open) setConcurrentEditWarning(null); }}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Course Modified by Another User
            </DialogTitle>
            <DialogDescription>
              This course was updated since you started editing. Saving now will overwrite those changes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConcurrentEditWarning(null)}>
              Cancel
            </Button>
            <Button
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
              onClick={async () => {
                if (concurrentEditWarning?.proceed) {
                  setConcurrentEditWarning(null);
                  await concurrentEditWarning.proceed();
                }
              }}
            >
              Save Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      {versionHistoryCourse && (
        <Dialog open={isVersionHistoryOpen} onOpenChange={(open) => {
          setIsVersionHistoryOpen(open);
          if (!open) setVersionHistoryCourse(null);
        }}>
          <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
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
