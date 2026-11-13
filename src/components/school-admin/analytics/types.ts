export type Badge = "GOLD" | "SILVER" | "BRONZE" | "NONE";

export type LeaderboardStudent = {
  rank: number;
  school_rank?: number;
  grade_rank?: number;
  section_rank?: number;
  student_id: number;
  student_name: string;
  grade: string;
  section: string;
  course_assignment_score: number;
  daily_assignment_score: number;
  overall_score: number;
  assignments_attempted: number;
  graded_assignments_count: number;
  badge: Badge;
  daily_graded_count?: number;
};

export type GradeBreakdown = {
  grade: string;
  avg_course_score: number;
  avg_daily_score: number;
  avg_overall: number;
};

export type SectionBreakdown = GradeBreakdown & { section: string | null };

export type SubjectBreakdown = { subject: string; avg_score: number };

export type AssignmentRow = {
  assignment_id: string;
  title: string;
  assignment_type: string;
  subject: string;
  total_marks: number | null;
  total_submissions: number;
  targeted_students: number;
  graded_count: number;
  avg_score: number;
  avg_marks: number | null;
  highest_score: number;
  lowest_score: number;
  completion_rate: number;
};

export type LeaderboardData = {
  summary: {
    school_name: string;
    total_students: number;
    total_assignments_published: number;
    course_assignments_published: number;
    daily_assignments_published: number;
    overall_avg_score: number;
  };
  leaderboard: LeaderboardStudent[];
  grade_breakdown: GradeBreakdown[];
  section_breakdown: SectionBreakdown[];
  subject_breakdown: SubjectBreakdown[];
  daily_subject_breakdown?: SubjectBreakdown[];
  assignment_table: AssignmentRow[];
};

/** How a score reads: 75 and up is strong, 50 to 74 is getting there, under 50 needs help. */
export type Band = "none" | "low" | "mid" | "high";
export const BANDS: Band[] = ["none", "low", "mid", "high"];
export const BAND_LABEL: Record<Band, string> = {
  none: "No scores yet",
  low: "Under 50%",
  mid: "50 to 74%",
  high: "75% and up",
};

export const bandOf = (score: number, graded = 1): Band =>
  graded <= 0 ? "none" : score >= 75 ? "high" : score >= 50 ? "mid" : "low";

export const studentBand = (s: Pick<LeaderboardStudent, "overall_score" | "graded_assignments_count">): Band =>
  bandOf(s.overall_score, s.graded_assignments_count);

export const pct = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("en-IN")}%`;

/**
 * Re-cut a leaderboard so only daily work counts: the daily score stands in for "overall",
 * ranks are recomputed on it, and course-only rows, subjects and badges drop out.
 * Lets the Daily performance page reuse every overall-score component unchanged.
 */
export function toDailyView(d: LeaderboardData): LeaderboardData {
  const rows = d.leaderboard.map((s) => ({
    ...s,
    overall_score: s.daily_assignment_score,
    course_assignment_score: 0,
    graded_assignments_count: s.daily_graded_count ?? 0,
    assignments_attempted: s.daily_graded_count ?? 0,
    badge: "NONE" as Badge,
  }));
  rows.sort((a, b) => Number(b.graded_assignments_count > 0) - Number(a.graded_assignments_count > 0) || b.overall_score - a.overall_score);
  const seen = new Map<string, number>();
  const next = (k: string) => { const n = (seen.get(k) ?? 0) + 1; seen.set(k, n); return n; };
  rows.forEach((r, i) => {
    r.rank = r.school_rank = i + 1;
    r.grade_rank = next(`g\0${r.grade}`);
    r.section_rank = next(`s\0${r.grade}\0${r.section}`);
  });
  const scored = rows.filter((r) => r.graded_assignments_count > 0);
  const daily = d.assignment_table.filter((a) => a.assignment_type === "DAILY");
  return {
    ...d,
    summary: {
      ...d.summary,
      total_assignments_published: daily.length,
      course_assignments_published: 0,
      daily_assignments_published: daily.length,
      overall_avg_score: scored.length ? scored.reduce((n, r) => n + r.overall_score, 0) / scored.length : 0,
    },
    leaderboard: rows,
    grade_breakdown: d.grade_breakdown.map((g) => ({ ...g, avg_overall: g.avg_daily_score })),
    section_breakdown: d.section_breakdown.map((g) => ({ ...g, avg_overall: g.avg_daily_score })),
    subject_breakdown: d.daily_subject_breakdown ?? [],
    assignment_table: daily,
  };
}
