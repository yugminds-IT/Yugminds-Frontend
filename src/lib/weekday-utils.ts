/**
 * 0=Sun..6=Sat — matches the backend's TeacherSchool.workingDays /
 * ClassSchedule.dayOfWeek / Date.getUTCDay() convention.
 */
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Full weekday names, 0=Sun..6=Sat. */
export const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/** Full weekday names, Monday-first (for Mon-Sun schedule grids). */
export const WEEKDAY_NAMES_MON_FIRST = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

/** Display order for the picker: week starts Monday. */
export const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];

/** Default School.operating_days when unset: all days except Sunday. */
export const DEFAULT_OPERATING_DAYS = [1, 2, 3, 4, 5, 6];

/** "Mon, Tue, Wed" in day order (Mon-first), for a set of 0-6 values. */
export function formatWorkingDays(days: number[] | undefined | null): string {
  if (!days || days.length === 0) return "Not set";
  const sorted = [...days].sort(
    (a, b) => WEEKDAY_DISPLAY_ORDER.indexOf(a) - WEEKDAY_DISPLAY_ORDER.indexOf(b),
  );
  return sorted.map((d) => WEEKDAY_LABELS[d]).join(", ");
}

/** Half-day window for one weekday (a day not listed is a full day) — mirrors backend DaySlot. */
export type DaySlot = { slot: "MORNING" | "AFTERNOON"; start: string; end: string };
export type DaySlotMap = Record<string, DaySlot>;

const to12h = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

/** "8:00 AM–12:30 PM" */
export const formatWindow = (s: Pick<DaySlot, "start" | "end">) => `${to12h(s.start)}–${to12h(s.end)}`;

/** "Morning" / "Afternoon" */
export const slotName = (s: Pick<DaySlot, "slot">) => (s.slot === "MORNING" ? "Morning" : "Afternoon");

/** "Mon, Tue · Thu AM 8:00 AM–12:30 PM" — weekdays plus any half-day windows. */
export function formatWorkingSchedule(
  days: number[] | undefined | null,
  slots?: DaySlotMap | null,
): string {
  const base = formatWorkingDays(days);
  const half = Object.entries(slots ?? {}).filter(([d]) => (days ?? []).includes(Number(d)));
  if (half.length === 0) return base;
  const parts = half
    .sort((a, b) => WEEKDAY_DISPLAY_ORDER.indexOf(Number(a[0])) - WEEKDAY_DISPLAY_ORDER.indexOf(Number(b[0])))
    .map(([d, s]) => `${WEEKDAY_LABELS[Number(d)]} ${s.slot === "MORNING" ? "AM" : "PM"} ${formatWindow(s)}`);
  return `${base} · ${parts.join(", ")}`;
}

/** The teacher's window on `day` as [start, end] (HH:MM), or null for a full day. */
export const teacherWindowOn = (slots: DaySlotMap | null | undefined, day: number): [string, string] | null => {
  const s = slots?.[String(day)];
  return s ? [s.start, s.end] : null;
};

const pad = (t: string) => (/^\d:/.test(t) ? `0${t}` : t);
/** Does a period (HH:MM) sit fully inside the window? Unparseable times count as fitting. */
export function periodFits(
  period: { start_time: string; end_time: string },
  window: [string, string] | null,
): boolean {
  if (!window) return true;
  if (!/^\d{1,2}:\d{2}$/.test(period.start_time) || !/^\d{1,2}:\d{2}$/.test(period.end_time)) return true;
  return pad(period.start_time) >= window[0] && pad(period.end_time) <= window[1];
}

/** The slice of a school-admin teacher record the timetable needs. */
export interface AvailabilityTeacher {
  full_name: string;
  teacher_schools?: Array<{
    working_days?: number[];
    day_slots?: DaySlotMap | null;
    assigned_from?: string | null;
    assigned_until?: string | null;
  }>;
}

/** Why a teacher can't take this day+period, or null when they can. */
function whyUnavailable(
  t: AvailabilityTeacher,
  day: number,
  period: { start_time: string; end_time: string },
  todayYmd: string,
): { kind: "assignment" | "day" | "hours"; window?: [string, string] } | null {
  const s = t.teacher_schools?.[0];
  if (!s) return null; // no assignment info: don't lock on missing data (server still enforces)
  if ((s.assigned_from && todayYmd < s.assigned_from) || (s.assigned_until && todayYmd > s.assigned_until)) {
    return { kind: "assignment" };
  }
  if (s.working_days && s.working_days.length > 0 && !s.working_days.includes(day)) return { kind: "day" };
  const window = teacherWindowOn(s.day_slots, day);
  if (!periodFits(period, window)) return { kind: "hours", window: window ?? undefined };
  return null;
}

export const teacherAvailableAt = (
  t: AvailabilityTeacher,
  day: number,
  period: { start_time: string; end_time: string },
  todayYmd: string,
): boolean => whyUnavailable(t, day, period, todayYmd) === null;

/**
 * null when at least one teacher can teach this day+period; otherwise a short
 * reason the admin can read ("Swaroopa is only here 8:00 AM–12:30 PM on Thursdays").
 * An empty teacher list never locks (nothing to judge by, and the form already
 * explains "no teachers yet").
 */
export function lockReason(
  teachers: AvailabilityTeacher[],
  day: number,
  period: { start_time: string; end_time: string },
  todayYmd: string,
): string | null {
  if (teachers.length === 0) return null;
  const reasons = teachers.map((t) => ({ t, why: whyUnavailable(t, day, period, todayYmd) }));
  if (reasons.some((r) => r.why === null)) return null;
  const dayName = WEEKDAY_NAMES[day] ?? "that day";
  const hours = reasons.filter((r) => r.why?.kind === "hours" && r.why.window);
  if (hours.length > 0) {
    const first = hours[0];
    const more = hours.length - 1;
    const w = first.why!.window!;
    return `${first.t.full_name}${more > 0 ? ` and ${more} more are` : " is"} only here ${formatWindow({ start: w[0], end: w[1] })} on ${dayName}s`;
  }
  return reasons.some((r) => r.why?.kind === "day") ? `No teacher works ${dayName}s` : "No teacher is currently assigned";
}

/**
 * School to open for a multi-school teacher right now: the working school whose
 * window holds `nowHHMM` (a full-day school holds the whole day), else the next
 * one to start, else the one that ended last. Null when none work today.
 */
export function pickCurrentSchoolId(working: string[], slots: DaySlotMap, nowHHMM: string): string | null {
  const win = (id: string): [string, string] => (slots[id] ? [slots[id].start, slots[id].end] : ["00:00", "24:00"]);
  const inside = working.find((id) => win(id)[0] <= nowHHMM && nowHHMM < win(id)[1]);
  if (inside) return inside;
  const next = working.filter((id) => win(id)[0] > nowHHMM).sort((a, b) => win(a)[0].localeCompare(win(b)[0]))[0];
  return next ?? [...working].sort((a, b) => win(b)[1].localeCompare(win(a)[1]))[0] ?? null;
}
