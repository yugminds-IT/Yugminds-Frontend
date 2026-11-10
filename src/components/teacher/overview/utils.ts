import { formatGradeBadge, formatSectionLabel } from "@/components/school-admin/student-utils";

/** One class from today's schedule, as the teacher hooks return it. */
export type TodayClass = {
  id?: string;
  schedule_id?: string;
  grade?: string;
  section?: string | null;
  subject?: string;
  start_time?: string;
  end_time?: string;
  hasReport?: boolean;
};

/** "09:30" or "09:30:00" to minutes since midnight. */
export const toMin = (t: string | undefined) => {
  const [h, m] = (t ?? "").split(":");
  const v = Number(h) * 60 + Number(m);
  return Number.isFinite(v) ? v : NaN;
};

/** 570 to "9:30 am" */
export const clock = (min: number) => {
  const h = Math.floor(min / 60);
  const m = String(min % 60).padStart(2, "0");
  return `${h % 12 || 12}:${m} ${h < 12 ? "am" : "pm"}`;
};

/** "Grade 4 · Section A". Grades and sections may be stored with or without their word. */
export const classLabel = (grade?: string | null, section?: string | null) =>
  [formatGradeBadge(grade), formatSectionLabel(section)].filter(Boolean).join(" · ");

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Dr. Anita Rao" becomes "Anita". */
export const firstNameOf = (full?: string | null) =>
  (full ?? "").trim().replace(/^(mr|mrs|ms|miss|dr|prof)\.?\s+/i, "").split(/\s+/)[0] ?? "";

export type DayRow = {
  key: string;
  href: string;
  subject: string;
  label: string;
  from: number;
  to: number;
  reported: boolean;
  /** where the clock is relative to this class */
  phase: "past" | "live" | "upcoming";
};

/** Today's classes in time order, each with its report state and where the clock stands against it. */
export function buildDay(list: TodayClass[] | undefined, nowMin: number): DayRow[] {
  return (list ?? [])
    .map((c, i) => {
      const from = toMin(c.start_time);
      const to = toMin(c.end_time);
      const end = Number.isFinite(to) ? to : from + 40;
      const periodId = c.schedule_id || c.id;
      return {
        key: periodId || `${i}-${c.start_time ?? ""}-${c.subject ?? ""}`,
        href: periodId ? `/lms/teacher/reports?period_id=${periodId}` : "/lms/teacher/reports",
        subject: c.subject || "General",
        label: classLabel(c.grade, c.section),
        from,
        to,
        reported: !!c.hasReport,
        phase: nowMin >= end ? "past" : nowMin >= from ? "live" : "upcoming",
      } satisfies DayRow;
    })
    .filter((r) => Number.isFinite(r.from))
    .sort((a, b) => a.from - b.from);
}
