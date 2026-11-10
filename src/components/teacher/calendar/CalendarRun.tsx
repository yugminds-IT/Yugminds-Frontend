import Droid from "../../portal/Droid";
import { KIND_LABEL, WORKS, type DayInfo } from "./utils";

export type RunDay = { date: string; weekday: string; day: number; info: DayInfo; today: boolean };

/**
 * The next seven days as a track. Amber nodes are days you teach, red ones are closed for a holiday or break,
 * dashed ones are your weekly off. The droid waits at today; pressing a day opens it in the calendar below.
 */
export default function CalendarRun({ days, caption, onPick }: { days: RunDay[]; caption: string; onPick: (date: string) => void }) {
  const n = days.length;
  const at = Math.max(0, days.findIndex((d) => d.today));
  const working = days.filter((d) => WORKS.includes(d.info.kind)).length;
  return (
    <div className="sd-run-card">
      <div className="sd-run to-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="The next seven days">
          {days.map((d) => (
            <li key={d.date} className="sd-day" data-active={WORKS.includes(d.info.kind)} data-today={d.today} data-late={d.info.kind === "closed"} data-future={d.info.kind === "off" || d.info.kind === "unassigned"}>
              <button type="button" className="to-node cd-node" aria-label={`${d.weekday} ${d.day}: ${KIND_LABEL[d.info.kind]}`} onClick={() => onPick(d.date)}>
                <span className="sd-node">{d.day}</span>
                <span>{d.weekday}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{working}<small>{working === 1 ? "teaching day" : "teaching days"} this week</small></b>
        <span>{caption}</span>
      </div>
    </div>
  );
}
