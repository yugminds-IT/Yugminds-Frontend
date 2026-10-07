export type ExportEnrollment = {
  school_id?: string;
  grade?: string;
  section?: string;
  is_active?: boolean;
};

export type ExportClassOption = {
  grade: string;
  count: number;
  sections: { section: string; key: string; count: number }[];
};

export const classKey = (grade: string, section: string) => `${grade}::${section}`;

const gradeNumber = (g: string) => parseInt(g.replace(/\D/g, ''), 10);

function compareGrades(a: string, b: string) {
  const na = gradeNumber(a);
  const nb = gradeNumber(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return a.localeCompare(b, undefined, { numeric: true });
}

function activeIn(e: ExportEnrollment, schoolIds: string[]) {
  return e.is_active !== false && (schoolIds.length === 0 || schoolIds.includes(e.school_id ?? ''));
}

/** Grades and sections that actually have students in the selected schools (all schools when none selected). */
export function exportClassOptions(
  students: { student_schools?: ExportEnrollment[] }[],
  schoolIds: string[],
): ExportClassOption[] {
  const grades = new Map<string, Map<string, number>>();
  for (const s of students) {
    for (const e of s.student_schools ?? []) {
      if (!e.grade || !activeIn(e, schoolIds)) continue;
      const sections = grades.get(e.grade) ?? new Map<string, number>();
      const section = e.section?.trim() ?? '';
      sections.set(section, (sections.get(section) ?? 0) + 1);
      grades.set(e.grade, sections);
    }
  }
  return [...grades.entries()]
    .sort(([a], [b]) => compareGrades(a, b))
    .map(([grade, sections]) => {
      const list = [...sections.entries()]
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
        .map(([section, count]) => ({ section, key: classKey(grade, section), count }));
      return { grade, count: list.reduce((n, s) => n + s.count, 0), sections: list };
    });
}

/**
 * The enrollment that puts this student in the export, or null. School and
 * class are checked on the same enrollment, so a student isn't matched by
 * one school's membership plus another school's grade.
 */
export function matchingEnrollment<E extends ExportEnrollment>(
  student: { student_schools?: E[] },
  schoolIds: string[],
  classKeys: string[],
): E | null {
  return (
    (student.student_schools ?? []).find(
      (e) =>
        activeIn(e, schoolIds) &&
        (classKeys.length === 0 || classKeys.includes(classKey(e.grade ?? '', e.section?.trim() ?? ''))),
    ) ?? null
  );
}
