import type { TeacherLeave } from "@/hooks/useTeacherData";

type Stage = "pending" | "approved" | "rejected";
/** A leave as the teacher API returns it, with the emergency approval stages. */
export type Leave = TeacherLeave & {
  leave_type?: string;
  is_emergency?: boolean;
  school_admin_status?: Stage;
  admin_status?: Stage;
  substitute_required?: boolean;
  created_at?: string;
};

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export const statusOf = (l: { status: string }): LeaveStatus => {
  const s = l.status.toLowerCase();
  return s === "approved" || s === "rejected" || s === "cancelled" ? s : "pending";
};
export const STATUS_LABEL: Record<LeaveStatus, string> = { pending: "Waiting", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled" };

const parse = (s: string) => new Date(`${s}T12:00:00`);
const MS = 86_400_000;

/** Calendar days from start to end, both included. */
export const daysBetween = (start: string, end: string) => Math.max(1, Math.round((parse(end).getTime() - parse(start).getTime()) / MS) + 1);

/** Days of a leave that fall between two dates, both included. */
export function daysWithin(l: { start_date: string; end_date: string }, from: string, to: string): number {
  const a = l.start_date > from ? l.start_date : from;
  const b = l.end_date < to ? l.end_date : to;
  return a > b ? 0 : daysBetween(a, b);
}

/** "Wed 12 to Thu 13 Nov" */
export function rangeLabel(start: string, end: string): string {
  const a = parse(start);
  const b = parse(end);
  const day = (d: Date, month: boolean) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", ...(month ? { month: "short" } : {}) });
  if (start === end) return day(a, true);
  return `${day(a, a.getMonth() !== b.getMonth() || a.getFullYear() !== b.getFullYear())} to ${day(b, true)}`;
}

/** Who a teacher should chase while an emergency leave is stuck. */
export function waitingHint(l: Leave): string | null {
  if (!l.is_emergency) return null;
  const s = statusOf(l);
  if (s === "rejected" || s === "cancelled") return null;
  const school = l.school_admin_status ?? "pending";
  const admin = l.admin_status ?? "pending";
  if (school === "approved" && admin === "approved") return null;
  if (school !== "approved" && admin === "approved") return "The Admin has approved. Waiting for your school admin, so please ask them to approve.";
  if (school !== "approved") return "Waiting for your school admin. Please ask them to approve.";
  return "Your school admin has approved. Waiting for the Admin, so please ask them to approve.";
}

/** `YYYY-MM-DD` shifted by whole days, with no timezone surprises */
export const shiftDate = (s: string, days: number) => new Date(parse(s).getTime() + days * MS).toLocaleDateString("en-CA");
