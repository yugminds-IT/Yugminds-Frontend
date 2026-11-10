export { plural } from "../students/utils";
export { bandOf, pct, BANDS, BAND_LABEL, type Band } from "../../school-admin/analytics/types";

export interface SchoolRanking {
  rank: number;
  school_id: string;
  school_name: string;
  /** assignments this school's students can actually see */
  assignments_created: number;
  /** every attempt, retakes included */
  attempts_count: number;
  average_score_percentage: number;
  /** students who handed in at least once, as a share of enrolled students */
  completion_rate: number;
  /** share of attempts that were retakes */
  retake_usage_percentage: number;
}

export interface TopStudent {
  rank: number;
  system_rank?: number;
  student_id: number;
  student_name: string;
  school_name: string;
  grade: string;
  section?: string;
  course_assignment_score: number;
  daily_assignment_score: number;
  overall_score: number;
  badge?: "GOLD" | "SILVER" | "BRONZE" | "NONE";
}

export interface AnalyticsData {
  school_rankings: SchoolRanking[];
  platform_completion_rate: number;
  retake_usage: number;
  top_students_platform: TopStudent[];
  /** missing from the response when no assignment is published yet */
  summary?: { total_schools: number; total_assignments: number; total_attempts: number; platform_avg_score: number };
}

/** A school with no attempts has no average to rank, so it sits in its own "no work yet" group. */
export const schoolBand = (s: SchoolRanking) => (s.attempts_count <= 0 ? ("none" as const) : s.average_score_percentage >= 75 ? ("high" as const) : s.average_score_percentage >= 50 ? ("mid" as const) : ("low" as const));
