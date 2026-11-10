import Droid from "../../portal/Droid";
import { STAGES, STAGE_LABEL, type Stage } from "./utils";

/**
 * Students in the order they move through learning: no course yet, enrolled but not started, in progress, finished.
 * The droid waits where most students are, or at the stop you filtered to.
 * Pressing a stop filters the list; pressing it again clears the filter.
 */
export default function ProgressRun({
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
  const busiest = STAGES.reduce((best, s, i) => (counts[s] > counts[STAGES[best]] ? i : best), 0);
  const at = selected ? STAGES.indexOf(selected) : busiest;
  return (
    <div className="sd-run-card">
      <div className="sd-run tm-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Students by learning stage">
          {STAGES.map((s) => (
            <li key={s} className="sd-day" data-active={s === "done" && counts[s] > 0} data-late={s === "none" && counts[s] > 0} data-today={selected === s} data-future={counts[s] === 0}>
              <button type="button" className="tm-node" aria-pressed={selected === s} aria-label={`${STAGE_LABEL[s]}: ${counts[s]} ${counts[s] === 1 ? "student" : "students"}`} onClick={() => onSelect(selected === s ? null : s)}>
                <span className="sd-node">{counts[s]}</span>
                <span>{STAGE_LABEL[s]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{total}<small>{total === 1 ? "student" : "students"}</small></b>
        {selected ? <button type="button" className="sm-reset" onClick={() => onSelect(null)}>Show all students</button> : <span>{caption}</span>}
      </div>
    </div>
  );
}
