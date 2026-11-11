export { plural } from "../students/utils";

export interface TrashItem {
  id: string;
  name: string;
  detail: string;
  deleted_at: string | null;
}

export type Kind = "teachers" | "students" | "school_admins" | "courses";
export const KINDS: { key: Kind; label: string; one: string; many: string }[] = [
  { key: "teachers", label: "Teachers", one: "teacher", many: "teachers" },
  { key: "students", label: "Students", one: "student", many: "students" },
  { key: "school_admins", label: "School admins", one: "school admin", many: "school admins" },
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
  students: "Restoring a student turns their account back on straight away, with their classes and progress.",
  school_admins: "Restoring a school admin turns their account back on straight away, linked to the same school.",
  courses: "Courses come back unpublished. Publish them again when you are ready.",
};
