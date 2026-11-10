import Droid from "../../portal/Droid";
import { BANDS, BAND_LABEL, type Band } from "./types";

/**
 * Schools on a track from "no work yet" to "75% and up", by their average assignment score, with a count at each stop.
 * The droid waits at the biggest group, or at the band you filtered to. Pressing a stop filters the list.
 */
export default function SchoolRun({
  counts,
  selected,
  onSelect,
  average,
}: {
  counts: Record<Band, number>;
  selected: Band | "all";
  onSelect: (b: Band | "all") => void;
  /** average of the schools that have handed work in, or null when none have */
  average: number | null;
}) {
  const biggest = BANDS.reduce((best, b, i) => (counts[b] > counts[BANDS[best]] ? i : best), 0);
  const sel = BANDS.indexOf(selected as Band);
  const at = sel >= 0 ? sel : biggest;
  const n = BANDS.length;
  return (
    <div className="sd-run-card">
      <div className="sd-run aa-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Schools by average assignment score">
          {BANDS.map((b) => (
            <li key={b} className="sd-day" data-active={counts[b] > 0} data-today={selected === b} data-future={counts[b] === 0}>
              <button type="button" className="aa-node" aria-pressed={selected === b} aria-label={`${BAND_LABEL[b]}: ${counts[b]} ${counts[b] === 1 ? "school" : "schools"}`} onClick={() => onSelect(selected === b ? "all" : b)}>
                <span className="sd-node">{counts[b]}</span>
                <span>{BAND_LABEL[b]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{average == null ? "–" : `${Math.round(average)}%`}<small>average across schools</small></b>
        {selected !== "all" ? <button type="button" className="sm-reset" onClick={() => onSelect("all")}>Show every school</button> : <span>Pick a score range to filter</span>}
      </div>
    </div>
  );
}
