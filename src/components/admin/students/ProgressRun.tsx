import Droid from "../../portal/Droid";
import { BAND_LABEL, BAND_ORDER, type Band } from "./utils";

/**
 * How far students are through their courses, as a track: not started, under way, past halfway, finished.
 * The droid waits at the biggest group, or at the one you filtered to. Pressing a stop filters the list.
 */
export default function ProgressRun({
  counts,
  selected,
  onSelect,
  average,
}: {
  counts: Record<Band, number>;
  selected: Band | null;
  onSelect: (b: Band | null) => void;
  /** average course progress over all students, from the progress report */
  average: number | null;
}) {
  const n = BAND_ORDER.length;
  const biggest = BAND_ORDER.reduce((best, b, i) => (counts[b] > counts[BAND_ORDER[best]] ? i : best), 0);
  const at = selected ? BAND_ORDER.indexOf(selected) : biggest;
  return (
    <div className="sd-run-card">
      <div className="sd-run tm-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Students by course progress">
          {BAND_ORDER.map((b) => (
            <li key={b} className="sd-day" data-active={counts[b] > 0 && b !== "new"} data-late={b === "new" && counts[b] > 0} data-today={selected === b} data-future={counts[b] === 0}>
              <button type="button" className="tm-node" aria-pressed={selected === b} aria-label={`${BAND_LABEL[b]}: ${counts[b]} ${counts[b] === 1 ? "student" : "students"}`} onClick={() => onSelect(selected === b ? null : b)}>
                <span className="sd-node">{counts[b]}</span>
                <span>{BAND_LABEL[b]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{average == null ? "–" : `${Math.round(average)}%`}<small>average progress</small></b>
        {selected ? <button type="button" className="sm-reset" onClick={() => onSelect(null)}>Show all students</button> : <span>Pick a stop to filter</span>}
      </div>
    </div>
  );
}
