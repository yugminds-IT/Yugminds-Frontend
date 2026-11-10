import type { TeacherClass } from "@/components/teacher/AssignmentAudiencePicker";
import { initialsOf } from "@/components/portal/notifications";

export type TeacherAssignment = {
  id: string;
  title: string;
  subject?: string | null;
  due_date?: string | null;
  total_marks?: number | null;
  retake_enabled?: boolean;
  retake_rule?: string;
  assignment_type?: string;
  avg_score?: number;
  submission_count?: number;
  grade_name?: string;
  course_name?: string;
  is_published?: boolean;
  academic_year?: string;
  publish_scope?: string | null;
  published_grade_ids?: string[];
  published_section_ids?: string[];
};

export type Submission = {
  id: string;
  student_id: number;
  student_name: string;
  attempt_number: number;
  status: string;
  score: number | null;
  max_score: number | null;
  feedback?: string | null;
  submitted_at?: string | null;
  graded_at?: string | null;
  is_retake?: boolean;
  grade?: string | null;
  section?: string | null;
  school_name?: string | null;
};

/** Targeted student with no submission at all. */
export type NotSubmittedStudent = {
  student_id: number;
  student_name: string;
  email?: string | null;
  grade: string | null;
  section: string | null;
};

export type SubFilter = "all" | "graded" | "pending" | "not_submitted";

export type StudentRow = {
  student_id: number;
  student_name: string;
  grade: string | null;
  section: string | null;
  school_name: string | null;
  attempts: Submission[];
  best: Submission | null;
  latest: Submission;
  retake_granted: boolean;
  retake_grant_count: number;
  retake_granted_at: string | null;
};

export type AssignmentQuestionDetail = {
  id: string;
  question_type: string;
  question_text: string;
  options?: string[] | null;
  correct_answer?: string | null;
  marks: number;
};

export type AssignmentDetail = {
  id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  total_marks?: number | null;
  subject?: string | null;
  school_id?: string | null;
  is_published?: boolean;
  academic_year?: string | null;
  publish_scope?: string | null;
  published_grade_ids?: string[];
  published_section_ids?: string[];
  grade_id?: string | null;
  submission_count?: number;
  questions: AssignmentQuestionDetail[];
};

export type AssignmentsTab = "daily" | "course" | "requests" | "analytics";
export type DetailTab = "submissions" | "questions" | "retake";

export function audienceChipLabel(
  a: TeacherAssignment,
  classes: TeacherClass[],
): string | null {
  if (a.publish_scope === "grade" && !(a.published_grade_ids?.length)) {
    return "Entire school";
  }
  if (a.publish_scope === "section" && a.published_section_ids?.length) {
    const labels = a.published_section_ids
      .map((id) => classes.find((c) => c.section_id === id))
      .filter(Boolean)
      .map((c) => (c!.section ? `${c!.grade}-${c!.section}` : c!.grade));
    if (labels.length) return labels.join(", ");
    return `${a.published_section_ids.length} section(s)`;
  }
  if (a.publish_scope === "grade" && a.published_grade_ids?.length) {
    const labels = a.published_grade_ids
      .map((id) => classes.find((c) => c.grade_id === id)?.grade)
      .filter(Boolean);
    if (labels.length) return [...new Set(labels)].join(", ");
  }
  return a.grade_name ?? null;
}

/** draft = not published, past = published and the due date has gone, live = published and still open */
export type Stage = "draft" | "live" | "past";
export const STAGE_LABEL: Record<Stage, string> = { draft: "Draft", live: "Live", past: "Past due" };

export function stageOf(a: Pick<TeacherAssignment, "is_published" | "due_date">, now: number): Stage {
  if (!a.is_published) return "draft";
  const due = a.due_date ? new Date(a.due_date).getTime() : NaN;
  return Number.isFinite(due) && due < now ? "past" : "live";
}

export function StatusPill({ published, stage }: { published?: boolean; stage?: Stage }) {
  const s: Stage = stage ?? (published ? "live" : "draft");
  return <span className="tg-chip" data-s={s}>{STAGE_LABEL[s]}</span>;
}

export function Avatar({ name }: { name: string }) {
  return <span className="sd-avatar" aria-hidden="true">{initialsOf(name)}</span>;
}
