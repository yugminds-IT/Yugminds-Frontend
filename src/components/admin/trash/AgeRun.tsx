import Droid from "../../portal/Droid";
import { AGES, AGE_LABEL, type Age } from "./utils";

/**
 * When the items in this list were deleted: today, this week, this month, or longer ago.
 * The droid waits at the most recent stop that has anything in it, or at the stop you filtered to.
 * Pressing a stop filters the list; pressing it again clears the filter.
 */
export default function AgeRun({
  counts,
  selected,
  onSelect,
  caption,
  noun,
}: {
  counts: Record<Age, number>;
  selected: Age | null;
  onSelect: (a: Age | null) => void;
  caption: React.ReactNode;
  noun: string;
}) {
  const n = AGES.length;
  const total = AGES.reduce((sum, a) => sum + counts[a], 0);
  const firstFull = Math.max(0, AGES.findIndex((a) => counts[a] > 0));
  const at = selected ? AGES.indexOf(selected) : firstFull;
  return (
    <div className="sd-run-card">
      <div className="sd-run tm-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label={`Deleted ${noun} by when they were deleted`}>
          {AGES.map((a) => (
            <li key={a} className="sd-day" data-active={a !== "older" && counts[a] > 0} data-late={a === "older" && counts[a] > 0} data-today={selected === a} data-future={counts[a] === 0}>
              <button type="button" className="tm-node" aria-pressed={selected === a} aria-label={`Deleted ${AGE_LABEL[a].toLowerCase()}: ${counts[a]}`} onClick={() => onSelect(selected === a ? null : a)}>
                <span className="sd-node">{counts[a]}</span>
                <span>{AGE_LABEL[a]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{total}<small>in the trash</small></b>
        {selected ? <button type="button" className="sm-reset" onClick={() => onSelect(null)}>Show everything</button> : <span>{caption}</span>}
      </div>
    </div>
  );
}
