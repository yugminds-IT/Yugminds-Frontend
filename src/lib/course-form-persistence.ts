/**
 * Course Form Persistence Utility
 * 
 * Comprehensive form data persistence for course creation/editing
 * with auto-save, recovery, and state preservation across tab switches.
 */

import { clearFormData, hasFormData } from './form-persistence';

const COURSE_FORM_STORAGE_KEY = 'admin_course_creation_form';

export interface CourseFormState {
  // Basic form data
  formData: {
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
  };
  
  // Chapters
  chapters: Array<{
    id?: string;
    name: string;
    description?: string;
    learning_outcomes?: string[];
    order_number?: number;
    [key: string]: unknown; // Allow additional properties
  }>;
  
  // Videos
  videos: Array<{
    id?: string;
    chapter_id: string;
    title: string;
    url?: string;
    video_url?: string;
    type?: string;
    order_number?: number;
    [key: string]: unknown; // Allow additional properties
  }>;
  
  // Materials
  materials: Array<{
    id?: string;
    chapter_id: string;
    title: string;
    type?: string;
    url?: string;
    resource_url?: string;
    order_number?: number;
    [key: string]: unknown; // Allow additional properties
  }>;
  
  // Assignments
  assignments: Array<{
    id?: string;
    chapter_id: string;
    title: string;
    description: string;
    auto_grading_enabled: boolean;
    max_score: number;
    questions: Array<{
      id?: string;
      assignment_id?: string;
      question_type: 'MCQ' | 'FillBlank';
      question_text: string;
      options?: string[];
      correct_answer: string;
      marks: number;
      [key: string]: unknown; // Allow additional properties
    }>;
    [key: string]: unknown; // Allow additional properties
  }>;
  
  // Scheduling
  scheduling: {
    release_type: 'Daily' | 'Weekly' | 'Bi-weekly';
    start_date: string;
    release_schedule: Array<{ date?: string; chapter_id?: string; [key: string]: unknown }>;
  };
  
  // UI State
  uiState: {
    currentStep: number;
    selectedSchools: string[];
    selectedGrades: string[];
    currentChapterIndex: number;
  };
  
  // Metadata
  metadata: {
    lastSaved: number;
    isDirty: boolean;
    version: number;
  };
}

/**
 * Clear course form state
 */
export function clearCourseFormState(): void {
  clearFormData(COURSE_FORM_STORAGE_KEY);
}

/**
 * Check if course form has saved data
 */
export function hasCourseFormState(): boolean {
  return hasFormData(COURSE_FORM_STORAGE_KEY);
}


