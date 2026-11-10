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
