/** Shared by the admin Joining codes page, its dialog and the panel inside both. */

export interface JoiningCode {
  id: string;
  code: string;
  school_id: string;
  grade: string;
  section?: string | null;
  is_active: boolean;
  usage_type: "single" | "multiple";
  times_used: number;
  max_uses: number | null;
  expires_at: string;
  created_at: string;
  updated_at?: string;
}

/** Every grade a code can be made for. */
export const ALL_GRADES = [
  "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6",
  "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12",
];

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What a code can do right now. A switched-off code is "off" even if it has also run out. */
export type CodeState = "active" | "full" | "expired" | "off";
export const STATE_ORDER: CodeState[] = ["active", "full", "expired", "off"];
export const STATE_LABEL: Record<CodeState, string> = { active: "Working", full: "Used up", expired: "Expired", off: "Switched off" };

export function stateOf(c: JoiningCode, now: number): CodeState {
  if (!c.is_active) return "off";
  if (c.expires_at && new Date(c.expires_at).getTime() < now) return "expired";
  const limit = c.usage_type === "single" ? 1 : c.max_uses;
  if (limit != null && c.times_used >= limit) return "full";
  return "active";
}

/** Grade 1 to 12, then sections. */
export function gradeRank(g: string): number {
  const i = ALL_GRADES.indexOf(g);
  return i >= 0 ? i : ALL_GRADES.length + 1;
}
export const sortCodes = (list: JoiningCode[]) =>
  [...list].sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade) || (a.section ?? "").localeCompare(b.section ?? "", undefined, { numeric: true }));

export const monthYear = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
