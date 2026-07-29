/**
 * 0=Sun..6=Sat — matches the backend's TeacherSchool.workingDays /
 * ClassSchedule.dayOfWeek / Date.getUTCDay() convention.
 */
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Display order for the picker: week starts Monday. */
export const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];

/** "Mon, Tue, Wed" in day order (Mon-first), for a set of 0-6 values. */
export function formatWorkingDays(days: number[] | undefined | null): string {
  if (!days || days.length === 0) return "Not set";
  const sorted = [...days].sort(
    (a, b) => WEEKDAY_DISPLAY_ORDER.indexOf(a) - WEEKDAY_DISPLAY_ORDER.indexOf(b),
  );
  return sorted.map((d) => WEEKDAY_LABELS[d]).join(", ");
}
