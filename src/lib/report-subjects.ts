/** Subjects a teacher can teach. Used when setting up a teacher and when reporting a class. */
export const TEACHING_SUBJECTS = ["Robotics", "Coding", "AI/ML", "Python"] as const;

/** What a daily report can say was taught. "Other" covers exams, invigilation, orientation and similar. */
export const REPORT_SUBJECTS = [...TEACHING_SUBJECTS, "Other"] as const;
