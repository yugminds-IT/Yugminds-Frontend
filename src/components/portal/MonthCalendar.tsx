"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface ActivityDay {
  date: string // YYYY-MM-DD
  hasLearning?: boolean
  hasAssignment?: boolean
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Month grid: amber days had a lesson completed, ink days finished a whole chapter. */
export default function MonthCalendar({
  days,
  stats,
  legend = { amber: 'Lesson completed', ink: 'Chapter finished' },
  aria = { amber: 'lesson completed', ink: 'chapter finished' },
}: {
  days: ActivityDay[]
  stats: Array<{ label: string; value: number }>
  legend?: { amber: string; ink: string }
  aria?: { amber: string; ink: string }
}) {
  const [now] = useState(() => new Date());
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const byKey = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  const first = new Date(ym.y, ym.m, 1);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(ym.y, ym.m + 1, 0).getDate();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const isCurrent = ym.y === now.getFullYear() && ym.m === now.getMonth();
  const step = (by: number) => setYm(({ y, m }) => { const d = new Date(y, m + by, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  return (
    <section className="sd-panel" aria-labelledby="mc-cal-h">
      <div className="sd-panel-head" style={{ marginBottom: "0.75rem" }}>
        <h2 id="mc-cal-h">{first.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h2>
        <div className="mc-cal-nav">
          <button onClick={() => step(-1)} aria-label="Previous month"><ChevronLeft /></button>
          <button onClick={() => step(1)} disabled={isCurrent} aria-label="Next month"><ChevronRight /></button>
        </div>
      </div>
      <div className="mc-cal-dow" aria-hidden="true">{DOW.map((d) => <span key={d}>{d[0]}</span>)}</div>
      <div className="mc-cal-grid">
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: count }, (_, i) => {
          const day = i + 1;
          const key = `${ym.y}-${String(ym.m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const a = byKey.get(key);
          const on = !!a && !!(a.hasLearning || a.hasAssignment);
          return (
            <i key={key} data-on={on && !a?.hasAssignment} data-done={!!a?.hasAssignment} data-today={key === todayKey}
              aria-label={on ? `${day} ${first.toLocaleDateString("en-IN", { month: "long" })}, ${a?.hasAssignment ? aria.ink : aria.amber}` : undefined}>
              {day}
            </i>
          );
        })}
      </div>
      <p className="mc-key"><span><i /> {legend.amber}</span><span><i data-k="done" /> {legend.ink}</span></p>
      <div className="mc-tally">
        {stats.map((s) => <div key={s.label}><b>{s.value}</b><span>{s.label}</span></div>)}
      </div>
    </section>
  );
}
