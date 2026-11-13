import { ColumnChart, SegmentBar, type Part } from "../../teacher/analytics/Charts";
import { plural, type Result } from "./utils";
import "../../teacher/analytics/analytics.css"; // charts

const TONES: Part["tone"][] = ["ink", "amber", "blue", "red", "soft"];

/** One bar per item, scaled to the biggest, with the number written out. */
function Rows({ items, empty }: { items: { key: string; name: string; pct: number; text: string }[]; empty: string }) {
  if (items.length === 0) return <p className="ta-empty">{empty}</p>;
  return (
    <ul className="pa-rows">
      {items.map((i) => (
        <li key={i.key}>
          <b>{i.name}</b>
          <span>{i.text}</span>
          <span className="sd-meter" role="img" aria-label={`${i.name}: ${i.text}`}><i style={{ "--p": `${Math.max(2, Math.min(100, i.pct))}%` } as React.CSSProperties} /></span>
        </li>
      ))}
    </ul>
  );
}

/** How the platform is doing right now: teacher attendance, course progress, and how often requests succeed. */
export function HealthTab({ data }: { data: Result }) {
  const { analytics: a, teacherPerformance: t } = data;
  const ok = a.systemHealth;
  const rows = [
    { key: "att", name: "Teachers present", val: a.avgAttendance, note: "Share of working days teachers were present this month. A past working day with no report counts as absent; approved leave is not an absence.", hot: false },
    { key: "prog", name: "Course progress", val: a.completionRate, note: "Average of how far enrolled students are through their courses.", hot: false },
    { key: "req", name: "Requests that worked", val: ok, note: "Share of recent requests that finished without a server error. It starts again when the server restarts, so it is not an uptime figure.", hot: ok < 95 },
  ];
  const parts: Part[] = [
    { label: "Excellent, 90% or more", value: t.excellent ?? 0, tone: "ink" },
    { label: "Good, 75 to 89%", value: t.good ?? 0, tone: "amber" },
    { label: "Average, 50 to 74%", value: t.average ?? 0, tone: "blue" },
    { label: "Needs attention, under 50%", value: t.needsImprovement ?? 0, tone: "red" },
    { label: "No attendance records yet", value: t.noRecords ?? 0, tone: "line" },
  ];
  return (
    <div className="so-grid mc-swap">
      <div className="so-col">
        <section className="sd-panel" aria-labelledby="pa-h1">
          <div className="sd-panel-head"><div><h2 id="pa-h1">Health</h2><p>Three numbers that show whether things are running well.</p></div></div>
          <ul className="ao-stats">
            {rows.map((r) => (
              <li key={r.key}>
                <span><b>{r.name}</b><small>{r.note}</small></span>
                <span className="ao-val" data-hot={r.hot}>{r.val}%</span>
                <span className="sd-meter" data-t={r.hot ? "low" : undefined} role="img" aria-label={`${r.name}: ${r.val}%`}><i style={{ "--p": `${Math.max(2, Math.min(100, r.val))}%` } as React.CSSProperties} /></span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="so-col">
        <section className="sd-panel" aria-labelledby="pa-h2">
          <div className="sd-panel-head"><div><h2 id="pa-h2">Teacher attendance</h2><p>Each active teacher, by how much of their working days this month they were present. Teachers with no records are shown apart.</p></div></div>
          <SegmentBar parts={parts} unit="" empty="No active teachers yet." />
        </section>
      </div>
    </div>
  );
}

/** What kinds of schools there are, and which ones have the most students. */
export function SchoolsTab({ data }: { data: Result }) {
  const dist = data.schoolDistribution;
  const top = dist.slice(0, 5);
  const rest = dist.slice(5).reduce((n, d) => n + d.value, 0);
  const parts: Part[] = [...top.map((d, i) => ({ label: d.name, value: d.value, tone: TONES[i] })), ...(rest > 0 ? [{ label: "Other types", value: rest, tone: "line" as const }] : [])];
  return (
    <div className="so-grid mc-swap">
      <div className="so-col">
        <section className="sd-panel" aria-labelledby="pa-s1">
          <div className="sd-panel-head"><div><h2 id="pa-s1">Schools by type</h2><p>Active schools, grouped by the type set on each school.</p></div></div>
          <SegmentBar parts={parts} unit="" empty="No schools yet." />
        </section>
      </div>
      <div className="so-col">
        <section className="sd-panel" aria-labelledby="pa-s2">
          <div className="sd-panel-head"><div><h2 id="pa-s2">Largest schools</h2><p>The five schools with the most students. The longest bar is the largest school.</p></div></div>
          <Rows items={data.topSchools.map((s, i) => ({ key: `${s.name}-${i}`, name: s.name, pct: s.engagement, text: s.engagement === 100 ? "Largest" : `${s.engagement}% of the largest` }))} empty="No students are placed in a school yet." />
        </section>
      </div>
    </div>
  );
}

/** Which courses students are taking, and how enrollment and completion moved over the last six months. */
export function CoursesTab({ data }: { data: Result }) {
  const max = Math.max(1, ...data.popularCourses.map((c) => c.students));
  const months = data.courseEngagement;
  const has = months.some((m) => m.engagement > 0 || m.completion > 0);
  return (
    <div className="so-grid mc-swap">
      <div className="so-col">
        <section className="sd-panel" aria-labelledby="pa-c1">
          <div className="sd-panel-head"><div><h2 id="pa-c1">Most popular courses</h2><p>Courses with the most students enrolled.</p></div></div>
          <Rows items={data.popularCourses.map((c, i) => ({ key: `${c.name}-${i}`, name: c.name, pct: (c.students / max) * 100, text: plural(c.students, "student") }))} empty="No one is enrolled in a course yet." />
        </section>
      </div>
      <div className="so-col">
        <section className="sd-panel" aria-labelledby="pa-c2">
          <div className="sd-panel-head"><div><h2 id="pa-c2">New enrollments</h2><p>Each month, enrollments as a share of all students.</p></div></div>
          {has ? <ColumnChart cols={months.map((m) => ({ key: m.name, label: m.name, value: m.engagement, text: `${m.engagement}% of students enrolled` }))} max={100} label="Enrollments by month" /> : <p className="ta-empty">No enrollments in the last six months.</p>}
        </section>
        <section className="sd-panel" aria-labelledby="pa-c3">
          <div className="sd-panel-head"><div><h2 id="pa-c3">Courses finished</h2><p>Each month, completions as a share of that month&apos;s enrollments.</p></div></div>
          {has ? <ColumnChart cols={months.map((m) => ({ key: m.name, label: m.name, value: m.completion, text: `${m.completion}% finished` }))} max={100} label="Completions by month" /> : <p className="ta-empty">No completions in the last six months.</p>}
        </section>
      </div>
    </div>
  );
}
