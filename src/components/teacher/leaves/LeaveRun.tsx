import Droid from "../../portal/Droid";
import { STATUS_LABEL, type LeaveStatus } from "./utils";

const STOPS: LeaveStatus[] = ["pending", "approved", "rejected", "cancelled"];

/**
 * Where your requests stand: waiting, approved, rejected, cancelled. The droid waits at "Waiting" while anything is
 * undecided, otherwise at "Approved". Pressing a stop filters the list below to it.
 */
export default function LeaveRun({
  counts,
  selected,
  onSelect,
  caption,
}: {
  counts: Record<LeaveStatus, number>;
  selected: LeaveStatus | null;
  onSelect: (s: LeaveStatus) => void;
  caption: string;
}) {
  const n = STOPS.length;
  const at = Math.max(0, STOPS.indexOf(selected ?? (counts.pending > 0 ? "pending" : "approved")));
  const total = STOPS.reduce((sum, s) => sum + counts[s], 0);
  return (
    <div className="sd-run-card">
      <div className="sd-run to-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Requests by status">
          {STOPS.map((s) => (
            <li key={s} className="sd-day" data-active={counts[s] > 0} data-today={selected === s} data-future={counts[s] === 0} data-late={s === "rejected" && counts[s] > 0}>
              <button
                type="button"
                className="to-node lv-node"
                aria-pressed={selected === s}
                aria-label={`${STATUS_LABEL[s]}: ${counts[s]} ${counts[s] === 1 ? "request" : "requests"}`}
                onClick={() => onSelect(s)}
              >
                <span className="sd-node">{counts[s]}</span>
                <span>{STATUS_LABEL[s]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{total}<small>{total === 1 ? "request in all" : "requests in all"}</small></b>
        <span>{caption}</span>
      </div>
    </div>
  );
}
