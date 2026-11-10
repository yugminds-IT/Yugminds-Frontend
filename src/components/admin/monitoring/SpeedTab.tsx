import { ColumnChart, SegmentBar, type Part } from "../../teacher/analytics/Charts";
import { kindOf, type ApiMetrics, type Request } from "./utils";
import "../../teacher/analytics/analytics.css"; // charts

const clock = new Intl.DateTimeFormat("en-IN", { minute: "2-digit", second: "2-digit" });

/** How fast the server answers: the last 30 requests one by one, the usual and the worst-case times, and the mix of results. */
export default function SpeedTab({ metrics, recent }: { metrics: ApiMetrics; recent: Request[] }) {
  const last = recent.slice(-30);
  const max = Math.max(1, ...last.map((r) => r.duration));
  const durations = recent.map((r) => r.duration);
  const fastest = durations.length ? Math.min(...durations) : null;
  const slowest = durations.length ? Math.max(...durations) : null;
  const mix: Part[] = [
    { label: "Worked", value: recent.filter((r) => kindOf(r.statusCode) === "ok").length, tone: "ink" },
    { label: "Client errors (wrong input, not signed in, not found)", value: recent.filter((r) => kindOf(r.statusCode) === "client").length, tone: "amber" },
    { label: "Server errors", value: recent.filter((r) => kindOf(r.statusCode) === "server").length, tone: "red" },
  ];
  const facts: [string, string, string][] = [
    ["Average", `${metrics.averageResponseTime} ms`, "Across every request since the server started."],
    ["95% of requests are faster than", `${metrics.p95ResponseTime} ms`, "Measured on the last 2,000 requests."],
    ["99% of requests are faster than", `${metrics.p99ResponseTime} ms`, "Measured on the last 2,000 requests."],
    ["Fastest recent request", fastest == null ? "–" : `${fastest} ms`, `Among the last ${recent.length} requests.`],
    ["Slowest recent request", slowest == null ? "–" : `${slowest} ms`, `Among the last ${recent.length} requests.`],
  ];
  return (
    <div className="so-grid mc-swap">
      <div className="so-col">
        <section className="sd-panel" aria-labelledby="mo-s1">
          <div className="sd-panel-head"><div><h2 id="mo-s1">Last 30 requests</h2><p>How long each one took. Hover a bar to see the address.</p></div></div>
          {last.length > 0 ? (
            <div className="mo-trend">
              <ColumnChart cols={last.map((r, i) => ({ key: `${r.timestamp}-${i}`, label: "", full: clock.format(new Date(r.timestamp)), value: r.duration, text: `${r.endpoint} took ${r.duration} ms`, hot: r.duration >= 1000 }))} max={max} label="Response time of the last 30 requests" />
              <p className="mo-note">Oldest on the left, newest on the right. The tallest bar took {max} ms. Amber bars took over a second.</p>
            </div>
          ) : <p className="ta-empty">No requests yet.</p>}
        </section>
        <section className="sd-panel" aria-labelledby="mo-s2">
          <div className="sd-panel-head"><div><h2 id="mo-s2">What came back</h2><p>Results of the last {recent.length} requests.</p></div></div>
          <SegmentBar parts={mix} unit="" empty="No requests yet." />
        </section>
      </div>
      <div className="so-col">
        <section className="sd-panel" aria-labelledby="mo-s3">
          <div className="sd-panel-head"><div><h2 id="mo-s3">Speed</h2><p>The usual time and the slow end.</p></div></div>
          <ul className="ao-stats">
            {facts.map(([name, val, note]) => (
              <li key={name}><span><b>{name}</b><small>{note}</small></span><span className="ao-val">{val}</span></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
