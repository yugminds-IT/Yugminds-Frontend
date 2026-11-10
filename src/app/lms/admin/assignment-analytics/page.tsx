"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import SchoolRun from "@/components/admin/assignments/SchoolRun";
import SchoolsTab from "@/components/admin/assignments/SchoolsTab";
import StudentsTab from "@/components/admin/assignments/StudentsTab";
import { BANDS, pct, plural, schoolBand, type AnalyticsData, type Band } from "@/components/admin/assignments/types";
import { adminApi } from "@/lib/api/admin.api";
import "@/components/school-admin/overview.css"; // hero meta
import "@/components/teacher/overview/overview.css"; // track
import "@/components/school-admin/students.css"; // sm- chips
import "@/components/school-admin/teachers.css"; // tm-bar
import "@/components/school-admin/analytics/analytics.css"; // aa- rows, podium, track nodes
import "@/components/admin/assignments/assignments.css";

type Tab = "schools" | "students";
const PAGE_SIZE = 25;

export default function AdminAssignmentAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [tab, setTab] = useState<Tab>("schools");
  const [band, setBand] = useState<Band | "all">("all");
  const [search, setSearch] = useState("");
  const [pageState, setPageState] = useState({ key: "", page: 1 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await adminApi.dashboard.assignmentAnalytics();
      setData((res as { analytics?: AnalyticsData }).analytics ?? null);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const schools = useMemo(() => data?.school_rankings ?? [], [data]);
  const students = useMemo(() => data?.top_students_platform ?? [], [data]);

  const counts = useMemo(() => {
    const c: Record<Band, number> = { none: 0, low: 0, mid: 0, high: 0 };
    for (const s of schools) c[schoolBand(s)] += 1;
    return c;
  }, [schools]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schools.filter((s) => (band === "all" || schoolBand(s) === band) && (!q || s.school_name.toLowerCase().includes(q)));
  }, [schools, band, search]);

  const key = `${band}|${search}`;
  const page = pageState.key === key ? pageState.page : 1;

  const first = loading && !data && !failed;
  const dash = failed && !data;
  const summary = data?.summary;
  const published = summary?.total_assignments ?? 0;
  const attempts = summary?.total_attempts ?? 0;
  const active = BANDS.filter((b) => b !== "none").reduce((n, b) => n + counts[b], 0);
  const avg = attempts > 0 && summary ? summary.platform_avg_score : null;
  const clear = () => { setBand("all"); setSearch(""); };

  let status: React.ReactNode;
  if (dash) status = "The scores did not load. Try again.";
  else if (first) status = "Loading scores…";
  else if (published === 0) status = <><strong>No assignments are published yet.</strong> Scores show up here once students hand in work.</>;
  else if (attempts === 0) status = <><strong>{plural(published, "assignment")}</strong> published, and no one has handed in work yet.</>;
  else status = <><strong>{pct(avg ?? 0)}</strong> average score across {plural(active, "school")} with work handed in. {pct(data?.platform_completion_rate ?? 0)} of students have handed something in.</>;

  const tiles = [
    { label: "Schools", value: String(summary?.total_schools ?? schools.length), hint: active > 0 ? `${active} with work handed in` : "None with work yet" },
    { label: "Assignments", value: String(published), hint: "Published across the platform" },
    { label: "Handed in", value: pct(data?.platform_completion_rate ?? 0), hint: "Of enrolled students, at least once" },
    { label: "Retakes", value: pct(data?.retake_usage ?? 0), hint: "Of all attempts were retakes" },
  ];

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="ap-title">
        <div className="sd-hero-copy">
          <h1 id="ap-title" className="mc-hero-title">Assignment analytics</h1>
          <p className="sd-where">How schools and students do on assignments</p>
          <p className="sd-status">{status}</p>
          <div className="so-meta">
            <button className="so-refresh" onClick={() => void load()} disabled={loading} aria-label={loading ? "Refreshing" : "Refresh"} title="Refresh">
              <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
            </button>
          </div>
        </div>
        {first ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : (
          <SchoolRun counts={counts} selected={band} average={avg} onSelect={(b) => { setBand(b); setTab("schools"); }} />
        )}
      </section>

      <div className="sd-ledger" role="group" aria-label="Platform summary">
        {tiles.map((m) => (
          <div key={m.label}>
            <span className="sd-l">{m.label}</span>
            {first ? <span className="sd-skel" style={{ height: "2.2rem", width: "4rem" }} /> : <b className="sd-n">{dash ? "–" : m.value}</b>}
            <small>{dash ? "Not loaded" : m.hint}</small>
          </div>
        ))}
      </div>

      <div className="mc-tabs" role="tablist" aria-label="Analytics views" style={{ justifySelf: "start" }}>
        <button role="tab" className="mc-tab" aria-selected={tab === "schools"} onClick={() => setTab("schools")}>Schools{!first && !dash && <b>{schools.length}</b>}</button>
        <button role="tab" className="mc-tab" aria-selected={tab === "students"} onClick={() => setTab("students")}>Top students{!first && !dash && <b>{students.length}</b>}</button>
      </div>

      {first ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : dash ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>We could not load the scores</b>
            <p>Check your connection, then try again.</p>
            <button className="sd-btn sd-btn--amber" onClick={() => void load()}>Try again</button>
          </div>
        </section>
      ) : tab === "schools" ? (
        <>
          {schools.length > 0 && <p className="aa-note">Schools are ranked by their average score (marks earned out of marks possible, on each student&apos;s counted attempt), then by how many students have handed in work. The platform average is the average of the schools that have work handed in.</p>}
          <SchoolsTab rows={shown} total={schools.length} band={band} search={search} onSearch={setSearch} onClear={clear} page={page} pageSize={PAGE_SIZE} onPage={(p) => setPageState({ key, page: p })} />
        </>
      ) : (
        <>
          <p className="aa-note">The 50 best students on the platform, ranked together across every school. Overall is 60% course and 40% daily work, or just one of them when a student only has that kind.</p>
          <StudentsTab students={students} />
        </>
      )}
    </div>
  );
}
