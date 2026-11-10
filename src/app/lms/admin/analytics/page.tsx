"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import GrowthRun, { type GrowthKey } from "@/components/admin/overview/GrowthRun";
import { HealthTab, SchoolsTab, CoursesTab } from "@/components/admin/analytics/Panels";
import { EMPTY, TABS, plural, trendText, type Result, type Tab } from "@/components/admin/analytics/utils";
import { adminApi } from "@/lib/api/admin.api";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { toast } from "@/components/ui/toast";
import "@/components/school-admin/overview.css"; // hero meta, so- grid
import "@/components/teacher/overview/overview.css"; // track
import "@/components/admin/overview/overview.css"; // growth track, ao-stats rows
import "@/components/admin/analytics/analytics.css";

const stamp = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Saves a text file to the user's computer. */
function download(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<Result>(EMPTY);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [metric, setMetric] = useState<GrowthKey>("students");

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const { data: r } = await adminApi.dashboard.analytics(force ? { force: true } : undefined);
      const res = (r ?? {}) as Partial<Result>;
      setData({ ...EMPTY, ...res, analytics: { ...EMPTY.analytics, ...res.analytics }, trends: { ...EMPTY.trends, ...res.trends }, teacherPerformance: res.teacherPerformance ?? {} });
      setGeneratedAt(res.generatedAt ?? null);
      setLoadError(null);
      setLoaded(true);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string; details?: string; message?: string } } };
      setLoadError(err.response?.data?.error ?? err.response?.data?.details ?? err.response?.data?.message ?? (error instanceof Error ? error.message : "Something went wrong"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Reload when the tab comes back into view, at most once a minute.
  useSmartRefresh({ customRefresh: load, minRefreshInterval: 60000 });

  const exportAs = (type: "json" | "csv") => {
    const a = data.analytics;
    const day = new Date().toISOString().slice(0, 10);
    const base = `performance_analytics_${day}`;
    if (type === "json") {
      download(`${base}.json`, "application/json;charset=utf-8", JSON.stringify({ ...data, exported_at: new Date().toISOString(), type }, null, 2));
    } else {
      const t = data.trends;
      const rows: string[][] = [
        ["metric", "value"],
        ["totalSchools", String(a.totalSchools)], ["totalTeachers", String(a.totalTeachers)], ["totalStudents", String(a.totalStudents)], ["activeCourses", String(a.activeCourses)],
        ["systemHealth", String(a.systemHealth)], ["avgAttendance", String(a.avgAttendance)], ["completionRate", String(a.completionRate)],
        ["schoolsChange", String(t.schoolsChange)], ["teachersChange", String(t.teachersChange)], ["studentsChange", String(t.studentsChange)], ["coursesChange", String(t.coursesChange)],
        [],
        ["topSchools.name", "share of largest school (%)"], ...data.topSchools.map((s) => [s.name, String(s.engagement)]),
        [],
        ["popularCourses.name", "students"], ...data.popularCourses.map((c) => [c.name, String(c.students)]),
      ];
      download(`${base}.csv`, "text/csv;charset=utf-8", rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"));
    }
    toast.success(`Saved ${base}.${type}`);
  };

  const first = loading && !loaded;
  const dash = !!loadError && !loaded;
  const a = data.analytics;
  const last = data.monthlyGrowth[data.monthlyGrowth.length - 1];
  const totals: Record<GrowthKey, number> = { schools: a.totalSchools, teachers: a.totalTeachers, students: a.totalStudents, courses: a.activeCourses };

  let statusLine: React.ReactNode;
  if (dash) statusLine = "The analytics did not load. Try refreshing.";
  else if (first) statusLine = "Crunching the numbers…";
  else if (a.totalStudents === 0 && a.totalSchools === 0) statusLine = <><strong>Nothing to measure yet.</strong> Numbers appear once schools and students are added.</>;
  else statusLine = <><strong>{a.totalStudents.toLocaleString("en-IN")} {a.totalStudents === 1 ? "student" : "students"}</strong> in {plural(a.totalSchools, "school")}.{last && last.students > 0 && <> {last.students} joined this month.</>}</>;

  const ledger: { key: GrowthKey; label: string; href: string; change: number | null }[] = [
    { key: "schools", label: "Schools", href: "/lms/admin/schools", change: data.trends.schoolsChange },
    { key: "teachers", label: "Teachers", href: "/lms/admin/teachers", change: data.trends.teachersChange },
    { key: "students", label: "Students", href: "/lms/admin/students", change: data.trends.studentsChange },
    { key: "courses", label: "Active courses", href: "/lms/admin/courses", change: data.trends.coursesChange },
  ];

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="pa-title">
        <div className="sd-hero-copy">
          <h1 id="pa-title" className="mc-hero-title">Performance analytics</h1>
          <p className="sd-where">How the whole platform is doing</p>
          <p className="sd-status">{statusLine}</p>
          <div className="sd-hero-actions">
            <button className="sd-btn sd-btn--amber" onClick={() => exportAs("csv")} disabled={!loaded}><Download aria-hidden="true" />Export CSV</button>
            <button className="sd-btn sd-btn--ghost-dark" onClick={() => exportAs("json")} disabled={!loaded}>Export JSON</button>
            <Link className="sd-btn sd-btn--ghost-dark" href="/lms/admin/assignment-analytics">Assignment analytics</Link>
          </div>
          <div className="so-meta">
            <button className="so-refresh" onClick={() => void load(true)} disabled={loading} aria-label={loading ? "Refreshing" : "Refresh"} title="Refresh">
              <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
            </button>
            {generatedAt && <span className="pa-asof">Updated {stamp.format(new Date(generatedAt))}</span>}
          </div>
        </div>
        {first ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : (
          <GrowthRun months={data.monthlyGrowth} metric={metric} onMetric={setMetric} total={totals[metric]} />
        )}
      </section>

      <nav className="sd-ledger" aria-label="Platform totals">
        {ledger.map((m) => (
          <Link key={m.key} href={m.href} aria-label={first ? m.label : `${m.label}: ${totals[m.key]}. ${trendText(m.change)}`}>
            <span className="sd-l">{m.label}</span>
            {first ? <span className="sd-skel" style={{ height: "2.2rem", width: "4.5rem" }} /> : <b className="sd-n">{dash ? "–" : totals[m.key].toLocaleString("en-IN")}</b>}
            <small>{first ? " " : dash ? "Not loaded" : trendText(m.change)}</small>
          </Link>
        ))}
      </nav>

      <div className="mc-tabs" role="tablist" aria-label="Analytics sections" style={{ justifySelf: "start" }}>
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" className="mc-tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {first ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : dash ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>We could not load the analytics</b>
            <p>{loadError}. Check your connection, then try again.</p>
            <button className="sd-btn sd-btn--amber" onClick={() => void load(true)}>Try again</button>
          </div>
        </section>
      ) : (
        <>
          {loadError && <p className="ta-empty" role="alert">The latest refresh failed ({loadError}). These numbers are from the last time it worked.</p>}
          {tab === "overview" && <HealthTab data={data} />}
          {tab === "schools" && <SchoolsTab data={data} />}
          {tab === "courses" && <CoursesTab data={data} />}
        </>
      )}
    </div>
  );
}
