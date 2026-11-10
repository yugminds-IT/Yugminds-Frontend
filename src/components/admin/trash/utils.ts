export { plural } from "../students/utils";

export interface TrashItem {
  id: string;
  name: string;
  detail: string;
  deleted_at: string | null;
}

export type Kind = "teachers" | "courses";
export const KINDS: { key: Kind; label: string; one: string; many: string }[] = [
  { key: "teachers", label: "Teachers", one: "teacher", many: "teachers" },
  { key: "courses", label: "Courses", one: "course", many: "courses" },
];

/** How long ago something was deleted. Nothing is purged automatically, so this only helps you decide what to clear out. */
export type Age = "today" | "week" | "month" | "older";
export const AGES: Age[] = ["today", "week", "month", "older"];
export const AGE_LABEL: Record<Age, string> = { today: "Today", week: "This week", month: "This month", older: "Older" };

const DAY = 24 * 3600 * 1000;
export function ageOf(iso: string | null, now: number): Age {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (isNaN(t)) return "older";
  const d = now - t;
  return d < DAY ? "today" : d < 7 * DAY ? "week" : d < 30 * DAY ? "month" : "older";
}

export const NOTE: Record<Kind, string> = {
  teachers: "Restoring a teacher turns their account back on straight away.",
  courses: "Courses come back unpublished. Publish them again when you are ready.",
};
