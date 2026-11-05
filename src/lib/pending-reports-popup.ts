export interface PendingPeriod {
  period_id?: string;
  grade?: string;
  section?: string | null;
  subject?: string;
  start_time?: string;
}

/** The slice of GET /teacher/attendance/today the popup needs. */
export interface TodayReportsStatus {
  notScheduledToday?: boolean;
  pendingPeriods?: PendingPeriod[];
  attendance?: { status?: string | null } | null;
  before_cutoff?: boolean;
}

// Days where a report isn't expected / attendance is already settled.
const NO_POPUP_STATUSES = new Set(['Leave-Approved', 'Holiday', 'Not-Scheduled', 'Present']);

/**
 * Show the "submit your reports" popup only while the teacher is on duty today,
 * has at least one scheduled period without a report, and isn't on approved
 * leave. It disappears by itself once every period is reported (nothing pending).
 */
export function shouldShowPendingReportsPopup(today: TodayReportsStatus | undefined | null): boolean {
  if (!today || today.notScheduledToday) return false;
  if (NO_POPUP_STATUSES.has(today.attendance?.status ?? '')) return false;
  return (today.pendingPeriods?.length ?? 0) > 0;
}
