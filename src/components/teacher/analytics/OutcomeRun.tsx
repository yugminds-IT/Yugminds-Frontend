import Link from "next/link";
import Droid from "../../portal/Droid";

export type Outcomes = { pending: number; reviewed: number; approved: number; rejected: number };
const STOPS: { id: keyof Outcomes; label: string }[] = [
  { id: "pending", label: "Waiting" },
  { id: "reviewed", label: "Reviewed" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

/**
 * Where your reports ended up: waiting for review, reviewed, approved or rejected. The droid waits at "Waiting"
 * while anything is undecided, otherwise at "Approved".
 */
export default function OutcomeRun({ counts, caption }: { counts: Outcomes; caption: string }) {
  const n = STOPS.length;
  const at = counts.pending > 0 ? 0 : 2;
  const total = counts.pending + counts.reviewed + counts.approved + counts.rejected;
  return (
    <div className="sd-run-card">
      <div className="sd-run to-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Your reports by review outcome">
          {STOPS.map((s) => (
            <li key={s.id} className="sd-day" data-active={counts[s.id] > 0} data-future={counts[s.id] === 0} data-late={s.id === "rejected" && counts[s.id] > 0}>
              <span className="ta-stop" aria-label={`${s.label}: ${counts[s.id]} ${counts[s.id] === 1 ? "report" : "reports"}`}>
                <span className="sd-node">{counts[s.id]}</span>
                <span>{s.label}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{total}<small>{total === 1 ? "report in all" : "reports in all"}</small></b>
        <span>{caption} <Link href="/lms/teacher/reports" className="ta-link">Reports</Link></span>
      </div>
    </div>
  );
}
