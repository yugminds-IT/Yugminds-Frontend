import type { StudentProgressData } from "@/hooks/useStudentProgress";

export { plural, gradeLabel } from "../students/utils";

/** Where a student stands across the courses they are enrolled in. */
export type Stage = "none" | "idle" | "going" | "done";
export const STAGES: Stage[] = ["none", "idle", "going", "done"];
export const STAGE_LABEL: Record<Stage, string> = { none: "No course yet", idle: "Not started", going: "In progress", done: "Finished" };

export type CourseRow = StudentProgressData["courses"][number];

/** A student as the page shows them: with the course filter already applied to their courses. */
export interface Row {
  id: string;
  name: string;
  email: string;
  schoolId: string;
  school: string;
  grade: string;
  section: string;
  courses: CourseRow[];
  progress: number;
  done: number;
  last: string;
  lastMs: number;
  stage: Stage;
}

const stageOf = (courses: CourseRow[]): Stage => {
  if (courses.length === 0) return "none";
  if (courses.every((c) => c.status === "completed")) return "done";
  return courses.some((c) => c.progress_percentage > 0) ? "going" : "idle";
};

/** One row per student. With `courseId`, only that course counts (and students not on it are left out). */
export function toRows(students: StudentProgressData[], courseId: string): Row[] {
  const out: Row[] = [];
  for (const s of students) {
    const all = s.courses ?? [];
    const courses = courseId ? all.filter((c) => c.course_id === courseId) : all;
    if (courseId && courses.length === 0) continue;
    const progress = courses.length ? courses.reduce((n, c) => n + (c.progress_percentage ?? 0), 0) / courses.length : 0;
    const lastMs = courses.reduce((m, c) => (c.last_accessed ? Math.max(m, new Date(c.last_accessed).getTime() || 0) : m), 0);
    out.push({
      id: s.student_id,
      name: s.full_name || s.email,
      email: s.email,
      schoolId: s.school_id ?? "",
      school: s.school_name ?? "",
      grade: s.grade ?? "",
      section: s.section ?? "",
      courses,
      progress: Math.round(progress),
      done: courses.filter((c) => c.status === "completed").length,
      last: lastMs ? new Date(lastMs).toISOString() : "",
      lastMs,
      stage: stageOf(courses),
    });
  }
  return out;
}

export const average = (rows: Row[]) => {
  const enrolled = rows.filter((r) => r.courses.length > 0);
  return enrolled.length ? Math.round(enrolled.reduce((n, r) => n + r.progress, 0) / enrolled.length) : 0;
};

export interface Group {
  key: string;
  name: string;
  students: number;
  enrolled: number;
  finished: number;
  avg: number;
}

/** Students grouped by a key (school or grade), with how many are enrolled, finished, and their average. */
export function groupBy(rows: Row[], keyOf: (r: Row) => string, nameOf: (key: string) => string): Group[] {
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const k = keyOf(r);
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return [...map.entries()].map(([key, rs]) => ({
    key,
    name: nameOf(key),
    students: rs.length,
    enrolled: rs.filter((r) => r.courses.length > 0).length,
    finished: rs.filter((r) => r.stage === "done").length,
    avg: average(rs),
  }));
}

export const WEEK = 7 * 24 * 3600 * 1000;
