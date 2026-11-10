/** Shared by the admin School calendar page and its pieces. */

export type EntryType = "Holiday" | "Break" | "HalfDay" | "CompensatoryWork";

export interface CalendarEntry {
  id: string;
  school_id: string;
  school_name: string;
  date: string;
  end_date: string | null;
  name: string;
  type: EntryType;
  academic_year: string;
  description: string | null;
  batch_id: string | null;
  created_at: string;
}

export const TYPES: EntryType[] = ["Holiday", "Break", "HalfDay", "CompensatoryWork"];
export const TYPE_LABEL: Record<EntryType, string> = { Holiday: "Holiday", Break: "Break", HalfDay: "Half day", CompensatoryWork: "Make-up day" };
export const TYPE_HINT: Record<EntryType, string> = {
  Holiday: "School is closed. The day does not count as an absence.",
  Break: "School is closed for several days. They do not count as absences.",
  HalfDay: "A half day still counts as a working day for attendance.",
  CompensatoryWork: "Turns an off day, like a Saturday, into a working day.",
};

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const todayIst = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const parse = (s: string) => new Date(`${s}T12:00:00`);
export const longDate = (s: string) => parse(s).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
export const shortDate = (s: string) => parse(s).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
export const rangeLabel = (e: Pick<CalendarEntry, "date" | "end_date">) =>
  e.end_date && e.end_date !== e.date ? `${shortDate(e.date)} to ${shortDate(e.end_date)}` : shortDate(e.date);
export const monthTitle = (y: number, m: number) => new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

/** True if `dateStr` falls within [entry.date, entry.end_date ?? entry.date]. */
export const covers = (e: CalendarEntry, dateStr: string) => e.date <= dateStr && dateStr <= (e.end_date ?? e.date);

/** A holiday for every school is stored once per school; count it as one event. */
export const eventKey = (e: CalendarEntry) => e.batch_id ?? e.id;

/** What a day is: closed (holiday or break), off (weekly off), half, comp (make-up), unassigned (nobody teaches there), work. */
export type DayKind = "work" | "half" | "comp" | "closed" | "off" | "unassigned";
export const KIND_LABEL: Record<DayKind, string> = {
  work: "Teaching day",
  half: "Half day",
  comp: "Make-up working day",
  closed: "Closed",
  off: "Weekly off",
  unassigned: "Nobody is scheduled",
};

export interface DayCell { date: string; day: number; kind: DayKind; entries: CalendarEntry[] }

export function buildMonth(year: number, month: number, entries: CalendarEntry[], notScheduled: (date: string) => boolean): { lead: number; cells: DayCell[] } {
  const first = new Date(year, month - 1, 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const count = new Date(year, month, 0).getDate();
  const cells: DayCell[] = [];
  for (let day = 1; day <= count; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const here = entries.filter((e) => covers(e, date));
    const sunday = new Date(year, month - 1, day).getDay() === 0;
    const comp = here.some((e) => e.type === "CompensatoryWork");
    let kind: DayKind = "work";
    if (here.some((e) => e.type === "Holiday" || e.type === "Break")) kind = "closed";
    else if (sunday && !comp) kind = "off";
    else if (here.some((e) => e.type === "HalfDay")) kind = "half";
    else if (comp) kind = "comp";
    else if (notScheduled(date)) kind = "unassigned";
    cells.push({ date, day, kind, entries: here });
  }
  return { lead, cells };
}

/** Entries applied to every school (same batch) become one row; the rest stand alone. */
export type Row =
  | { kind: "single"; entry: CalendarEntry; sortDate: string }
  | { kind: "batch"; batchId: string; entries: CalendarEntry[]; sortDate: string };

export function groupEntries(entries: CalendarEntry[]): Row[] {
  const byBatch = new Map<string, CalendarEntry[]>();
  const standalone: CalendarEntry[] = [];
  for (const e of entries) {
    if (e.batch_id) byBatch.set(e.batch_id, [...(byBatch.get(e.batch_id) ?? []), e]);
    else standalone.push(e);
  }
  const rows: Row[] = [
    ...standalone.map((entry): Row => ({ kind: "single", entry, sortDate: entry.date })),
    ...[...byBatch].map(([batchId, list]): Row => ({ kind: "batch", batchId, entries: list, sortDate: list[0].date })),
  ];
  return rows.sort((a, b) => a.sortDate.localeCompare(b.sortDate));
}
