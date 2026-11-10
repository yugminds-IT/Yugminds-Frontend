export type EntryType = "Holiday" | "Break" | "HalfDay" | "CompensatoryWork";

export interface CalendarEntry {
  id: string;
  school_id: string;
  school_name: string;
  date: string;
  end_date: string | null;
  name: string;
  type: EntryType;
  description: string | null;
}
export interface ScheduleDay { date: string; school_id: string; school_name: string }
export interface MonthData { calendar: CalendarEntry[]; schedule: ScheduleDay[]; unassignedDates: string[] }

export const TYPE_LABEL: Record<EntryType, string> = {
  Holiday: "Holiday",
  Break: "Break",
  HalfDay: "Half day",
  CompensatoryWork: "Make-up working day",
};

/** YYYY-MM-DD in local time */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => new Date(`${s}T12:00:00`);
export const longDate = (s: string) => parse(s).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
export const shortDate = (s: string) => parse(s).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

/** Every date an entry covers, inclusive. Entries may span several days. */
export function datesOf(e: CalendarEntry): string[] {
  const out: string[] = [];
  const start = new Date(`${e.date}T00:00:00.000Z`);
  const end = e.end_date ? new Date(`${e.end_date}T00:00:00.000Z`) : start;
  for (const d = new Date(start); d <= end && out.length < 62; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().split("T")[0]);
  return out;
}

/** The calendar days of one or more months looked up by date. A multi-day entry appears once per day it covers. */
export type Index = { entries: Map<string, CalendarEntry[]>; schedule: Map<string, ScheduleDay[]>; unassigned: Set<string>; all: CalendarEntry[] };

export function buildIndex(sets: Array<MonthData | undefined>): Index {
  const entries = new Map<string, CalendarEntry[]>();
  const schedule = new Map<string, ScheduleDay[]>();
  const unassigned = new Set<string>();
  const seen = new Set<string>();
  const all = new Map<string, CalendarEntry>();
  for (const s of sets) {
    if (!s) continue;
    s.unassignedDates.forEach((d) => unassigned.add(d));
    for (const sc of s.schedule) {
      const k = `${sc.date}|${sc.school_id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      schedule.set(sc.date, [...(schedule.get(sc.date) ?? []), sc]);
    }
    for (const e of s.calendar) {
      all.set(`${e.id}|${e.school_id}`, e);
      for (const d of datesOf(e)) {
        const k = `e|${e.id}|${e.school_id}|${d}`;
        if (seen.has(k)) continue;
        seen.add(k);
        entries.set(d, [...(entries.get(d) ?? []), e]);
      }
    }
  }
  return { entries, schedule, unassigned, all: [...all.values()] };
}

/** work = a normal day, half = a half day, comp = a make-up day, closed = holiday or break, off = weekly off */
export type DayKind = "work" | "half" | "comp" | "closed" | "off" | "unassigned";
export type DayInfo = { kind: DayKind; scheduled: ScheduleDay[]; entries: CalendarEntry[]; closedAt: CalendarEntry[] };

export function dayInfo(ix: Index, date: string): DayInfo {
  const entries = ix.entries.get(date) ?? [];
  const scheduled = ix.schedule.get(date) ?? [];
  const closedEntries = entries.filter((e) => e.type === "Holiday" || e.type === "Break");
  const closedAt = closedEntries.filter((e) => scheduled.some((s) => s.school_id === e.school_id));
  let kind: DayKind;
  if (ix.unassigned.has(date)) kind = "unassigned";
  else if (scheduled.length > 0) {
    const open = scheduled.filter((s) => !closedEntries.some((e) => e.school_id === s.school_id));
    kind = open.length === 0 ? "closed" : open.some((s) => entries.some((e) => e.type === "HalfDay" && e.school_id === s.school_id)) ? "half" : "work";
  } else kind = entries.some((e) => e.type === "CompensatoryWork") ? "comp" : "off";
  return { kind, scheduled, entries, closedAt };
}

export const WORKS: DayKind[] = ["work", "half", "comp"];

export const KIND_LABEL: Record<DayKind, string> = {
  work: "Working day",
  half: "Half day",
  comp: "Make-up working day",
  closed: "Closed",
  off: "Weekly off",
  unassigned: "Not yet assigned",
};

/** "10", or "10 to 12 Nov" */
export function rangeLabel(e: CalendarEntry): string {
  const a = parse(e.date);
  if (!e.end_date || e.end_date === e.date) return a.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const b = parse(e.end_date);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} to ${b.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
    : `${a.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} to ${b.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
}
