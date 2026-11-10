"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { AssignmentMarksPanel } from "@/components/school-admin/AssignmentMarksPanel";
import Leaderboard from "@/components/school-admin/analytics/Leaderboard";
import ScoreRun from "@/components/school-admin/analytics/ScoreRun";
import { bandOf, pct, studentBand, type AssignmentRow, type Band, type LeaderboardData } from "@/components/school-admin/analytics/types";
import { ChipGroup, Pager } from "@/components/portal/notifications";
import { formatGradeBadge, formatSectionLabel } from "@/components/school-admin/student-utils";
import "@/components/school-admin/students.css";
import "@/components/school-admin/teachers.css";
import "@/components/school-admin/analytics/analytics.css";

type Tab = "leaderboard" | "classes" | "subjects" | "assignments";
type AType = "all" | "DAILY" | "COURSE";
type ASort = "default" | "low" | "high" | "least";
const PAGE_SIZE = 25;
const ASORTS: Record<ASort, string> = {
  default: "Order published",
  low: "Lowest average first",
  high: "Highest average first",
  least: "Least handed in first",
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Meter({ value }: { value: number }) {
  return (
    <span className="aa-score" data-band={bandOf(value)}>
      <b>{pct(value)}</b>
      <i className="tm-bar" aria-hidden="true"><u style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></i>
    </span>
  );
}

export default function SchoolAdminAssignmentAnalyticsPage() {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["school-admin", "leaderboard"],
    queryFn: async () => (await schoolAdminApi.stats.leaderboard()).data as LeaderboardData,
  });

  const [tab, setTab] = useState<Tab>("leaderboard");
  const [band, setBand] = useState<Band | "all">("all");
  const [grade, setGrade] = useState("all");
  const [section, setSection] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [aSearch, setASearch] = useState("");
  const [aType, setAType] = useState<AType>("all");
  const [aSort, setASort] = useState<ASort>("default");
  const [pageState, setPageState] = useState({ key: "", page: 1 });

  const summary = data?.summary;
  const students = useMemo(() => data?.leaderboard ?? [], [data]);
  const assignments = useMemo(() => data?.assignment_table ?? [], [data]);

  const counts = useMemo(() => {
    const c: Record<Band, number> = { none: 0, low: 0, mid: 0, high: 0 };
    students.forEach((s) => { c[studentBand(s)] += 1; });
    return c;
  }, [students]);

  const medals = useMemo(() => {
    const m = { GOLD: 0, SILVER: 0, BRONZE: 0 };
    students.forEach((s) => { if (s.badge !== "NONE") m[s.badge] += 1; });
    return m;
  }, [students]);

  const published = summary?.total_assignments_published ?? 0;
  const avg = published > 0 && summary ? summary.overall_avg_score : null;

  // Classes: sections when the server gives them, otherwise whole grades.
  const classRows = useMemo(() => {
    const src = (data?.section_breakdown?.length ? data.section_breakdown : data?.grade_breakdown ?? []) as Array<{ grade: string; section?: string | null; avg_course_score: number; avg_daily_score: number; avg_overall: number }>;
    return src.map((r) => {
      const sec = r.section ?? "";
      const n = students.filter((s) => s.grade === r.grade && (!sec || s.section === sec)).length;
      return { ...r, sec, n, label: sec ? `${formatGradeBadge(r.grade)}, ${formatSectionLabel(sec)}` : formatGradeBadge(r.grade) || "No class" };
    });
  }, [data, students]);

  const subjects = useMemo(() => [...(data?.subject_breakdown ?? [])].sort((a, b) => b.avg_score - a.avg_score), [data]);
  const perSubject = useMemo(() => {
    const m = new Map<string, number>();
    assignments.forEach((a) => m.set(a.subject, (m.get(a.subject) ?? 0) + 1));
    return m;
  }, [assignments]);

  const visibleAssignments = useMemo(() => {
    const q = aSearch.trim().toLowerCase();
    const list = assignments.filter(
      (a) => (aType === "all" || (aType === "COURSE") === (a.assignment_type === "COURSE")) && (!q || a.title.toLowerCase().includes(q) || (a.subject ?? "").toLowerCase().includes(q)),
    );
    const graded = (a: AssignmentRow) => a.graded_count > 0;
    if (aSort === "low") list.sort((a, b) => Number(!graded(a)) - Number(!graded(b)) || a.avg_score - b.avg_score);
    else if (aSort === "high") list.sort((a, b) => Number(!graded(a)) - Number(!graded(b)) || b.avg_score - a.avg_score);
    else if (aSort === "least") list.sort((a, b) => a.completion_rate - b.completion_rate);
    return list;
  }, [assignments, aSearch, aType, aSort]);

  const aKey = `${aSearch}|${aType}|${aSort}`;
  const aPage = pageState.key === aKey ? pageState.page : 1;
  const setAPage = (p: number) => setPageState({ key: aKey, page: p });
  const aRows = visibleAssignments.slice((aPage - 1) * PAGE_SIZE, aPage * PAGE_SIZE);
  const aFiltered = !!aSearch || aType !== "all" || aSort !== "default";
  const clearA = () => { setASearch(""); setAType("all"); setASort("default"); };

  let status: React.ReactNode;
  if (error) status = "The scores did not load. Try again.";
  else if (isLoading) status = "Loading scores…";
  else if ((summary?.total_students ?? 0) === 0) status = "No students have joined yet. Scores show up here once they submit work.";
  else if (published === 0) status = "No assignments are published yet. Scores show up here once students submit work.";
  else status = <><strong>{pct(summary?.overall_avg_score ?? 0)}</strong> is the school average across {plural(published, "assignment")}. {plural(counts.high, "student")} {counts.high === 1 ? "scores" : "score"} 75% or more{counts.low > 0 ? <>, and {counts.low} {counts.low === 1 ? "is" : "are"} under 50%</> : null}.</>;

  const tiles = [
    { label: "Students", value: String(summary?.total_students ?? 0), hint: "In your school" },
    { label: "Assignments", value: String(published), hint: `${summary?.course_assignments_published ?? 0} course, ${summary?.daily_assignments_published ?? 0} daily` },
    { label: "Average score", value: avg == null ? "–" : pct(avg), hint: "Across graded work" },
    { label: "Medals", value: String(medals.GOLD + medals.SILVER + medals.BRONZE), hint: `${medals.GOLD} gold, ${medals.SILVER} silver, ${medals.BRONZE} bronze` },
  ];

  const goStudents = (g: string, s: string) => { setGrade(g); setSection(s || "all"); setBand("all"); setTab("leaderboard"); };

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="aa-title">
        <div className="sd-hero-copy">
          <h1 id="aa-title" className="mc-hero-title">Assignment analytics</h1>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            <button className="sd-btn sd-btn--ghost-dark" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={isFetching ? "animate-spin" : ""} aria-hidden="true" />{isFetching ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>
        <ScoreRun counts={counts} selected={band} average={avg} onSelect={(b) => { setBand(b); setTab("leaderboard"); }} />
      </section>

      <div className="sd-ledger" role="group" aria-label="Score summary">
        {tiles.map((m) => (
          <div key={m.label}>
            <span className="sd-l">{m.label}</span>
            {isLoading ? <span className="sd-skel" style={{ height: "2.2rem", width: "4rem" }} /> : <b className="sd-n">{m.value}</b>}
            <small>{m.hint}</small>
          </div>
        ))}
      </div>

      <div className="mc-tabs" role="tablist" aria-label="Analytics views" style={{ justifySelf: "start" }}>
        {([["leaderboard", "Leaderboard", students.length], ["classes", "Classes", classRows.length], ["subjects", "Subjects", subjects.length], ["assignments", "Assignments", assignments.length]] as const).map(([id, label, n]) => (
          <button key={id} role="tab" className="mc-tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}<b>{n}</b></button>
        ))}
      </div>

      {error ? (
        <section className="sd-panel">
          <div className="sd-empty"><b>We could not load the scores</b><p>Check your connection, then try again.</p><button className="sd-btn sd-btn--amber" onClick={() => void refetch()}>Try again</button></div>
        </section>
      ) : isLoading ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : tab === "leaderboard" ? (
        <>
          <p className="aa-note">Overall is 60% course and 40% daily work, or just one of them when a student only has that kind. Ranks are across the school, then within each grade and section.</p>
          <Leaderboard students={students} band={band} onBand={setBand} grade={grade} section={section} onGrade={setGrade} onSection={setSection} />
        </>
      ) : tab === "classes" ? (
        classRows.length === 0 ? (
          <section className="sd-panel"><div className="sd-empty"><b>No class scores yet</b><p>Once students hand in graded work, you will see how each class is doing here.</p></div></section>
        ) : (
          <section className="sd-panel as-list mc-swap" aria-label="Scores by class">
            <div className="aa-crow aa-head"><span>Class</span><span>Course</span><span>Daily</span><span>Overall</span><span /></div>
            {classRows.map((r) => (
              <article key={`${r.grade}\0${r.sec}`} className="aa-crow aa-item">
                <span className="aa-who"><b>{r.label}</b><small>{plural(r.n, "student")}</small></span>
                <span className="aa-part-bar"><small>Course</small>{r.avg_course_score > 0 ? <Meter value={r.avg_course_score} /> : <span className="sm-muted">No course scores</span>}</span>
                <span className="aa-part-bar"><small>Daily</small>{r.avg_daily_score > 0 ? <Meter value={r.avg_daily_score} /> : <span className="sm-muted">No daily scores</span>}</span>
                <span className="aa-part-bar"><small>Overall</small><Meter value={r.avg_overall} /></span>
                <button className="sd-btn sd-btn--line" onClick={() => goStudents(r.grade, r.sec)} aria-label={`See the students in ${r.label}`}>See students</button>
              </article>
            ))}
          </section>
        )
      ) : tab === "subjects" ? (
        subjects.length === 0 ? (
          <section className="sd-panel"><div className="sd-empty"><b>No subject scores yet</b><p>Subjects show up here once students hand in graded work.</p></div></section>
        ) : (
          <section className="sd-panel as-list mc-swap" aria-label="Scores by subject">
            {subjects.map((sub) => (
              <article key={sub.subject} className="aa-srow aa-item">
                <span className="aa-who"><b>{sub.subject}</b><small>{plural(perSubject.get(sub.subject) ?? 0, "assignment")}</small></span>
                <Meter value={sub.avg_score} />
                <button className="sd-btn sd-btn--line" onClick={() => { setASearch(sub.subject); setAType("all"); setASort("default"); setOpenId(null); setTab("assignments"); }} aria-label={`See ${sub.subject} assignments`}>See assignments</button>
              </article>
            ))}
          </section>
        )
      ) : openId ? (
        <AssignmentMarksPanel key={openId} assignmentId={openId} onBack={() => setOpenId(null)} />
      ) : assignments.length === 0 ? (
        <section className="sd-panel"><div className="sd-empty"><b>No assignments published yet</b><p>Published assignments show up here with how many students handed them in and how they scored.</p></div></section>
      ) : (
        <>
          <div className="aa-bar">
            <input type="search" className="sd-field" placeholder="Search by title or subject" aria-label="Search assignments" value={aSearch} onChange={(e) => setASearch(e.target.value)} />
            <ChipGroup label="Type" value={aType} options={[["all", "All"], ["DAILY", "Daily"], ["COURSE", "Course"]] as const} onChange={setAType} />
            <select className="sd-field" aria-label="Sort by" value={aSort} onChange={(e) => setASort(e.target.value as ASort)}>
              {(Object.keys(ASORTS) as ASort[]).map((k) => <option key={k} value={k}>{ASORTS[k]}</option>)}
            </select>
            {aFiltered && <button className="sd-btn sd-btn--line" onClick={clearA}>Clear filters</button>}
          </div>
          {visibleAssignments.length === 0 ? (
            <section className="sd-panel"><div className="sd-empty"><b>No assignments match</b><p>Try a different search, or clear the filters.</p><button className="sd-btn sd-btn--line" onClick={clearA}>Clear filters</button></div></section>
          ) : (
            <section className="sd-panel as-list mc-swap" aria-label="Assignments">
              <div className="aa-arow aa-head"><span>Assignment</span><span>Type</span><span>Handed in</span><span>Average</span></div>
              {aRows.map((a) => (
                <button key={a.assignment_id} className="aa-arow aa-item aa-open" onClick={() => setOpenId(a.assignment_id)} aria-label={`See marks for ${a.title}`}>
                  <span className="aa-who"><b>{a.title}</b><small>{[a.subject, a.total_marks != null && `${a.total_marks} marks`].filter(Boolean).join(" · ") || "No subject"}</small></span>
                  <span className="sm-chip" data-class={a.assignment_type === "COURSE" ? "true" : undefined}>{a.assignment_type === "COURSE" ? "Course" : "Daily"}</span>
                  <span className="aa-score" data-band="done">
                    <small className="aa-lbl">Handed in</small>
                    <b>{a.total_submissions}<small> of {a.targeted_students}</small></b>
                    <i className="tm-bar" aria-hidden="true"><u style={{ width: `${Math.min(100, a.completion_rate)}%` }} /></i>
                  </span>
                  {a.graded_count > 0 ? (
                    <span className="aa-avg">
                      <small className="aa-lbl">Average</small>
                      <Meter value={a.avg_score} />
                      {a.avg_marks != null && a.total_marks != null && <small>{a.avg_marks.toFixed(1)} of {a.total_marks} marks</small>}
                    </span>
                  ) : <span className="sm-muted">Not graded yet</span>}
                </button>
              ))}
              <Pager offset={(aPage - 1) * PAGE_SIZE} count={aRows.length} total={visibleAssignments.length} pageSize={PAGE_SIZE} noun="assignments" onPrev={() => setAPage(Math.max(1, aPage - 1))} onNext={() => setAPage(aPage + 1)} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
