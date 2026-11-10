/** Shared by the admin Students page and its tabs. Loose shapes: the API spells a few fields two ways. */

export interface StudentLike {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  parent_name?: string;
  parent_phone?: string;
  student_schools?: Array<{
    school_id?: string;
    school_name?: string | null;
    grade?: string;
    section?: string;
    schools?: { name?: string };
  }>;
  student_courses?: unknown[];
  progress?: number;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export interface Placement { schoolId: string; school: string; grade: string; section: string }

export const gradeLabel = (g?: string) => {
  const t = (g ?? "").toString().trim();
  if (!t || t === "Not Specified") return "";
  return t.toLowerCase().startsWith("grade") ? t : `Grade ${t}`;
};
export const sectionLabel = (s?: string) => {
  const t = (s ?? "").trim();
  return t.toLowerCase().startsWith("section ") ? t.slice(8).trim() : t;
};

/** Where the student sits: one entry per school they belong to. */
export function placementsOf(s: StudentLike): Placement[] {
  return (s.student_schools ?? []).map((p, i) => ({
    schoolId: String(p.school_id ?? i),
    school: p.school_name || p.schools?.name || "School",
    grade: gradeLabel(p.grade),
    section: sectionLabel(p.section),
  }));
}
export const classLine = (p: Placement) => [p.grade, p.section ? `Section ${p.section}` : ""].filter(Boolean).join(" · ") || "No class yet";

/** Course progress, grouped into the four stops of the track. */
export type Band = "new" | "going" | "half" | "done";
export const BAND_ORDER: Band[] = ["new", "going", "half", "done"];
export const BAND_LABEL: Record<Band, string> = { new: "Not started", going: "Under way", half: "Past halfway", done: "Finished" };
export function bandOf(progress?: number): Band {
  const p = Math.round(progress ?? 0);
  return p >= 100 ? "done" : p >= 50 ? "half" : p >= 1 ? "going" : "new";
}

export const searchBlob = (s: StudentLike) =>
  [s.full_name, s.email, s.parent_name, s.parent_phone, ...placementsOf(s).flatMap((p) => [p.school, p.grade, p.section])].filter(Boolean).join(" ").toLowerCase();

export const addedOn = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
