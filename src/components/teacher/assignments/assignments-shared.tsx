import type { TeacherClass } from "@/components/teacher/AssignmentAudiencePicker";

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
  is_retake?: boolean;
  grade?: string | null;
  section?: string | null;
  school_name?: string | null;
};

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

export function StatusPill({ published }: { published?: boolean }) {
  return published ? (
    <span className="inline-flex items-center text-[11px] font-medium text-emerald-700">
      Live
    </span>
  ) : (
    <span className="inline-flex items-center text-[11px] font-medium text-amber-700">
      Draft
    </span>
  );
}

export function Avatar({
  name,
  color = "blue",
}: {
  name: string;
  color?: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700",
    indigo: "bg-indigo-100 text-indigo-700",
    green: "bg-emerald-100 text-emerald-700",
  };
  return (
    <div
      className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${colors[color] ?? colors.blue}`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
