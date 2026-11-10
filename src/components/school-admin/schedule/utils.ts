import { WEEKDAY_NAMES_MON_FIRST } from "@/lib/weekday-utils";
import type { Schedule } from "./types";

export const DAYS_OF_WEEK = WEEKDAY_NAMES_MON_FIRST;
export const GRID_DAYS = WEEKDAY_NAMES_MON_FIRST.slice(0, 6);

/** 0=Sun..6=Sat — matches TeacherSchool.workingDays / school-admin-extra.controller.ts's DAY_MAP. */
export const DAY_NAME_TO_NUMBER: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export const NUMBER_TO_DAY_NAME: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

/** Next school operating day after `day` (wraps within the week). */
export function getNextOperatingDay(day: string, operatingDays: number[]): string | null {
  if (!operatingDays.length) return null;
  const start = DAY_NAME_TO_NUMBER[day];
  if (start === undefined) return null;
  for (let step = 1; step <= 7; step++) {
    const candidate = (start + step) % 7;
    if (operatingDays.includes(candidate)) {
      return NUMBER_TO_DAY_NAME[candidate] ?? null;
    }
  }
  return null;
}

/** Academic year string matching backend `currentAcademicYear` (starts in June). */
export function currentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const start = now.getMonth() < 5 ? year - 1 : year;
  return `${start}-${String(start + 1).slice(-2)}`;
}

export const CURRENT_ACADEMIC_YEAR = currentAcademicYear();

/**
 * Expands a single "starting" room number into `count` sequential room
 * numbers for bulk creation. Preserves a numeric suffix's width (leading
 * zeros) when one exists, e.g. "R101" x3 -> R101, R102, R103; "Lab-05" x3 ->
 * Lab-05, Lab-06, Lab-07. Falls back to a "-N" suffix when the base has no
 * trailing digits to increment, e.g. "Library" x3 -> Library-1, Library-2, Library-3.
 */
export function generateBulkRoomNumbers(base: string, count: number): string[] {
  const trimmed = base.trim();
  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (match) {
    const [, prefix, digits] = match;
    const start = parseInt(digits, 10);
    return Array.from({ length: count }, (_, i) =>
      `${prefix}${String(start + i).padStart(digits.length, '0')}`,
    );
  }
  return Array.from({ length: count }, (_, i) => `${trimmed}-${i + 1}`);
}

/** Breaks are time gaps between teaching periods — never stored as Period rows. */
export type TemplateBreakType = 'short' | 'lunch';

export interface TemplateBreak {
  id: string;
  type: TemplateBreakType;
  afterPeriod: number;
  durationMin: number;
}

export function msToHHMM(ms: number): string {
  return new Date(ms).toTimeString().substring(0, 5);
}

/** Heuristic for amber gap rows: ≥25 min → Lunch, else Short break. */
export function breakLabelForGap(diffMin: number): string {
  return diffMin >= 25 ? `Lunch · ${diffMin} min` : `Short break · ${diffMin} min`;
}

export function buildPeriodTimeline(opts: {
  startTime: string;
  count: number;
  durationMin: number;
  breaks?: Array<{ afterPeriod: number; durationMin: number }>;
}): Array<{ period_number: number; start_time: string; end_time: string; is_active: boolean }> {
  const gapAfter = new Map<number, number>();
  for (const b of opts.breaks ?? []) {
    if (b.afterPeriod < 1 || b.afterPeriod >= opts.count || b.durationMin <= 0) continue;
    gapAfter.set(b.afterPeriod, (gapAfter.get(b.afterPeriod) ?? 0) + b.durationMin);
  }
  let currentMs = new Date(`2000-01-01T${opts.startTime}`).getTime();
  const config: Array<{
    period_number: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
  }> = [];
  for (let i = 1; i <= opts.count; i++) {
    const endMs = currentMs + opts.durationMin * 60000;
    config.push({
      period_number: i,
      start_time: msToHHMM(currentMs),
      end_time: msToHHMM(endMs),
      is_active: true,
    });
    currentMs = endMs;
    const gap = gapAfter.get(i);
    if (gap) currentMs += gap * 60000;
  }
  return config;
}

export type DayPreviewItem =
  | { kind: 'period'; label: string; range: string }
  | { kind: 'break'; label: string; range: string };

export function buildDayPreview(opts: {
  startTime: string;
  count: number;
  durationMin: number;
  breaks: TemplateBreak[];
}): DayPreviewItem[] {
  const items: DayPreviewItem[] = [];
  const gapAfter = new Map<number, TemplateBreak[]>();
  for (const b of opts.breaks) {
    if (b.afterPeriod < 1 || b.afterPeriod >= opts.count || b.durationMin <= 0) continue;
    if (!gapAfter.has(b.afterPeriod)) gapAfter.set(b.afterPeriod, []);
    gapAfter.get(b.afterPeriod)!.push(b);
  }
  let currentMs = new Date(`2000-01-01T${opts.startTime}`).getTime();
  for (let i = 1; i <= opts.count; i++) {
    const endMs = currentMs + opts.durationMin * 60000;
    items.push({
      kind: 'period',
      label: `Period ${i}`,
      range: `${msToHHMM(currentMs)} – ${msToHHMM(endMs)}`,
    });
    currentMs = endMs;
    for (const b of gapAfter.get(i) ?? []) {
      const breakEnd = currentMs + b.durationMin * 60000;
      items.push({
        kind: 'break',
        label: b.type === 'lunch' ? `Lunch · ${b.durationMin} min` : `Short break · ${b.durationMin} min`,
        range: `${msToHHMM(currentMs)} – ${msToHHMM(breakEnd)}`,
      });
      currentMs = breakEnd;
    }
  }
  return items;
}

export const AVAILABLE_GRADES = [
  'Pre-K',
  'Kindergarten', 
  'Grade 1', 
  'Grade 2', 
  'Grade 3', 
  'Grade 4', 
  'Grade 5',
  'Grade 6', 
  'Grade 7', 
  'Grade 8', 
  'Grade 9', 
  'Grade 10', 
  'Grade 11', 
  'Grade 12'
];

/** "09:30" or "09:30:00" to "9:30 AM". */
export function formatTime(time: string): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minutes} ${ampm}`;
}

/** "Grade 5-A", or just "Grade 5" when the class has no section. */
export function gradeSectionLabel(schedule: Pick<Schedule, "grade" | "section">): string {
  return schedule.section ? `${schedule.grade}-${schedule.section}` : schedule.grade;
}

/**
 * A stable colour slot (0 to 7) for a subject, so the same subject always looks the same on the grid.
 * Eight muted hues, defined as CSS variables in schedule.css.
 */
export function subjectHue(subject: string | undefined | null): number {
  const s = (subject ?? "").trim().toLowerCase() || "other";
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 8;
}

/** Natural order for grade names, so "Grade 2" comes before "Grade 10". */
export const naturalSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
