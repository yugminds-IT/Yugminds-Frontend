"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChipGroup } from "../../portal/notifications";
import { ColumnChart, type Col } from "../../teacher/analytics/Charts";
import { adminApi } from "@/lib/api/admin.api";
import { bars, type Range } from "./bars";
import { ROLE_LABEL, plural, type Breakdown, type History } from "./utils";
import "../../teacher/analytics/analytics.css"; // charts

const RANGES = [["24", "Last 24 hours"], ["72", "Last 3 days"], ["168", "Last 7 days"]] as const;

function BreakdownRows({ title, note, rows }: { title: string; note: string; rows: { key: string; name: string; b: Breakdown }[] }) {
  return (
    <section className="sd-panel as-list" aria-label={title}>
      <div className="sd-panel-head" style={{ padding: "1.1rem 1.25rem 0.6rem" }}><div><h2>{title}</h2><p>{note}</p></div></div>
      {rows.length === 0 ? (
        <p className="ta-empty" style={{ padding: "0 1.25rem 1.25rem" }}>No traffic saved for this range yet.</p>
      ) : (
        <>
          <div className="mo-brk-row mo-brk-head" aria-hidden="true"><span>{title.startsWith("By role") ? "Dashboard" : "School"}</span><span>Requests</span><span>Server errors</span><span>Average</span><span>Slower than 0.5 s</span></div>
          {rows.map((r) => (
            <div key={r.key} className="mo-brk-row" data-bad={r.b.server_errors > 0 || r.b.slow_percent >= 25}>
              <b>{r.name}</b>
              <span>{r.b.requests.toLocaleString("en-IN")}</span>
              <span>{r.b.server_errors}</span>
              <span>{r.b.avg_ms} ms</span>
              <span>{r.b.slow_percent}%</span>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

/** Traffic over the last hours and days, from the hourly totals saved in the database. Survives restarts. */
export default function TrendsTab({ role, schoolId }: { role: string; schoolId: string }) {
  const [range, setRange] = useState<Range>("24");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "monitoring", "history", range, role, schoolId],
    queryFn: async () => (await adminApi.dashboard.monitoringHistory({ hours: Number(range), role: role || undefined, school_id: schoolId || undefined })).data as History,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading) return <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>;
  if (isError || !data) {
    return (
      <section className="sd-panel"><div className="sd-empty"><b>We could not load the trends</b><p>Check your connection, then try again.</p><button className="sd-btn sd-btn--amber" onClick={() => void refetch()}>Try again</button></div></section>
    );
  }
  if (!data.available) {
    return (
      <section className="sd-panel"><div className="sd-empty"><b>History is not switched on yet</b><p>Saving the hourly totals needs a one-time database update. Until it is applied, only the live numbers since the last restart are available.</p></div></section>
    );
  }

  const b = bars(data.series, range);
  const maxReq = Math.max(1, ...b.map((x) => x.requests));
  const maxServer = Math.max(1, ...b.map((x) => x.server));
  const maxAvg = Math.max(1, ...b.map((x) => x.avg));
  const col = (value: (x: (typeof b)[number]) => number, text: (x: (typeof b)[number]) => string, hot?: (x: (typeof b)[number]) => boolean): Col[] =>
    b.map((x, i) => ({ key: String(i), label: x.label, full: x.full, value: x.requests === 0 ? null : value(x), text: text(x), hot: hot?.(x) }));
  const t = data.totals;

  return (
    <div className="mc-swap" style={{ display: "grid", gap: "1.25rem" }}>
      <div className="mo-range">
        <ChipGroup label="How far back" value={range} options={RANGES} onChange={setRange} />
        <p className="mo-note" style={{ margin: 0 }}>Saved every minute and kept for {plural(data.retention_days, "day")}. Older totals are deleted automatically.</p>
      </div>

      <div className="sd-ledger" role="group" aria-label="Totals for this range">
        <div><span className="sd-l">Requests</span><b className="sd-n">{t.requests.toLocaleString("en-IN")}</b><small>{plural(t.client_errors, "request")} got a client error</small></div>
        <div className={t.server_errors > 0 ? "mo-hot" : undefined}><span className="sd-l">Server errors</span><b className="sd-n">{t.server_errors}</b><small>{t.requests > 0 ? `${Math.round((t.server_errors / t.requests) * 1000) / 10}% of requests` : "No traffic yet"}</small></div>
        <div><span className="sd-l">Average speed</span><b className="sd-n">{t.avg_ms} ms</b><small>Across all requests</small></div>
        <div className={t.slow_percent >= 25 ? "mo-hot" : undefined}><span className="sd-l">Slower than 0.5 s</span><b className="sd-n">{t.slow_percent}%</b><small>Share of requests</small></div>
      </div>

      {t.requests === 0 ? (
        <section className="sd-panel"><div className="sd-empty"><b>No traffic saved for this range yet</b><p>Totals are saved every minute. They appear here as people use the platform.</p></div></section>
      ) : (
        <>
          <div className="so-grid">
            <div className="so-col">
              <section className="sd-panel" aria-labelledby="mo-t1">
                <div className="sd-panel-head"><div><h2 id="mo-t1">Requests</h2><p>How many requests the server handled in each period.</p></div></div>
                <ColumnChart cols={col((x) => x.requests, (x) => plural(x.requests, "request"))} max={maxReq} label="Requests per period" />
              </section>
              <section className="sd-panel" aria-labelledby="mo-t2">
                <div className="sd-panel-head"><div><h2 id="mo-t2">Server errors</h2><p>Requests that failed because of the server, not the caller.</p></div></div>
                <ColumnChart cols={col((x) => x.server, (x) => plural(x.server, "server error"), (x) => x.server > 0)} max={maxServer} label="Server errors per period" />
              </section>
            </div>
            <div className="so-col">
              <section className="sd-panel" aria-labelledby="mo-t3">
                <div className="sd-panel-head"><div><h2 id="mo-t3">Average speed</h2><p>How long a typical request took, in milliseconds. Taller is slower.</p></div></div>
                <ColumnChart cols={col((x) => x.avg, (x) => `${x.avg} ms on average`, (x) => x.avg >= 1000 || x.slowShare >= 0.25)} max={maxAvg} label="Average speed per period" />
              </section>
            </div>
          </div>

          <div className="so-grid">
            <div className="so-col">
              <BreakdownRows
                title="By role"
                note="Which dashboard is slow or failing. Red rows had server errors or many slow requests."
                rows={data.by_role.map((r) => ({ key: r.role, name: ROLE_LABEL[r.role], b: r }))}
              />
            </div>
            <div className="so-col">
              <BreakdownRows
                title="By school"
                note="The busiest schools in this range."
                rows={data.by_school.map((s) => ({ key: s.school_id, name: s.school_name, b: s }))}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
