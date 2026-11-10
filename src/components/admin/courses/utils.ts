/** Shared by the admin Courses page and its list. Loose shapes: the API spells a few fields two ways. */

export interface CourseLike {
  id: string;
  name: string;
  course_name?: string;
  description?: string;
  status: "Draft" | "Published";
  total_chapters?: number;
  num_chapters?: number;
  total_videos?: number;
  total_materials?: number;
  total_assignments?: number;
  thumbnail_url?: string;
  chapter_unlock_interval_days?: number | null;
  created_at: string;
  updated_at: string;
  course_access?: Array<{ grade?: string; sections?: string[]; schools?: { name: string } }>;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const titleOf = (c: Pick<CourseLike, "name" | "course_name">) => c.name || c.course_name || "Unnamed course";
export const chaptersOf = (c: CourseLike) => c.total_chapters ?? c.num_chapters ?? 0;

/** A course's road to students: no content yet, content but not published, or live. */
export type Stage = "empty" | "ready" | "live";
export const STAGES: Stage[] = ["empty", "ready", "live"];
export const STAGE_LABEL: Record<Stage, string> = { empty: "Needs content", ready: "Ready to publish", live: "Live" };
export function stageOf(c: CourseLike): Stage {
  if (c.status === "Published") return "live";
  return chaptersOf(c) > 0 ? "ready" : "empty";
}

/** "grade6" -> "Grade 6"; anything else is shown as it came. */
export const gradeText = (raw?: string) => {
  if (!raw) return "";
  const m = raw.match(/^grade\s*(\d{1,2})$/i);
  return m ? `Grade ${m[1]}` : raw;
};

export const schoolsOf = (c: CourseLike) => [...new Set((c.course_access ?? []).map((a) => a.schools?.name).filter((n): n is string => !!n))];
export const classesOf = (c: CourseLike) => {
  const labels = (c.course_access ?? []).flatMap((a) => {
    const g = gradeText(a.grade);
    return a.sections?.length ? a.sections.map((s) => `${g}-${s}`) : g ? [g] : [];
  });
  return [...new Set(labels)];
};

export const searchBlob = (c: CourseLike) =>
  [titleOf(c), c.description, ...schoolsOf(c), ...classesOf(c)].filter(Boolean).join(" ").toLowerCase();

export const day = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
