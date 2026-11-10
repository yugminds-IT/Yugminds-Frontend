import Droid from "../../portal/Droid";
import { SPEEDS, SPEED_LABEL, type Speed } from "./utils";

/**
 * The recent requests, sorted by how long they took. Each stop counts the requests in that range.
 * The droid waits at the biggest group, or at the range you filtered to. Pressing a stop filters the request list.
 */
export default function SpeedRun({
  counts,
  selected,
  onSelect,
  caption,
}: {
  counts: Record<Speed, number>;
  selected: Speed | null;
  onSelect: (s: Speed | null) => void;
  caption: React.ReactNode;
}) {
  const n = SPEEDS.length;
  const total = SPEEDS.reduce((sum, s) => sum + counts[s], 0);
  const biggest = SPEEDS.reduce((best, s, i) => (counts[s] > counts[SPEEDS[best]] ? i : best), 0);
  const at = selected ? SPEEDS.indexOf(selected) : biggest;
  return (
    <div className="sd-run-card">
      <div className="sd-run tm-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Recent requests by how long they took">
          {SPEEDS.map((s) => (
            <li key={s} className="sd-day" data-active={(s === "fast" || s === "normal") && counts[s] > 0} data-late={(s === "slow" || s === "crawl") && counts[s] > 0} data-today={selected === s} data-future={counts[s] === 0}>
              <button type="button" className="tm-node" aria-pressed={selected === s} aria-label={`${SPEED_LABEL[s]}: ${counts[s]} ${counts[s] === 1 ? "request" : "requests"}`} onClick={() => onSelect(selected === s ? null : s)}>
                <span className="sd-node">{counts[s]}</span>
                <span>{SPEED_LABEL[s]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{total}<small>recent {total === 1 ? "request" : "requests"}</small></b>
        {selected ? <button type="button" className="sm-reset" onClick={() => onSelect(null)}>Show every request</button> : <span>{caption}</span>}
      </div>
    </div>
  );
}
