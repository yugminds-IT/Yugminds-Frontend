import Droid from "../../portal/Droid";
import { STATE_LABEL, STATE_ORDER, type CodeState } from "./utils";

/**
 * Whether a school's codes still let people in: working, used up, expired or switched off.
 * The droid waits at the first stop that has a code to look at, or at the one you filtered to.
 * Pressing a stop filters the list; pressing it again clears the filter.
 */
export default function CodeRun({
  counts,
  selected,
  onSelect,
  caption,
}: {
  counts: Record<CodeState, number>;
  selected: CodeState | null;
  onSelect: (s: CodeState | null) => void;
  caption: React.ReactNode;
}) {
  const n = STATE_ORDER.length;
  const total = STATE_ORDER.reduce((sum, s) => sum + counts[s], 0);
  const first = Math.max(0, STATE_ORDER.findIndex((s) => counts[s] > 0));
  const at = selected ? STATE_ORDER.indexOf(selected) : first;
  return (
    <div className="sd-run-card">
      <div className="sd-run tm-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Joining codes by state">
          {STATE_ORDER.map((s) => (
            <li key={s} className="sd-day" data-active={s === "active" && counts[s] > 0} data-late={(s === "full" || s === "expired") && counts[s] > 0} data-today={selected === s} data-future={counts[s] === 0 || s === "off"}>
              <button type="button" className="tm-node" aria-pressed={selected === s} aria-label={`${STATE_LABEL[s]}: ${counts[s]} ${counts[s] === 1 ? "code" : "codes"}`} onClick={() => onSelect(selected === s ? null : s)}>
                <span className="sd-node">{counts[s]}</span>
                <span>{STATE_LABEL[s]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{total}<small>{total === 1 ? "code" : "codes"}</small></b>
        {selected ? <button type="button" className="sm-reset" onClick={() => onSelect(null)}>Show every code</button> : <span>{caption}</span>}
      </div>
    </div>
  );
}
