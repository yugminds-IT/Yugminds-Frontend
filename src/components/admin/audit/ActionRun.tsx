import Droid from "../../portal/Droid";
import { METHODS, TRACK_LABEL, type Method } from "./utils";

/**
 * What kind of change was made: added, changed, replaced or deleted. Each stop counts the entries that match the other filters.
 * The droid waits at the busiest kind, or at the one you filtered to. Pressing a stop filters the log.
 */
export default function ActionRun({
  counts,
  selected,
  onSelect,
  caption,
}: {
  counts: Record<Method, number>;
  selected: Method | null;
  onSelect: (m: Method | null) => void;
  caption: React.ReactNode;
}) {
  const n = METHODS.length;
  const total = METHODS.reduce((sum, m) => sum + counts[m], 0);
  const busiest = METHODS.reduce((best, m, i) => (counts[m] > counts[METHODS[best]] ? i : best), 0);
  const at = selected ? METHODS.indexOf(selected) : busiest;
  return (
    <div className="sd-run-card">
      <div className="sd-run tm-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Changes by kind">
          {METHODS.map((m) => (
            <li key={m} className="sd-day" data-active={m !== "DELETE" && counts[m] > 0} data-late={m === "DELETE" && counts[m] > 0} data-today={selected === m} data-future={counts[m] === 0}>
              <button type="button" className="tm-node" aria-pressed={selected === m} aria-label={`${TRACK_LABEL[m]}: ${counts[m]} ${counts[m] === 1 ? "entry" : "entries"}`} onClick={() => onSelect(selected === m ? null : m)}>
                <span className="sd-node">{counts[m] > 999 ? `${Math.round(counts[m] / 100) / 10}k` : counts[m]}</span>
                <span>{TRACK_LABEL[m]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{total.toLocaleString("en-IN")}<small>{total === 1 ? "change" : "changes"}</small></b>
        {selected ? <button type="button" className="sm-reset" onClick={() => onSelect(null)}>Show every kind</button> : <span>{caption}</span>}
      </div>
    </div>
  );
}
