import Droid from "../../portal/Droid";
import { STAGES, STAGE_LABEL, type Stage } from "./utils";

/**
 * A course's road to students, as a track: needs content, ready to publish, live.
 * The droid waits at the first stop that still has courses to move along, or at the one you filtered to.
 * Pressing a stop filters the list; pressing it again clears the filter.
 */
export default function StageRun({
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
  const firstTodo = counts.empty > 0 ? 0 : counts.ready > 0 ? 1 : 2;
  const at = selected ? STAGES.indexOf(selected) : firstTodo;
  return (
    <div className="sd-run-card">
      <div className="sd-run tm-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Courses by how far they are from students">
          {STAGES.map((s) => (
            <li key={s} className="sd-day" data-active={s === "live" && counts[s] > 0} data-late={s !== "live" && counts[s] > 0} data-today={selected === s} data-future={counts[s] === 0}>
              <button type="button" className="tm-node" aria-pressed={selected === s} aria-label={`${STAGE_LABEL[s]}: ${counts[s]} ${counts[s] === 1 ? "course" : "courses"}`} onClick={() => onSelect(selected === s ? null : s)}>
                <span className="sd-node">{counts[s]}</span>
                <span>{STAGE_LABEL[s]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{total}<small>{total === 1 ? "course" : "courses"}</small></b>
        {selected ? <button type="button" className="sm-reset" onClick={() => onSelect(null)}>Show all courses</button> : <span>{caption}</span>}
      </div>
    </div>
  );
}
