export { plural } from "../students/utils";

export interface Result {
  generatedAt?: string;
  analytics: { totalSchools: number; totalTeachers: number; totalStudents: number; activeCourses: number; systemHealth: number; avgAttendance: number; completionRate: number };
  trends: { schoolsChange: number | null; teachersChange: number | null; studentsChange: number | null; coursesChange: number | null };
  monthlyGrowth: { name: string; schools: number; teachers: number; students: number; courses: number }[];
  /** by school type */
  schoolDistribution: { name: string; value: number; color: string; percentage?: number }[];
  /** `engagement` is the school's student count as a share of the largest school's, not a measure of activity */
  topSchools: { name: string; engagement: number }[];
  popularCourses: { name: string; students: number }[];
  teacherPerformance: { excellent?: number; good?: number; average?: number; needsImprovement?: number; noRecords?: number };
  /** one entry per month: enrollments as a share of all students, and completions as a share of that month's enrollments */
  courseEngagement: { name: string; engagement: number; completion: number }[];
}

export const EMPTY: Result = {
  analytics: { totalSchools: 0, totalTeachers: 0, totalStudents: 0, activeCourses: 0, systemHealth: 100, avgAttendance: 0, completionRate: 0 },
  trends: { schoolsChange: 0, teachersChange: 0, studentsChange: 0, coursesChange: 0 },
  monthlyGrowth: [],
  schoolDistribution: [],
  topSchools: [],
  popularCourses: [],
  teacherPerformance: {},
  courseEngagement: [],
};

/** "+12% since last month", "New this month" when there was nothing a month ago, or "No change". */
export function trendText(change: number | null): string {
  if (change === null) return "New this month";
  if (change === 0) return "No change since last month";
  return `${change > 0 ? "+" : ""}${change}% since last month`;
}

export type Tab = "overview" | "schools" | "courses";
export const TABS: [Tab, string][] = [["overview", "Health"], ["schools", "Schools"], ["courses", "Courses"]];
