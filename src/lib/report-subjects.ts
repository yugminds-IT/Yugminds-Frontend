/** Subjects a teacher can teach. Used when setting up a teacher and when reporting a class. */
export const TEACHING_SUBJECTS = ["Robotics", "Coding", "AI/ML", "Python"] as const;

/** What a daily report can say was taught. "Other" covers exams, invigilation, orientation and similar. */
export const REPORT_SUBJECTS = [...TEACHING_SUBJECTS, "Other"] as const;

/** The list entry that matches a timetable subject (any casing), or the subject itself if it is not on the list. */
export const matchSubject = (s?: string | null): string => {
  const t = (s ?? "").trim();
  return REPORT_SUBJECTS.find((x) => x.toLowerCase() === t.toLowerCase()) ?? t;
};
