import Droid from "../../portal/Droid";

export type GrowthKey = "schools" | "teachers" | "students" | "courses";
export const GROWTH_LABEL: Record<GrowthKey, string> = { schools: "Schools", teachers: "Teachers", students: "Students", courses: "Courses" };
const KEYS: GrowthKey[] = ["schools", "teachers", "students", "courses"];

/** 1234 becomes "1.2k", so a month's count always fits inside its node. */
const short = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k` : String(n));

/**
 * New sign-ups, month by month, for one kind of thing at a time. Pick schools, teachers, students or courses
 * above the track; the droid waits at the current month. Totals come from the numbers strip, not from here.
 */
export default function GrowthRun({
  months,
  metric,
  onMetric,
  total,
}: {
  months: { name: string; schools: number; teachers: number; students: number; courses: number }[];
  metric: GrowthKey;
  onMetric: (k: GrowthKey) => void;
  total: number;
}) {
  const n = Math.max(1, months.length);
  const at = Math.max(0, months.length - 1);
  const cur = months[months.length - 1]?.[metric] ?? 0;
  return (
    <div className="sd-run-card">
      <div className="ao-metrics" role="group" aria-label="What to show">
        {KEYS.map((k) => (
          <button key={k} type="button" className="ao-metric" aria-pressed={metric === k} onClick={() => onMetric(k)}>{GROWTH_LABEL[k]}</button>
        ))}
      </div>
      {months.length === 0 ? (
        <p className="ao-nogrowth">Monthly numbers appear once there is something to count.</p>
      ) : (
        <div className="sd-run to-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
          <div className="sd-droid"><Droid /></div>
          <div className="sd-run-line" />
          <ol className="sd-days" aria-label={`New ${GROWTH_LABEL[metric].toLowerCase()} each month`}>
            {months.map((m, i) => (
              <li key={`${m.name}-${i}`} className="sd-day" data-active={m[metric] > 0} data-today={i === at} data-future={m[metric] === 0}>
                <span className="ao-stop" aria-label={`${m.name}: ${m[metric]} new ${GROWTH_LABEL[metric].toLowerCase()}`}>
                  <span className="sd-node">{short(m[metric])}</span>
                  <span>{m.name}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="sd-run-foot">
        <b>{total.toLocaleString("en-IN")}<small>{GROWTH_LABEL[metric].toLowerCase()} in all</small></b>
        <span>{cur} new this month</span>
      </div>
    </div>
  );
}
