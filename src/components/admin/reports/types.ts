/** Shared by the admin Teacher reports page and its tabs. */

export interface TeacherReport {
  id: string;
  teacher_id: string;
  school_id: string;
  date: string;
  grade: string;
  section?: string | null;
  topics_taught: string;
  activities?: string;
  student_count: number;
  duration_hours: number;
  notes: string;
  admin_notes?: string;
  status?: string;
  created_at: string;
  profiles?: { id: string; full_name?: string | null; email?: string | null } | null;
  schools?: { id: string; name?: string | null; school_code?: string | null } | null;
  teacher_name?: string;
  teacher_email?: string;
  school_name?: string;
  class_name?: string;
  teacher_deleted?: boolean;
  school_deleted?: boolean;
}

export interface TeacherPerformance {
  teacher_id: string;
  teacher_name: string;
  school_name: string;
  total_reports: number;
  total_hours: number;
  avg_students: number;
  attendance_rate: number;
  last_report_date: string;
}

export interface ReportTrend { name: string; reports: number; hours: number }
export interface SubjectDistribution { name: string; value: number; count: number; color: string }

export type ReportStatus = "submitted" | "reviewed" | "approved" | "rejected";
export const STATUS_ORDER: ReportStatus[] = ["submitted", "reviewed", "approved", "rejected"];
export const STATUS_LABEL: Record<ReportStatus, string> = { submitted: "Pending", reviewed: "Reviewed", approved: "Approved", rejected: "Rejected" };
export const statusOf = (r: Pick<TeacherReport, "status">): ReportStatus => {
  const s = (r.status ?? "submitted").toLowerCase();
  return (STATUS_ORDER as string[]).includes(s) ? (s as ReportStatus) : "submitted";
};

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const teacherName = (r: TeacherReport) => (r.teacher_deleted ? "Deleted teacher" : r.profiles?.full_name || r.teacher_name || "Unknown teacher");
export const schoolName = (r: TeacherReport) => (r.school_deleted ? "Deleted school" : r.schools?.name || r.school_name || "Unknown school");
export const longDate = (iso: string) => {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};
