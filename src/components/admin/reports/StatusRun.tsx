import Droid from "../../portal/Droid";
import { STATUS_LABEL, STATUS_ORDER, type ReportStatus } from "./types";

/**
 * Where every report stands: pending, reviewed, approved or rejected.
 * The droid waits at the first stop with reports still to look at, or at the one you filtered to.
 * Pressing a stop filters the list; pressing it again clears the filter.
 */
export default function StatusRun({
  counts,
  selected,
  onSelect,
  caption,
}: {
  counts: Record<ReportStatus, number>;
  selected: ReportStatus | null;
  onSelect: (s: ReportStatus | null) => void;
  caption: React.ReactNode;
}) {
  const n = STATUS_ORDER.length;
  const total = STATUS_ORDER.reduce((sum, s) => sum + counts[s], 0);
  const firstTodo = counts.submitted > 0 ? 0 : counts.reviewed > 0 ? 1 : 2;
  const at = selected ? STATUS_ORDER.indexOf(selected) : firstTodo;
  return (
    <div className="sd-run-card">
      <div className="sd-run tm-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Reports by review status">
          {STATUS_ORDER.map((s) => (
            <li key={s} className="sd-day" data-active={(s === "approved") && counts[s] > 0} data-late={(s === "submitted" || s === "reviewed") && counts[s] > 0} data-today={selected === s} data-future={counts[s] === 0 || s === "rejected"}>
              <button type="button" className="tm-node" aria-pressed={selected === s} aria-label={`${STATUS_LABEL[s]}: ${counts[s]} ${counts[s] === 1 ? "report" : "reports"}`} onClick={() => onSelect(selected === s ? null : s)}>
                <span className="sd-node">{counts[s]}</span>
                <span>{STATUS_LABEL[s]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{total}<small>{total === 1 ? "report" : "reports"}</small></b>
        {selected ? <button type="button" className="sm-reset" onClick={() => onSelect(null)}>Show every status</button> : <span>{caption}</span>}
      </div>
    </div>
  );
}
