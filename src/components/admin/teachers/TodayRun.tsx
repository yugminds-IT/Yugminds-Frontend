import Droid from "../../portal/Droid";
import { TODAY_KEYS, TODAY_LABEL, type TodayKey } from "./utils";

/**
 * Where every teacher is today: present, on leave, not marked yet, or a day off.
 * The droid waits at the stop with the most teachers, or at the one you filtered to.
 * Pressing a stop filters the teacher list; pressing it again clears the filter.
 */
export default function TodayRun({
  counts,
  selected,
  onSelect,
  caption,
}: {
  counts: Record<TodayKey, number>;
  selected: TodayKey | null;
  onSelect: (k: TodayKey | null) => void;
  caption: React.ReactNode;
}) {
  const n = TODAY_KEYS.length;
  const total = TODAY_KEYS.reduce((sum, k) => sum + counts[k], 0);
  const biggest = TODAY_KEYS.reduce((best, k, i) => (counts[k] > counts[TODAY_KEYS[best]] ? i : best), 0);
  const at = selected ? TODAY_KEYS.indexOf(selected) : biggest;
  return (
    <div className="sd-run-card">
      <div className="sd-run tm-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Teachers by today's attendance">
          {TODAY_KEYS.map((k) => (
            <li key={k} className="sd-day" data-active={counts[k] > 0 && k !== "absent"} data-late={k === "absent" && counts[k] > 0} data-today={selected === k} data-future={counts[k] === 0}>
              <button type="button" className="tm-node" aria-pressed={selected === k} aria-label={`${TODAY_LABEL[k]}: ${counts[k]} ${counts[k] === 1 ? "teacher" : "teachers"}`} onClick={() => onSelect(selected === k ? null : k)}>
                <span className="sd-node">{counts[k]}</span>
                <span>{TODAY_LABEL[k]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{total}<small>{total === 1 ? "teacher" : "teachers"}</small></b>
        {selected ? <button type="button" className="sm-reset" onClick={() => onSelect(null)}>Show all teachers</button> : <span>{caption}</span>}
      </div>
    </div>
  );
}
