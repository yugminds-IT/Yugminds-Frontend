/** Shared by the school-admin Teachers page and its dialogs. */

export interface TeacherSchool {
  grades_assigned?: string[];
  sections_assigned?: string[];
  grade_sections_assigned?: string | Array<{ grade: string; sections?: string[] }>;
  subjects?: string[];
  working_days_per_week?: number;
  max_students_per_session?: number;
}

export interface Teacher {
  id?: string;
  teacher_id: string;
  full_name: string;
  email: string;
  phone: string;
  qualification: string;
  experience_years: number;
  specialization: string;
  status: string;
  created_at?: string;
  teacher_schools: TeacherSchool[];
  attendance_percentage?: number;
  leaves_taken?: number;
}

export interface LeaveRequest {
  id: string;
  teacher_id: string;
  school_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  leave_type: string;
  status: string;
  total_days?: number;
  substitute_required?: boolean;
  is_emergency?: boolean;
  school_admin_status?: "pending" | "approved" | "rejected";
  admin_status?: "pending" | "approved" | "rejected";
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  profiles: { id: string; full_name: string; email: string };
  reviewer?: { id: string; full_name: string; email: string; role: string };
  approver?: { id: string; full_name: string; email: string; role: string };
}

/** The teachers endpoint returns a flat row; an older nested shape is still accepted. */
export function normalizeTeacher(raw: Record<string, unknown>): Teacher {
  type Nested = Partial<Teacher> & { id?: string };
  const nested = (raw.teacher ?? {}) as Nested;
  const profile = (raw.profile ?? {}) as Nested;
  const r = raw as Partial<Teacher> & {
    grades_assigned?: string[];
    subjects?: string[];
    working_days_per_week?: number;
    max_students_per_session?: number;
  };
  const id = r.id ?? nested.id ?? profile.id;
  return {
    id,
    teacher_id: r.teacher_id ?? nested.teacher_id ?? `TCH-${String(id ?? "").slice(0, 8) || "UNKNOWN"}`,
    full_name: r.full_name ?? nested.full_name ?? profile.full_name ?? "",
    email: r.email ?? nested.email ?? profile.email ?? "",
    phone: r.phone ?? nested.phone ?? profile.phone ?? "",
    qualification: r.qualification ?? nested.qualification ?? "",
    experience_years: r.experience_years ?? nested.experience_years ?? 0,
    specialization: r.specialization ?? nested.specialization ?? "",
    status: r.status ?? nested.status ?? "Active",
    created_at: r.created_at ?? nested.created_at,
    attendance_percentage: r.attendance_percentage ?? 0,
    leaves_taken: r.leaves_taken ?? 0,
    teacher_schools: r.teacher_schools?.length
      ? r.teacher_schools
      : [{ grades_assigned: r.grades_assigned ?? [], subjects: r.subjects ?? [], working_days_per_week: r.working_days_per_week ?? 5, max_students_per_session: r.max_students_per_session ?? 30 }],
  };
}

/** "Section A" and "A" both become "A", for tight chips. */
export const compactSection = (s: string) => s.replace(/^section\s*/i, "").trim() || s;

export interface ClassGroup { grade: string; sections: string[] }

/** The grades and sections a teacher takes, one entry per grade. */
export function classGroups(t: Teacher): ClassGroup[] {
  const school = t.teacher_schools?.[0];
  const raw = school?.grade_sections_assigned;
  if (Array.isArray(raw) && raw.length) {
    return raw.map((g) => ({ grade: g.grade, sections: (g.sections ?? []).map(compactSection) }));
  }
  const grades = school?.grades_assigned ?? [];
  const sections = (school?.sections_assigned ?? []).map(compactSection);
  return grades.map((g) => ({ grade: g, sections }));
}

export const classLabel = (g: ClassGroup) => (g.sections.length ? `${g.grade} · ${g.sections.join(", ")}` : g.grade);
export const teacherSubjects = (t: Teacher) => t.teacher_schools?.[0]?.subjects ?? [];

export type AttendanceBand = "low" | "watch" | "good" | "none";

/** 0% means nothing was recorded, so it is "no data", not "needs attention". */
export function attendanceBand(t: Teacher): AttendanceBand {
  const p = t.attendance_percentage;
  if (!p) return "none";
  return p < 75 ? "low" : p < 90 ? "watch" : "good";
}

export const BAND_LABEL: Record<AttendanceBand, string> = {
  low: "Below 75%",
  watch: "75 to 89%",
  good: "90% and up",
  none: "No data",
};

/** YYYY-MM-DD for an <input type="date">, offset by whole days from today (local time). */
export function dateInput(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const shortDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";
