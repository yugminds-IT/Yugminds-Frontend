export type AssignmentType = "COURSE" | "DAILY" | "EXAM";

export const EXAM_TYPE_LABEL: Record<string, string> = {
  ANNUAL: "Annual exam",
  SEMESTER: "Semester exam",
  QUARTERLY: "Quarterly exam",
  HALF_YEARLY: "Half-yearly exam",
  MID_TERM: "Mid-term exam",
  UNIT_TEST: "Unit test",
  OTHER: "Exam",
};

export const typeLabel = (t?: string | null) => (t === "COURSE" ? "Course" : t === "EXAM" ? "Exam" : "Daily");

export const fmtWindow = (s?: string | null, e?: string | null) => {
  const f = (v?: string | null) => (v ? new Date(v).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");
  return `${f(s)} → ${f(e)}`;
};
