export type MonthRow = {
  month?: string;
  present_count: number;
  absent_count: number;
  leave_count: number;
  unreported_count: number;
  total_days?: number;
};

/** One month, summed over every school in view (a combined "All schools" view returns a row per school). */
export type Month = { key: string; present: number; absent: number; leave: number; unreported: number; total: number; pct: number };

export function rollUp(rows: MonthRow[] | undefined): Map<string, Month> {
  const out = new Map<string, Month>();
  for (const r of rows ?? []) {
    const key = String(r.month ?? "").slice(0, 7);
    if (!key) continue;
    const m = out.get(key) ?? { key, present: 0, absent: 0, leave: 0, unreported: 0, total: 0, pct: 0 };
    m.present += r.present_count || 0;
    m.absent += r.absent_count || 0;
    m.leave += r.leave_count || 0;
    m.unreported += r.unreported_count || 0;
    m.total += r.total_days || r.present_count + r.absent_count + r.leave_count + r.unreported_count || 0;
    out.set(key, m);
  }
  for (const m of out.values()) m.pct = m.total > 0 ? Math.round((m.present / m.total) * 100) : 0;
  return out;
}

/** The calendar month keys ("2026-11") ending at `now`, oldest first. */
export function lastMonths(now: Date, n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

export const monthDate = (key: string) => new Date(`${key}-01T00:00:00`);
export const monthName = (key: string, long = true) => monthDate(key).toLocaleDateString("en-IN", { month: long ? "long" : "short", year: long ? "numeric" : undefined });

export type DayStatus = "present" | "absent" | "leave" | "unreported" | "pending" | "rejected";
const MAP: Record<string, DayStatus> = {
  Present: "present",
  Absent: "absent",
  "Leave-Approved": "leave",
  "Leave-Rejected": "rejected",
  Unreported: "unreported",
  Pending: "pending",
};
export const dayStatus = (s?: string | null): DayStatus | null => (s ? MAP[s] ?? null : null);
export const STATUS_LABEL: Record<DayStatus, string> = {
  present: "Present",
  absent: "Absent",
  leave: "On leave",
  unreported: "Not reported",
  pending: "Pending",
  rejected: "Leave rejected",
};

export type DayRecord = { id: string; date: string; status: string; recorded_at?: string; late_report?: boolean };

/** How a month's rate reads in words. */
export const rateWord = (pct: number) => (pct >= 90 ? "Healthy" : pct >= 75 ? "Fair" : "Needs attention");
