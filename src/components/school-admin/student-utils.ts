/** Shared by the school-admin Students page and its dialogs. */

export interface Student {
  id: string;
  last_login?: string | null;
  profile_id: string;
  student_id?: string;
  school_id: string;
  grade: string;
  section?: string;
  joining_code: string;
  enrolled_at: string;
  is_active: boolean;
  profile: {
    full_name: string;
    email: string;
    created_at: string;
    parent_name?: string;
    parent_phone?: string;
  };
}

export interface StudentForm {
  full_name: string;
  email: string;
  grade: string;
  section: string;
  joining_code: string;
  password: string;
  parent_name: string;
  parent_phone: string;
}

export const emptyStudentForm = (): StudentForm => ({
  full_name: "",
  email: "",
  grade: "",
  section: "",
  joining_code: "",
  password: "",
  parent_name: "",
  parent_phone: "",
});

/** True when class/enrollment columns are empty in the API payload (persisted DB nulls). */
export function enrollmentMissingClassOrCode(student: Pick<Student, "grade" | "section" | "joining_code">): boolean {
  return !String(student.grade ?? "").trim() && !String(student.section ?? "").trim() && !String(student.joining_code ?? "").trim();
}

/** Grade is stored as the full configured name (e.g. "Grade 5"), so prefixing "Grade " again would double it. */
export function formatGradeBadge(grade: string | undefined | null): string {
  const g = String(grade ?? "").trim();
  if (!g) return "";
  return /^grade\b/i.test(g) ? g : `Grade ${g}`;
}

/** Sections may be stored as "A" or as "Section A"; show "Section A" either way, never "Section Section A". */
export function formatSectionLabel(section: string | undefined | null): string {
  const s = String(section ?? "").trim();
  if (!s) return "";
  return /^section\b/i.test(s) ? s : `Section ${s}`;
}

/** "Grade 5" becomes "5" for tight spaces; other names are cut to three letters. */
export function gradeShort(grade: string): string {
  const m = grade.match(/(\d+)\s*$/);
  return m ? m[1] : grade.replace(/^grade\s*/i, "").slice(0, 3);
}

/** Preferred display name when full_name was cleared server-side: falls back to the email's local part. */
export function displayStudentName(student: Student): string {
  const trimmed = student?.profile?.full_name?.trim();
  if (trimmed) return trimmed;
  const email = student?.profile?.email?.trim();
  if (email) {
    const tokens = (email.split("@")[0] ?? "").replace(/[._+-]+/g, " ").trim().split(/\s+/).filter(Boolean);
    if (tokens.length > 0) return tokens.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  }
  return `Student #${student.id}`;
}

/** Drops blanks and whitespace-only values and dedupes, optionally sorted. */
export function selectChoicesFrom(values: (string | null | undefined)[], sortAlphabetically: boolean): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = String(raw ?? "").trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return sortAlphabetically ? [...out].sort() : out;
}

/** A strong random password that meets the server rules (upper, lower, number, symbol). */
export function generatePassword(length = 12): string {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%&*"];
  const all = sets.join("");
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const chars = sets.map(pick);
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** Download text as a file. */
export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8;") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
