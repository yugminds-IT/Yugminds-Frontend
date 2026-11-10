import { ago } from "../../portal/notifications";
import { reportClass, isRejected, type ReportRow } from "./utils";

/** Your newest reports with where each one stands. Shared by the report page and the dashboard's Reports tab. */
export default function RecentReports({
  reports,
  now,
  todayStr,
  limit = 8,
}: {
  reports: ReportRow[];
  now: number;
  /** YYYY-MM-DD; a rejected report from today gets a hint to send it again */
  todayStr?: string;
  limit?: number;
}) {
  return (
    <div>
      {reports.slice(0, limit).map((r, i) => {
        const status = r.report_status || "Submitted";
        const again = isRejected(r) && !!todayStr && r.date === todayStr;
        const at = r.created_at ?? r.date;
        return (
          <div key={r.id ?? i} className="so-row">
            <span className="so-row-text">
              <b>{reportClass(r)}</b>
              <small>{again ? "Rejected. Report this class again from today's list." : r.topics_taught?.trim() || "No topics listed"}</small>
            </span>
            <span className="to-chip" data-s={status.toLowerCase()}>{status}</span>
            {at && <time dateTime={at}>{ago(at, now)}</time>}
          </div>
        );
      })}
    </div>
  );
}
