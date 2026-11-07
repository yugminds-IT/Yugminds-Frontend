import { Check, Flame } from "lucide-react";
import Droid from "../portal/Droid";

export interface WeekDay {
  label: string;
  active: boolean;
  today: boolean;
  future: boolean;
}

/** The week as a track of seven days. The droid rolls to today's node when the page loads. */
export default function WeekRun({
  days,
  count,
  goal,
  streak,
}: {
  days: WeekDay[];
  count: number;
  goal: number;
  streak: number;
}) {
  const todayIdx = Math.max(0, days.findIndex((d) => d.today));
  const lastActive = days.reduce((acc, d, i) => (d.active ? i : acc), -1);
  const met = count >= goal;
  return (
    <div className="sd-run-card">
      <div className="sd-run" style={{ "--p": (todayIdx + 0.5) / 7, "--spin": `${(todayIdx + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        {lastActive >= 0 && <div className="sd-run-fill" style={{ "--f": lastActive / 6 } as React.CSSProperties} />}
        <ol className="sd-days" aria-label="Days you learned this week">
          {days.map((d, i) => (
            <li key={i} className="sd-day" data-active={d.active} data-today={d.today} data-future={d.future}>
              <span className="sd-node">{d.active && <Check />}</span>
              <span>{d.label}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>
          {Math.min(count, goal)} of {goal}
          <small>{met ? "Weekly goal met" : "days this week"}</small>
        </b>
        {streak > 0 ? (
          <em><Flame aria-hidden="true" />{streak}-day streak</em>
        ) : (
          <span>{count === 0 ? "Learn today to start a streak" : "Keep going"}</span>
        )}
      </div>
    </div>
  );
}
