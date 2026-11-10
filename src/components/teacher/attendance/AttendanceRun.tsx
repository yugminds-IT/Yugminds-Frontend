import Droid from "../../portal/Droid";
import { monthName, rateWord, type Month } from "./utils";

/**
 * The last six months as a track. Each node is a month with its attendance rate; the droid waits at the month
 * you are looking at, and pressing a node switches the page to that month.
 */
export default function AttendanceRun({
  keys,
  data,
  selected,
  onSelect,
}: {
  keys: string[];
  data: Map<string, Month>;
  selected: string;
  onSelect: (key: string) => void;
}) {
  const n = keys.length;
  const at = Math.max(0, keys.indexOf(selected));
  const cur = data.get(selected);
  const lastLogged = keys.reduce((acc, k, i) => (data.has(k) ? i : acc), -1);
  return (
    <div className="sd-run-card">
      <div className="sd-run to-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        {lastLogged >= 0 && n > 1 && <div className="sd-run-fill" style={{ "--f": lastLogged / (n - 1) } as React.CSSProperties} />}
        <ol className="sd-days" aria-label="Attendance by month">
          {keys.map((k) => {
            const m = data.get(k);
            return (
              <li key={k} className="sd-day" data-active={!!m} data-today={k === selected} data-future={!m} data-late={!!m && m.pct < 50}>
                <button
                  type="button"
                  className="to-node at-node"
                  aria-pressed={k === selected}
                  aria-label={`${monthName(k)}: ${m ? `${m.pct}% present` : "no attendance logged"}`}
                  onClick={() => onSelect(k)}
                >
                  <span className="sd-node">{m ? m.pct : "–"}</span>
                  <span>{monthName(k, false)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{cur ? `${cur.pct}%` : "–"}<small>present in {monthName(selected)}</small></b>
        <span>{cur ? `${cur.present} of ${cur.total} working days. ${rateWord(cur.pct)}` : "Nothing logged yet"}</span>
      </div>
    </div>
  );
}
