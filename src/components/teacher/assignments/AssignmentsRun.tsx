import Droid from "../../portal/Droid";
import { STAGE_LABEL, type Stage } from "./assignments-shared";

const STOPS: Stage[] = ["draft", "live", "past"];

/**
 * Where your assignments are: drafts you have not published, live ones students can still do, and ones past
 * their due date. The droid waits at "Live" (or the stop you filtered to); pressing a stop filters the list.
 */
export default function AssignmentsRun({
  counts,
  selected,
  onSelect,
  caption,
}: {
  counts: Record<Stage, number>;
  selected: Stage | null;
  onSelect: (s: Stage) => void;
  caption: string;
}) {
  const n = STOPS.length;
  const at = Math.max(0, STOPS.indexOf(selected ?? "live"));
  const total = STOPS.reduce((sum, s) => sum + counts[s], 0);
  return (
    <div className="sd-run-card">
      <div className="sd-run to-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Assignments by stage">
          {STOPS.map((s) => (
            <li key={s} className="sd-day" data-active={counts[s] > 0} data-today={selected === s} data-future={counts[s] === 0} data-late={s === "past" && counts[s] > 0}>
              <button
                type="button"
                className="to-node tg-node"
                aria-pressed={selected === s}
                aria-label={`${STAGE_LABEL[s]}: ${counts[s]} ${counts[s] === 1 ? "assignment" : "assignments"}`}
                onClick={() => onSelect(s)}
              >
                <span className="sd-node">{counts[s]}</span>
                <span>{STAGE_LABEL[s]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{total}<small>{total === 1 ? "assignment" : "assignments"}</small></b>
        <span>{caption}</span>
      </div>
    </div>
  );
}
