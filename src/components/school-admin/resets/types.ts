export type ResetStatus = "pending" | "approved" | "rejected" | "completed";

export type ResetRequest = {
  id: string;
  user_id: string;
  email: string;
  user_role: string;
  status: ResetStatus;
  requested_at: string;
  approved_at?: string;
  approved_by?: string;
  approved_by_name?: string;
  school_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  profiles?: { id: string; full_name?: string; email: string; role: string; school_id?: string };
  schools?: { id: string; name: string };
};

export type ResetCounts = Record<ResetStatus, number>;

export const STATUS_LABEL: Record<ResetStatus, string> = {
  pending: "Waiting",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
};

/** "school_admin" becomes "School admin". */
export const roleLabel = (r: string) => {
  const s = r.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const nameOf = (r: ResetRequest) => r.profiles?.full_name?.trim() || r.email;

export const fullDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";

/** How long a request has been waiting, in plain words: "5 minutes", "3 hours", "2 days". */
export function waited(iso: string, now: number): string {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "less than a minute";
  if (mins < 60) return `${mins} ${mins === 1 ? "minute" : "minutes"}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${hrs === 1 ? "hour" : "hours"}`;
  const days = Math.floor(hrs / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** After a day, a locked-out person is a problem worth flagging. */
export const isOverdue = (iso: string, now: number) => now - new Date(iso).getTime() >= 86_400_000;
