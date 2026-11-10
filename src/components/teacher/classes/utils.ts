import type { TeacherClassRow, TeacherScheduleRow } from "@/hooks/useTeacherData";
import { clock, toMin } from "../overview/utils";

export type Sched = TeacherScheduleRow;
export type ClassRow = TeacherClassRow;

type PeriodObj = { id?: string; period_number?: number; start_time?: string; end_time?: string };
const periodObj = (s: Sched): PeriodObj | null => (typeof s.period === "object" && s.period !== null ? (s.period as PeriodObj) : null);

export const startOf = (s: Sched) => periodObj(s)?.start_time || s.start_time || "";
export const endOf = (s: Sched) => periodObj(s)?.end_time || s.end_time || "";
export const periodNo = (s: Sched) => {
  const n = Number(periodObj(s)?.period_number);
  return Number.isFinite(n) ? n : 0;
};
export const periodIdOf = (s: Sched) => periodObj(s)?.id || String((s as { period_id?: string }).period_id || "");

/** Rows of the timetable. With several schools in one view, periods line up by clock time, because period ids differ per school. */
export function periodKey(s: Sched, mergeAcrossSchools: boolean): string {
  if (mergeAcrossSchools) {
    const start = startOf(s);
    const end = endOf(s);
    if (start || end) return `${start}|${end}`;
    if (periodNo(s)) return `p${periodNo(s)}`;
  }
  return periodIdOf(s) || `${startOf(s)}|${endOf(s)}`;
}

export type Period = { key: string; no: number; start: string; end: string };

export function buildPeriods(list: Sched[], merge: boolean): Period[] {
  const byKey = new Map<string, Period>();
  for (const s of list) {
    const key = periodKey(s, merge);
    if (!key || key === "|") continue;
    const have = byKey.get(key);
    if (have) {
      if (!have.no && periodNo(s)) have.no = periodNo(s);
      continue;
    }
    byKey.set(key, { key, no: periodNo(s), start: startOf(s), end: endOf(s) });
  }
  return [...byKey.values()].sort((a, b) => a.start.localeCompare(b.start) || a.no - b.no);
}

/** "101" becomes "Room 101"; names like "Lab 2" stay as they are. */
export function roomOf(s: Sched): string {
  const r = s.room;
  const v = (typeof r === "object" && r !== null ? r.room_name || r.room_number : typeof r === "string" ? r : "") ?? "";
  const t = String(v).trim();
  return t && /^\d+$/.test(t) ? `Room ${t}` : t;
}

/** "9:30 am" or "9:30 to 10:10 am"-style label for a period. */
export function spanLabel(start: string, end?: string): string {
  const a = toMin(start);
  if (!Number.isFinite(a)) return "";
  const b = toMin(end);
  return Number.isFinite(b) ? `${clock(a)} to ${clock(b)}` : clock(a);
}

export const minutesOf = (s: Sched) => {
  const a = toMin(startOf(s));
  const b = toMin(endOf(s));
  return Number.isFinite(a) && Number.isFinite(b) && b > a ? b - a : 0;
};
