"use client";

import { typeLabel } from "@/lib/assignment-types";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import type { ReportData } from "@/components/teacher/assignments/ReportDownloadDialog";
import { AssignmentMarksPanel } from "@/components/school-admin/AssignmentMarksPanel";
import Leaderboard from "@/components/school-admin/analytics/Leaderboard";
import ScoreRun from "@/components/school-admin/analytics/ScoreRun";
import { bandOf, pct, studentBand, toDailyView, type AssignmentRow, type Band, type LeaderboardData } from "@/components/school-admin/analytics/types";
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

/**
 * Student performance (all work) or Daily performance (daily assignments only).
 * The school-admin and teacher portals share this view and differ only in the data they pass in.
 */
export default function PerformanceView({
  mode = "overall",
  queryKey,
  fetchLeaderboard,
  fetchMarks,
  loadReport,
  completion,
  scope = "school",
}: {
  mode?: "overall" | "daily";
  queryKey: readonly unknown[];
  fetchLeaderboard: () => Promise<{ data: unknown }>;
  fetchMarks: (assignmentId: string) => Promise<{ data: unknown }>;
  /** Teacher portal only: enables Download report on an opened assignment. */
  loadReport?: (assignmentId: string) => Promise<ReportData>;
  /** student_id → course completion %. Optional: the leaderboard renders without it. */
  completion?: Map<string, number>;
  /** "school" for school admins, "your sections" for teachers. */
  scope?: "school" | "your sections";
}) {
  const daily = mode === "daily";
  const { data: raw, isLoading, isFetching, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => (await fetchLeaderboard()).data as LeaderboardData,
  });
  const data = useMemo(() => (raw && daily ? toDailyView(raw) : raw), [raw, daily]);
  const mine = scope === "school" ? "your school" : "your sections";

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
  const needHelp = counts.low + counts.none;
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
  else if ((summary?.total_students ?? 0) === 0) status = `No students in ${mine} yet. Scores show up here once they submit work.`;
  else if (published === 0) status = daily ? "No daily assignments are published yet. Scores show up here once students submit work." : "No assignments are published yet. Scores show up here once students submit work.";
  else status = <><strong>{pct(summary?.overall_avg_score ?? 0)}</strong> is the {scope === "school" ? "school" : "class"} average across {plural(published, daily ? "daily assignment" : "assignment")}. {plural(counts.high, "student")} {counts.high === 1 ? "scores" : "score"} 75% or more{counts.low > 0 ? <>, and {counts.low} {counts.low === 1 ? "is" : "are"} under 50%</> : null}.</>;

  const tiles = [
    { label: "Students", value: String(summary?.total_students ?? 0), hint: `In ${mine}` },
    daily
      ? { label: "Daily assignments", value: String(published), hint: "Published" }
      : { label: "Assignments", value: String(published), hint: `${summary?.course_assignments_published ?? 0} course, ${summary?.daily_assignments_published ?? 0} daily` },
    { label: daily ? "Daily average" : "Average score", value: avg == null ? "–" : pct(avg), hint: daily ? "Across graded daily work" : "Across graded work" },
    daily
      ? { label: "Needs attention", value: String(needHelp), hint: "Under 50% or no daily work" }
      : { label: "Medals", value: String(medals.GOLD + medals.SILVER + medals.BRONZE), hint: `${medals.GOLD} gold, ${medals.SILVER} silver, ${medals.BRONZE} bronze` },
  ];

  const goStudents = (g: string, s: string) => { setGrade(g); setSection(s || "all"); setBand("all"); setTab("leaderboard"); };

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="aa-title">
        <div className="sd-hero-copy">
          <h1 id="aa-title" className="mc-hero-title">{daily ? "Daily performance" : "Student performance"}</h1>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            <button className="sd-btn sd-btn--ghost-dark" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={isFetching ? "animate-spin" : ""} aria-hidden="true" />{isFetching ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>
        <ScoreRun counts={counts} selected={band} average={avg} averageLabel={scope === "school" ? "school average" : "class average"} onSelect={(b) => { setBand(b); setTab("leaderboard"); }} />
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
          <p className="aa-note">{daily ? "Only daily assignments count here. Score is the marks a student earned out of the marks available on graded daily work. " : "Overall is 60% course and 40% daily work, or just one of them when a student only has that kind. "}Completion is how far through their courses a student is. Ranks are across {scope === "school" ? "the school" : "your students"}, then within each grade and section.</p>
          <Leaderboard students={students} band={band} onBand={setBand} grade={grade} section={section} onGrade={setGrade} onSection={setSection} completion={completion} daily={daily} scope={scope === "school" ? "school" : "sections"} />
        </>
      ) : tab === "classes" ? (
        classRows.length === 0 ? (
          <section className="sd-panel"><div className="sd-empty"><b>No class scores yet</b><p>Once students hand in graded work, you will see how each class is doing here.</p></div></section>
        ) : (
          <section className="sd-panel as-list mc-swap" aria-label="Scores by class">
            <div className="aa-crow aa-head"><span>Class</span><span>{daily ? "" : "Course"}</span><span>Daily</span><span>{daily ? "" : "Overall"}</span><span /></div>
            {classRows.map((r) => (
              <article key={`${r.grade}\0${r.sec}`} className="aa-crow aa-item">
                <span className="aa-who"><b>{r.label}</b><small>{plural(r.n, "student")}</small></span>
                <span className="aa-part-bar">{!daily && <small>Course</small>}{daily ? null : r.avg_course_score > 0 ? <Meter value={r.avg_course_score} /> : <span className="sm-muted">No course scores</span>}</span>
                <span className="aa-part-bar"><small>Daily</small>{r.avg_daily_score > 0 ? <Meter value={r.avg_daily_score} /> : <span className="sm-muted">No daily scores</span>}</span>
                <span className="aa-part-bar">{!daily && <><small>Overall</small><Meter value={r.avg_overall} /></>}</span>
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
        <AssignmentMarksPanel key={openId} assignmentId={openId} onBack={() => setOpenId(null)} fetchMarks={fetchMarks} loadReport={loadReport} />
      ) : assignments.length === 0 ? (
        <section className="sd-panel"><div className="sd-empty"><b>No assignments published yet</b><p>Published assignments show up here with how many students handed them in and how they scored.</p></div></section>
      ) : (
        <>
          <div className="aa-bar">
            <input type="search" className="sd-field" placeholder="Search by title or subject" aria-label="Search assignments" value={aSearch} onChange={(e) => setASearch(e.target.value)} />
            {!daily && <ChipGroup label="Type" value={aType} options={[["all", "All"], ["DAILY", "Daily"], ["COURSE", "Course"]] as const} onChange={setAType} />}
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
                  <span className="sm-chip" data-class={a.assignment_type === "COURSE" ? "true" : undefined}>{typeLabel(a.assignment_type)}</span>
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
