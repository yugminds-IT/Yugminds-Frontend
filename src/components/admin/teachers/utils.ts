/** Shared by the admin Teachers page and its tabs. Loose shapes: the API returns a few spellings of the same fields. */

export interface TeacherLike {
  id: string | number;
  full_name?: string;
  name?: string;
  email: string;
  phone?: string;
  qualification?: string;
  experience?: string;
  experience_years?: number;
  specialization?: string;
  status: string;
  createdAt?: string;
  created_at?: string;
  teacher_schools?: unknown[];
  assignedSchools?: unknown[];
}

export interface TodayStatus {
  status: string;
  isOnLeave?: boolean;
  leaveType?: string;
  attendanceRate?: number;
}
export interface SchoolToday { school_id: string; school_name: string; status: string }

export const nameOf = (t: Pick<TeacherLike, "full_name" | "name" | "email">) => t.full_name || t.name || t.email || "Unnamed";
export const idOf = (t: Pick<TeacherLike, "id">) => String(t.id ?? "");
export const isActive = (t: Pick<TeacherLike, "status">) => (t.status ?? "").toLowerCase() === "active";
export const experienceOf = (t: TeacherLike) => t.experience ?? (t.experience_years != null ? `${t.experience_years} ${t.experience_years === 1 ? "year" : "years"}` : "");
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What a teacher is doing today, grouped into the four stops of the track. */
export type TodayKey = "present" | "leave" | "absent" | "off";
export const TODAY_LABEL: Record<TodayKey, string> = { present: "Present", leave: "On leave", absent: "Not marked", off: "Day off" };
export const TODAY_KEYS: TodayKey[] = ["present", "leave", "absent", "off"];

export function todayKey(status?: string): TodayKey {
  switch (status) {
    case "Present": return "present";
    case "On Leave":
    case "Leave-Approved": return "leave";
    case "Holiday":
    case "Off Today": return "off";
    default: return "absent"; // Absent, Not Marked, anything unknown
  }
}

export interface SchoolBrief { id: string; name: string; grades: number; sections: number; subjects: string[] }

type RawGrade = { gradeName?: string; grade?: string; sectionsAssigned?: string[]; sections?: string[] };
type RawSchool = {
  schoolId?: string; school_id?: string; schoolName?: string; schools?: { id?: string; name?: string };
  gradesAssigned?: RawGrade[]; grade_sections_assigned?: RawGrade[]; grades_assigned?: string[]; subjects?: string[];
};

/** One short record per school the teacher works at, whichever shape the API used. */
export function schoolsOf(t: Pick<TeacherLike, "assignedSchools" | "teacher_schools">): SchoolBrief[] {
  const raw = (t.assignedSchools ?? t.teacher_schools ?? []) as RawSchool[];
  return raw.map((s, i) => {
    const grades: RawGrade[] = s.gradesAssigned ?? (Array.isArray(s.grade_sections_assigned) ? s.grade_sections_assigned : []);
    const sections = grades.reduce((n, g) => n + (g.sectionsAssigned ?? g.sections ?? []).length, 0);
    return {
      id: String(s.schoolId ?? s.school_id ?? s.schools?.id ?? i),
      name: s.schoolName ?? s.schools?.name ?? "School",
      grades: grades.length || (Array.isArray(s.grades_assigned) ? s.grades_assigned.length : 0),
      sections,
      subjects: Array.isArray(s.subjects) ? s.subjects.map(String) : [],
    };
  });
}

export const schoolLine = (s: SchoolBrief) =>
  [s.grades ? plural(s.grades, "grade") : "", s.sections ? plural(s.sections, "section") : "", s.subjects.join(", ")].filter(Boolean).join(" · ") || "No classes yet";

/** Everything searchable about a teacher in one lowercase string. */
export function searchBlob(t: TeacherLike): string {
  const schools = schoolsOf(t).flatMap((s) => [s.name, ...s.subjects]);
  return [nameOf(t), t.email, t.phone, t.qualification, t.specialization, ...schools].filter(Boolean).join(" ").toLowerCase();
}

export const shortDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export const band = (pct: number) => (pct >= 90 ? "good" : pct >= 75 ? "ok" : pct >= 50 ? "watch" : "low");
