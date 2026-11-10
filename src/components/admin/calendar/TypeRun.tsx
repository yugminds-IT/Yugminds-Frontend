import Droid from "../../portal/Droid";
import { TYPES, TYPE_LABEL, type EntryType } from "./utils";

/**
 * What the month holds, by kind: holidays, breaks, half days and make-up days.
 * The droid waits at the stop you picked, or at the first kind that has something this month.
 * Pressing a stop highlights those days; pressing it again clears it.
 */
export default function TypeRun({
  counts,
  selected,
  onSelect,
  caption,
}: {
  counts: Record<EntryType, number>;
  selected: EntryType | null;
  onSelect: (t: EntryType | null) => void;
  caption: React.ReactNode;
}) {
  const n = TYPES.length;
  const total = TYPES.reduce((sum, t) => sum + counts[t], 0);
  const firstWith = Math.max(0, TYPES.findIndex((t) => counts[t] > 0));
  const at = selected ? TYPES.indexOf(selected) : firstWith;
  return (
    <div className="sd-run-card">
      <div className="sd-run tm-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Calendar entries this month, by kind">
          {TYPES.map((t) => (
            <li key={t} className="sd-day" data-active={counts[t] > 0 && t !== "Holiday" && t !== "Break"} data-late={counts[t] > 0 && (t === "Holiday" || t === "Break")} data-today={selected === t} data-future={counts[t] === 0}>
              <button type="button" className="tm-node" aria-pressed={selected === t} aria-label={`${TYPE_LABEL[t]}: ${counts[t]}`} onClick={() => onSelect(selected === t ? null : t)}>
                <span className="sd-node">{counts[t]}</span>
                <span>{TYPE_LABEL[t]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{total}<small>{total === 1 ? "entry" : "entries"}</small></b>
        {selected ? <button type="button" className="sm-reset" onClick={() => onSelect(null)}>Show every kind</button> : <span>{caption}</span>}
      </div>
    </div>
  );
}
