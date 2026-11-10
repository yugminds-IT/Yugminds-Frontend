import Droid from "../../portal/Droid";
import { STAGE_LABEL, type Stage } from "./utils";

const STOPS: Stage[] = ["ready", "setup", "off"];

/**
 * Where the schools are: ready for students, still missing a school admin or joining codes, or switched off.
 * The droid waits at the stop with the most schools, or at the one you filtered to. Pressing a stop filters.
 */
export default function SchoolRun({
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
  const biggest = STOPS.reduce((best, s, i) => (counts[s] > counts[STOPS[best]] ? i : best), 0);
  const at = selected ? STOPS.indexOf(selected) : biggest;
  const total = STOPS.reduce((sum, s) => sum + counts[s], 0);
  return (
    <div className="sd-run-card">
      <div className="sd-run to-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Schools by stage">
          {STOPS.map((s) => (
            <li key={s} className="sd-day" data-active={counts[s] > 0} data-today={selected === s} data-future={counts[s] === 0} data-late={s === "setup" && counts[s] > 0}>
              <button type="button" className="to-node sc-node" aria-pressed={selected === s} aria-label={`${STAGE_LABEL[s]}: ${counts[s]} ${counts[s] === 1 ? "school" : "schools"}`} onClick={() => onSelect(s)}>
                <span className="sd-node">{counts[s]}</span>
                <span>{STAGE_LABEL[s]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{total}<small>{total === 1 ? "school" : "schools"}</small></b>
        <span>{caption}</span>
      </div>
    </div>
  );
}
