import { ColumnChart, SegmentBar, type Part } from "../../teacher/analytics/Charts";
import { levelOf } from "./PerformanceTab";
import { plural, type ReportTrend, type SubjectDistribution, type TeacherPerformance } from "./types";
import "../../teacher/analytics/analytics.css"; // charts

const TONES: Part["tone"][] = ["ink", "amber", "blue", "red", "soft"];

/** The last four weeks, what is being taught, and how many teachers are reporting steadily. */
export default function TrendsTab({
  trends,
  subjects,
  performance,
}: {
  trends: ReportTrend[];
  subjects: SubjectDistribution[];
  performance: TeacherPerformance[];
}) {
  const hasTrend = trends.some((t) => t.reports > 0);
  const maxReports = Math.max(1, ...trends.map((t) => t.reports));
  const maxHours = Math.max(1, ...trends.map((t) => t.hours));
  // top five subjects get their own colour; the rest are lumped together so the bar stays readable
  const top = subjects.slice(0, 5);
  const restCount = subjects.slice(5).reduce((n, s) => n + s.count, 0);
  const parts: Part[] = [...top.map((s, i) => ({ label: s.name, value: s.count, tone: TONES[i] })), ...(restCount > 0 ? [{ label: "Everything else", value: restCount, tone: "line" as const }] : [])];
  const count = (l: "great" | "good" | "low") => performance.filter((p) => levelOf(p.attendance_rate) === l).length;

  return (
    <div className="so-grid">
      <div className="so-col">
        <section className="sd-panel" aria-labelledby="ar-t1">
          <div className="sd-panel-head"><div><h2 id="ar-t1">Reports per week</h2><p>The last four weeks, for the reports in this view.</p></div></div>
          {hasTrend ? <ColumnChart cols={trends.map((t) => ({ key: t.name, label: t.name, value: t.reports, text: plural(t.reports, "report") }))} max={maxReports} label="Reports per week" /> : <p className="ta-empty">No reports in the last four weeks.</p>}
        </section>
        <section className="sd-panel" aria-labelledby="ar-t2">
          <div className="sd-panel-head"><div><h2 id="ar-t2">Teaching hours per week</h2><p>Hours teachers wrote down in those reports.</p></div></div>
          {hasTrend ? <ColumnChart cols={trends.map((t) => ({ key: t.name, label: t.name, value: t.hours, text: `${t.hours} hours` }))} max={maxHours} label="Teaching hours per week" /> : <p className="ta-empty">No hours recorded in the last four weeks.</p>}
        </section>
      </div>
      <div className="so-col">
        <section className="sd-panel" aria-labelledby="ar-t3">
          <div className="sd-panel-head"><div><h2 id="ar-t3">What is being taught</h2><p>Topics grouped by subject, from what teachers wrote.</p></div></div>
          <SegmentBar parts={parts} empty="No topics to group yet." />
        </section>
        <section className="sd-panel" aria-labelledby="ar-t4">
          <div className="sd-panel-head"><div><h2 id="ar-t4">How steadily teachers report</h2><p>Share of the last 20 working days with a report.</p></div></div>
          <SegmentBar
            parts={[
              { label: "Excellent, 90% or more", value: count("great"), tone: "ink" },
              { label: "Good, 70 to 89%", value: count("good"), tone: "amber" },
              { label: "Needs attention, under 70%", value: count("low"), tone: "red" },
            ]}
            unit=""
            empty="No teachers in this view yet."
          />
        </section>
      </div>
    </div>
  );
}
