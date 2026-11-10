export type CourseStatus = 'Draft' | 'Published' | 'Archived'

export interface CourseChapter {
  id: string
  chapter_number: number
  title: string
  learning_outcomes: string[]
  content_description: string
  is_published: boolean
}

export interface Course {
  id: string
  course_name: string
  description: string
  num_chapters: number
  status: CourseStatus
  created_at: string
  updated_at: string
  /** every grade the course is open to, as written by the main admin */
  grades: string[]
  grade_access: Array<{ grade: string; sections: string[] }>
  chapters: CourseChapter[]
  student_progress: { total_students: number; completed_students: number; average_progress: number }
}

export interface StudentChapterProgress {
  id: string
  title?: string
  chapter_number?: number
  progress?: number
}

export interface StudentProgress {
  id?: string | number
  full_name?: string
  email?: string
  grade?: string
  section?: string
  overall_progress?: number
  completed?: boolean
  chapters?: StudentChapterProgress[]
}

export interface CourseStudentsData {
  students: StudentProgress[]
  chapters: Array<{ id?: string; title?: string }>
  error?: string
}

/** "grade 4" and "4" both read "Grade 4". */
export function formatGrade(g: string): string {
  if (!g) return 'N/A'
  const m = String(g).toLowerCase().match(/(grade\s*|g\s*)?(\d{1,2})/)
  return m ? `Grade ${m[2]}` : g.replace(/^(.)/, (s) => s.toUpperCase())
}

/** The classes a course is open to: "Grade 4" for a whole grade, "Grade 4-A" for one section. */
export function accessLabels(course: Course): string[] {
  if (course.grade_access?.length) {
    return course.grade_access.flatMap((ga) => {
      const g = formatGrade(ga.grade)
      return ga.sections?.length ? ga.sections.map((s) => `${g}-${s}`) : [g]
    })
  }
  return (course.grades || []).map(formatGrade)
}

export const shortDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not recorded'
