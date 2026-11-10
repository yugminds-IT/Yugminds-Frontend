"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Download, RefreshCw } from "lucide-react";
import SpeedRun from "@/components/admin/monitoring/SpeedRun";
import RequestsTab from "@/components/admin/monitoring/RequestsTab";
import EndpointsTab from "@/components/admin/monitoring/EndpointsTab";
import SpeedTab from "@/components/admin/monitoring/SpeedTab";
import { EMPTY, healthOf, kindOf, plural, speedOf, uptimeText, type Alert, type ApiMetrics, type Kind, type Request, type Speed } from "@/components/admin/monitoring/utils";
import { adminApi } from "@/lib/api/admin.api";
import { toast } from "@/components/ui/toast";
import "@/components/school-admin/overview.css"; // hero meta, so- grid
import "@/components/teacher/overview/overview.css"; // track
import "@/components/school-admin/students.css"; // sm- chips
import "@/components/school-admin/teachers.css"; // tm- track nodes
import "@/components/admin/overview/overview.css"; // ao-stats rows
import "@/components/admin/monitoring/monitoring.css";

type Tab = "requests" | "endpoints" | "speed";
const TABS: [Tab, string][] = [["requests", "Recent requests"], ["endpoints", "Addresses"], ["speed", "Speed"]];
const PAGE_SIZE = 25;
const LIVE_EVERY_MS = 5000;
const stamp = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" });

export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<ApiMetrics>(EMPTY);
  const [recent, setRecent] = useState<Request[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [live, setLive] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);

  const [tab, setTab] = useState<Tab>("requests");
  const [speed, setSpeed] = useState<Speed | null>(null);
  const [kind, setKind] = useState<Kind>("all");
  const [search, setSearch] = useState("");
  const [pageState, setPageState] = useState({ key: "", page: 1 });

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [m, a] = await Promise.allSettled([adminApi.dashboard.monitoring(), adminApi.alerts()]);
      if (m.status === "rejected") throw m.reason;
      const data = m.value.data as { metrics?: Partial<ApiMetrics>; recent?: Request[] };
      setMetrics({ ...EMPTY, ...data?.metrics });
      setRecent(Array.isArray(data?.recent) ? data.recent : []);
      if (a.status === "fulfilled") setAlerts((a.value.data as { alerts?: Alert[] })?.alerts ?? []);
      setUpdated(new Date());
      setFailed(false);
      setLoaded(true);
    } catch {
      if (!quiet) setFailed(true);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Live updates poll quietly so the page does not flash. The server leaves this endpoint out of its own counts.
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!live) return;
    timer.current = setInterval(() => void load(true), LIVE_EVERY_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [live, load]);

  const counts = useMemo(() => {
    const c: Record<Speed, number> = { fast: 0, normal: 0, slow: 0, crawl: 0 };
    for (const r of recent) c[speedOf(r.duration)] += 1;
    return c;
  }, [recent]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...recent].reverse().filter((r) => (!speed || speedOf(r.duration) === speed) && (kind === "all" || kindOf(r.statusCode) === kind) && (!q || r.endpoint.toLowerCase().includes(q)));
  }, [recent, speed, kind, search]);

  const key = `${speed}|${kind}|${search}`;
  const page = pageState.key === key ? pageState.page : 1;
  const clear = () => { setSpeed(null); setKind("all"); setSearch(""); };

  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ metrics, recentMetrics: recent, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `metrics-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Saved the metrics file");
  };

  const first = loading && !loaded;
  const dash = failed && !loaded;
  const { state, server } = healthOf(recent);
  const worked = metrics.totalRequests > 0 ? Math.round((metrics.successfulRequests / metrics.totalRequests) * 1000) / 10 : 100;

  let statusLine: React.ReactNode;
  if (dash) statusLine = "The numbers did not load. Try refreshing.";
  else if (first) statusLine = "Checking the server…";
  else if (state === "waiting") statusLine = <><strong>Waiting for traffic.</strong> The server started {uptimeText(metrics.uptimeSeconds)} ago and has not handled a request yet.</>;
  else if (state === "healthy") statusLine = <><strong>The server is healthy.</strong> No server errors in the last {plural(recent.length, "request")}. It has been up {uptimeText(metrics.uptimeSeconds)}.</>;
  else statusLine = <><strong>{plural(server, "server error")}</strong> in the last {plural(recent.length, "request")}. Open the list and choose “Server errors” to see which.</>;

  const runCaption = first ? "Loading…" : recent.length === 0 ? "No requests yet" : `${counts.slow + counts.crawl} slower than half a second`;

  const tiles = [
    { label: "Requests", value: metrics.totalRequests.toLocaleString("en-IN"), hint: `Since the server started ${uptimeText(metrics.uptimeSeconds)} ago` },
    { label: "Worked", value: `${worked}%`, hint: `${metrics.failedRequests.toLocaleString("en-IN")} did not, including wrong passwords and missing pages`, hot: false },
    { label: "Server errors", value: String(server), hint: `In the last ${plural(recent.length, "request")}`, hot: server > 0 },
    { label: "Typical speed", value: `${metrics.averageResponseTime} ms`, hint: `95% are faster than ${metrics.p95ResponseTime} ms`, hot: false },
  ];

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="mo-title">
        <div className="sd-hero-copy">
          <h1 id="mo-title" className="mc-hero-title">System monitoring</h1>
          <p className="sd-where">Live traffic since the server last started</p>
          <p className="sd-status">{statusLine}</p>
          <div className="sd-hero-actions">
            <button type="button" className={`sd-btn mo-live ${live ? "sd-btn--amber" : "sd-btn--ghost-dark"}`} aria-pressed={live} onClick={() => setLive((v) => !v)}>
              <Activity aria-hidden="true" />{live ? "Live updates on" : "Turn on live updates"}
            </button>
            <button className="sd-btn sd-btn--ghost-dark" onClick={exportJson} disabled={!loaded}><Download aria-hidden="true" />Export</button>
          </div>
          <div className="so-meta">
            <button className="so-refresh" onClick={() => void load()} disabled={loading} aria-label={loading ? "Refreshing" : "Refresh"} title="Refresh">
              <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
            </button>
            {updated && <span className="mo-asof">Updated {stamp.format(updated)}</span>}
          </div>
        </div>
        {first ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : (
          <SpeedRun counts={counts} selected={speed} onSelect={(s) => { setSpeed(s); setTab("requests"); }} caption={runCaption} />
        )}
      </section>

      <div className="sd-ledger" role="group" aria-label="Server numbers">
        {tiles.map((m) => (
          <div key={m.label} className={m.hot ? "mo-hot" : undefined}>
            <span className="sd-l">{m.label}</span>
            {first ? <span className="sd-skel" style={{ height: "2.2rem", width: "4rem" }} /> : <b className="sd-n">{dash ? "–" : m.value}</b>}
            <small>{dash ? "Not loaded" : first ? " " : m.hint}</small>
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <section className="sd-panel mo-alerts" aria-label="Things that need a look">
          <div className="sd-panel-head"><h2>Needs a look</h2></div>
          {alerts.map((a) => {
            const body = <><b>{a.label}</b>{a.href && <small>Open</small>}</>;
            return a.href && a.href !== "/lms/admin/monitoring"
              ? <Link key={a.id} href={a.href} className="mo-alert" data-tone={a.tone}>{body}</Link>
              : <div key={a.id} className="mo-alert" data-tone={a.tone}><b>{a.label}</b></div>;
          })}
        </section>
      )}

      <div className="mc-tabs" role="tablist" aria-label="Monitoring views" style={{ justifySelf: "start" }}>
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" className="mc-tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}{id === "requests" && loaded && <b>{recent.length}</b>}{id === "endpoints" && loaded && <b>{metrics.endpointStats.length}</b>}</button>
        ))}
      </div>

      {first ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : dash ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>We could not load the monitoring numbers</b>
            <p>Check your connection, then try again.</p>
            <button className="sd-btn sd-btn--amber" onClick={() => void load()}>Try again</button>
          </div>
        </section>
      ) : tab === "requests" ? (
        <>
          <p className="mo-note">The numbers are kept in memory and start again from zero whenever the server restarts or is redeployed. The list shows the latest 200 requests.</p>
          <RequestsTab rows={rows} total={recent.length} speed={speed} kind={kind} onKind={setKind} search={search} onSearch={setSearch} onClear={clear} page={page} pageSize={PAGE_SIZE} onPage={(p) => setPageState({ key, page: p })} />
        </>
      ) : tab === "endpoints" ? (
        <EndpointsTab stats={metrics.endpointStats} />
      ) : (
        <SpeedTab metrics={metrics} recent={recent} />
      )}
    </div>
  );
}
