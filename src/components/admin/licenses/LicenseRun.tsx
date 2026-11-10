import Droid from "../../portal/Droid";
import { STAGES, STAGE_LABEL, type Stage } from "./utils";

/**
 * The life of a license: active, running out soon, expired, or deactivated.
 * The droid waits at the first stop that needs attention (expired, then renew soon), or at the one you filtered to.
 * Pressing a stop filters the list; pressing it again clears the filter.
 */
export default function LicenseRun({
  counts,
  selected,
  onSelect,
  caption,
}: {
  counts: Record<Stage, number>;
  selected: Stage | null;
  onSelect: (s: Stage | null) => void;
  caption: React.ReactNode;
}) {
  const n = STAGES.length;
  const total = STAGES.reduce((sum, s) => sum + counts[s], 0);
  const firstTodo = counts.expired > 0 ? 2 : counts.soon > 0 ? 1 : 0;
  const at = selected ? STAGES.indexOf(selected) : firstTodo;
  return (
    <div className="sd-run-card">
      <div className="sd-run tm-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Licenses by state">
          {STAGES.map((s) => (
            <li key={s} className="sd-day" data-active={s === "active" && counts[s] > 0} data-late={(s === "soon" || s === "expired") && counts[s] > 0} data-today={selected === s} data-future={counts[s] === 0 || s === "off"}>
              <button type="button" className="tm-node" aria-pressed={selected === s} aria-label={`${STAGE_LABEL[s]}: ${counts[s]} ${counts[s] === 1 ? "license" : "licenses"}`} onClick={() => onSelect(selected === s ? null : s)}>
                <span className="sd-node">{counts[s]}</span>
                <span>{STAGE_LABEL[s]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{total}<small>{total === 1 ? "license" : "licenses"}</small></b>
        {selected ? <button type="button" className="sm-reset" onClick={() => onSelect(null)}>Show every license</button> : <span>{caption}</span>}
      </div>
    </div>
  );
}
