import { classLabel, clock, toMin } from "../overview/utils";

/** One of today's scheduled classes, as the periods endpoint returns it. */
export type PeriodRow = {
  id: string;
  period_number?: number;
  grade?: string;
  section?: string | null;
  subject?: string;
  start_time?: string;
  end_time?: string;
  class_name?: string;
};

export type ReportRow = {
  id?: string;
  grade?: string;
  section?: string | null;
  date?: string;
  created_at?: string;
  report_status?: string;
  topics_taught?: string;
  classes?: Array<{ grade?: string; section?: string | null }> | { grade?: string; section?: string | null };
  period_id?: string;
};

/** A rejected report can be sent again (the server updates the same row), so it never counts as "done". */
export const isRejected = (r?: ReportRow) => String(r?.report_status ?? "").toLowerCase() === "rejected";

export const subjectOf = (p: PeriodRow) => p.subject || p.class_name || "Class";
export const periodClass = (p: PeriodRow) => classLabel(p.grade, p.section);

/** "10:10 am to 10:50 am" */
export function periodSpan(p: PeriodRow): string {
  const a = toMin(p.start_time);
  if (!Number.isFinite(a)) return "";
  const b = toMin(p.end_time);
  return Number.isFinite(b) ? `${clock(a)} to ${clock(b)}` : clock(a);
}

/** Class label for a report row, whichever shape the API used. */
export function reportClass(r: ReportRow): string {
  const c = Array.isArray(r.classes) ? r.classes[0] : r.classes;
  return classLabel(r.grade || c?.grade, r.section ?? c?.section) || "Report";
}

export const errorText = async (error: unknown): Promise<string> => {
  const err = error as { message?: string; response?: { json: () => Promise<{ details?: string; error?: string }> }; data?: { details?: string; error?: string } };
  if (err?.response) {
    try {
      const d = await err.response.json();
      return d.details || d.error || err.message || "The report was not saved.";
    } catch {
      return err.message || "The report was not saved.";
    }
  }
  return err?.message || err?.data?.details || err?.data?.error || "The report was not saved.";
};
