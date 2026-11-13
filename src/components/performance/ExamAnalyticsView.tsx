"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { useReport, type ReportData } from "@/components/teacher/assignments/ReportDownloadDialog";
import { EXAM_TYPE_LABEL } from "@/lib/assignment-types";
import { ChipGroup, Pager, initialsOf } from "@/components/portal/notifications";
import { formatGradeBadge, formatSectionLabel } from "@/components/school-admin/student-utils";
import { bandOf, pct } from "@/components/school-admin/analytics/types";
import "@/components/school-admin/students.css";
import "@/components/school-admin/teachers.css";
import "@/components/school-admin/analytics/analytics.css";

type ExamRow = {
  assignment_id: string; title: string; subject: string | null; exam_type: string | null; school_id: string | null;
  phase: "upcoming" | "open" | "closed"; starts_at: string | null; ends_at: string | null;
  participants: number; graded_count: number; retake_count: number;
  avg_score_percentage: number; highest_score_percentage: number; lowest_score_percentage: number; pass_rate: number;
};
type StudentRow = { student_id: number; name: string; school_id: string | null; grade: string | null; section: string | null; exams_taken: number; score: number; rank: number };
export type ExamAnalytics = {
  summary: { exams_count: number; live: number; upcoming: number; closed: number; participants: number; avg_score: number; pass_rate: number };
  exams: ExamRow[];
  by_subject: Array<{ subject: string; avg_score: number; submissions: number }>;
  by_exam_type: Array<{ exam_type: string; avg_score: number; submissions: number }>;
  students: StudentRow[];
  schools?: Array<{ id: string; name: string }>;
};

const PAGE_SIZE = 25;
const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
const classOf = (st: StudentRow) => [formatGradeBadge(st.grade), st.section && formatSectionLabel(st.section).replace(/^section\s*/i, "")].filter(Boolean).join(" ");
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

function Meter({ value }: { value: number }) {
  return (
    <span className="aa-score" data-band={bandOf(value)}>
      <b>{pct(value)}</b>
      <i className="tm-bar" aria-hidden="true"><u style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></i>
    </span>
  );
}

const PHASE = { upcoming: "Upcoming", open: "Live", closed: "Closed" } as const;
const when = (v: string | null) => (v ? new Date(v).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");

export default function ExamAnalyticsView({ queryKey, fetcher, loadReport }: { queryKey: string[]; fetcher: (schoolId?: string) => Promise<{ data: { analytics: ExamAnalytics } }>; loadReport?: (assignmentId: string) => Promise<ReportData> }) {
  const { open: openReport, busyId: reportBusy, dialog: reportDialog } = useReport(loadReport);
  const [schoolId, setSchoolId] = useState("");
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: [...queryKey, schoolId],
    queryFn: async () => (await fetcher(schoolId || undefined)).data.analytics,
    placeholderData: keepPreviousData,
  });
  const [tab, setTab] = useState<"exams" | "students" | "breakdown">("exams");
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("all");
  const [section, setSection] = useState("all");
  const [pageState, setPageState] = useState({ key: "", page: 1 });
  const students = useMemo(() => data?.students ?? [], [data]);
  const grades = useMemo(() => [...new Set(students.map((x) => x.grade).filter(Boolean) as string[])].sort(natural), [students]);
  const sections = useMemo(() => [...new Set(students.filter((x) => grade === "all" || x.grade === grade).map((x) => x.section).filter(Boolean) as string[])].sort(natural), [students, grade]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((x) => (grade === "all" || x.grade === grade) && (section === "all" || x.section === section) && (!q || x.name.toLowerCase().includes(q)));
  }, [students, search, grade, section]);
  const filterKey = `${search}|${grade}|${section}`;
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (p: number) => setPageState({ key: filterKey, page: p });
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtered = !!search || grade !== "all" || section !== "all";
  const clear = () => { setSearch(""); setGrade("all"); setSection("all"); };
  const podium = !filtered && students.length >= 3 && students.slice(0, 3).every((x) => x.score > 0);
  const s = data?.summary;
  const schoolName = (id: string | null) => data?.schools?.find((x) => x.id === id)?.name;
  const tiles = [
    { label: "Exams", value: s?.exams_count ?? 0, hint: s ? `${s.live} live · ${s.upcoming} upcoming · ${s.closed} closed` : "" },
    { label: "Students sat", value: s?.participants ?? 0, hint: "at least one attempt" },
    { label: "Average score", value: `${s?.avg_score ?? 0}%`, hint: "graded attempts" },
    { label: "Pass rate", value: `${s?.pass_rate ?? 0}%`, hint: "40% or above" },
  ];

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="ex-title">
        <div className="sd-hero-copy">
          <h1 id="ex-title" className="mc-hero-title">Exam performance</h1>
          <p className="sd-status">Exams are scored and ranked separately from daily and course work.</p>
          <div className="sd-hero-actions">
            <button className="sd-btn sd-btn--ghost-dark" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={isFetching ? "animate-spin" : ""} aria-hidden="true" />{isFetching ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>
      </section>

      {data?.schools && data.schools.length > 1 ? (
        <label className="sm-muted" style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
          School
          <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="sd-btn" aria-label="Filter by school">
            <option value="">All schools</option>
            {data.schools.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
          </select>
        </label>
      ) : null}

      <div className="sd-ledger" role="group" aria-label="Exam summary">
        {tiles.map((m) => (
          <div key={m.label}>
            <span className="sd-l">{m.label}</span>
            {isLoading ? <span className="sd-skel" style={{ height: "2.2rem", width: "4rem" }} /> : <b className="sd-n">{m.value}</b>}
            <small>{m.hint}</small>
          </div>
        ))}
      </div>

      {error ? <p className="sm-muted" role="alert">Could not load exam analytics.</p> : null}

      <div className="mc-tabs" role="tablist" aria-label="Exam views" style={{ justifySelf: "start" }}>
        {([["exams", "Exams", data?.exams.length ?? 0], ["students", "Ranking", data?.students.length ?? 0], ["breakdown", "Breakdown", (data?.by_subject.length ?? 0) + (data?.by_exam_type.length ?? 0)]] as const).map(([id, label, n]) => (
          <button key={id} role="tab" className="mc-tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}<b>{n}</b></button>
        ))}
      </div>

      {tab === "exams" && (
        !data?.exams.length && !isLoading && !error ? (
          <section className="sd-panel"><div className="sd-empty"><b>No exams yet</b><p>Exams you create in Assignments show up here once students sit them.</p></div></section>
        ) : (
          <section className="sd-panel as-list mc-swap" aria-label="Exams">
            <div className={`ex-erow aa-head${loadReport ? " ex-erow--dl" : ""}`}><span>Exam</span><span>Status</span><span>Sat</span><span>Average</span><span>Spread</span>{loadReport && <span>Report</span>}</div>
            {data?.exams.map((e) => (
              <article key={e.assignment_id} className={`ex-erow aa-item${loadReport ? " ex-erow--dl" : ""}`}>
                <span className="aa-who"><b>{e.title}</b><small>{[EXAM_TYPE_LABEL[e.exam_type ?? "OTHER"], e.subject, schoolName(e.school_id)].filter(Boolean).join(" · ")}</small><small>{when(e.starts_at)} to {when(e.ends_at)}</small></span>
                <span className="sm-chip" data-class={e.phase === "open" ? "true" : undefined}>{PHASE[e.phase]}</span>
                <span className="ex-n"><b>{e.participants}</b><small>{plural(e.retake_count, "retake")}</small></span>
                {e.graded_count > 0 ? (
                  <>
                    <Meter value={e.avg_score_percentage} />
                    <span className="ex-spread"><small>High {pct(e.highest_score_percentage)} · Low {pct(e.lowest_score_percentage)}</small><small>{pct(e.pass_rate)} passed</small></span>
                  </>
                ) : <span className="sm-muted ex-none">Not graded yet</span>}
                {loadReport && (
                  <button type="button" className="sd-btn sd-btn--line ex-dl" onClick={() => openReport(e.assignment_id)} disabled={reportBusy !== null || e.participants === 0} aria-label={`Download report for ${e.title}`}>
                    {reportBusy === e.assignment_id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}Report
                  </button>
                )}
              </article>
            ))}
          </section>
        )
      )}

      {tab === "students" && (
        !students.length ? (
          !isLoading && <section className="sd-panel"><div className="sd-empty"><b>No graded attempts yet</b><p>Students are ranked once their exam attempts are graded.</p></div></section>
        ) : (
          <>
            {podium && (
              <ol className="aa-podium" aria-label="Top three students">
                {students.slice(0, 3).map((x) => (
                  <li key={x.student_id} data-place={x.rank}>
                    <span className="aa-place">{x.rank}</span>
                    <span className="sd-avatar" aria-hidden="true">{initialsOf(x.name)}</span>
                    <b>{x.name}</b>
                    <small>{classOf(x) || "No class"}</small>
                    <span className="aa-podium-score">{pct(x.score)}</span>
                  </li>
                ))}
              </ol>
            )}
            <div className="aa-bar">
              <input type="search" className="sd-field" placeholder="Search by student name" aria-label="Search students" value={search} onChange={(e) => setSearch(e.target.value)} />
              {grades.length > 1 && <ChipGroup label="Grade" value={grade} options={[["all", "All grades"] as const, ...grades.map((g) => [g, formatGradeBadge(g)] as const)]} onChange={(g) => { setGrade(g); setSection("all"); }} />}
              {sections.length > 1 && <ChipGroup label="Section" value={section} options={[["all", "All sections"] as const, ...sections.map((x) => [x, formatSectionLabel(x)] as const)]} onChange={setSection} />}
              {filtered && <button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button>}
            </div>
            {rows.length === 0 ? (
              <section className="sd-panel"><div className="sd-empty"><b>No students match</b><p>Try a different name, or clear the filters.</p><button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button></div></section>
            ) : (
              <section className="sd-panel as-list mc-swap" aria-label="Exam ranking">
                <div className="ex-rrow aa-head"><span>Rank</span><span>Student</span><span>Class</span><span>Exams</span><span>Average</span></div>
                {pageRows.map((x) => (
                  <article key={x.student_id} className="ex-rrow aa-item">
                    <span className="aa-rank" data-top={x.rank <= 3 ? x.rank : undefined} aria-label={`Rank ${x.rank}`}>{x.rank}</span>
                    <span className="aa-who"><b>{x.name}</b>{schoolName(x.school_id) && <small>{schoolName(x.school_id)}</small>}</span>
                    <span className="sm-chip" data-class={classOf(x) ? "true" : undefined}>{classOf(x) || "No class"}</span>
                    <span className="aa-part">{plural(x.exams_taken, "exam")}</span>
                    <Meter value={x.score} />
                  </article>
                ))}
                <Pager offset={(page - 1) * PAGE_SIZE} count={pageRows.length} total={rows.length} pageSize={PAGE_SIZE} noun="students" onPrev={() => setPage(Math.max(1, page - 1))} onNext={() => setPage(page + 1)} />
              </section>
            )}
          </>
        )
      )}

      {tab === "breakdown" && (
        !data?.by_exam_type.length && !data?.by_subject.length ? (
          !isLoading && <section className="sd-panel"><div className="sd-empty"><b>Nothing to break down yet</b><p>Scores by exam type and subject appear once attempts are graded.</p></div></section>
        ) : (
          <>
            {([["By exam type", (data?.by_exam_type ?? []).map((g) => ({ k: g.exam_type, name: EXAM_TYPE_LABEL[g.exam_type] ?? g.exam_type, ...g }))], ["By subject", (data?.by_subject ?? []).map((g) => ({ k: g.subject, name: g.subject, ...g }))]] as const).map(([title, list]) => list.length > 0 && (
              <section key={title} className="ex-group" aria-label={title}>
                <h2 className="ex-h">{title}</h2>
                <div className="sd-panel as-list mc-swap">
                  {list.map((g) => (
                    <article key={g.k} className="aa-srow aa-item">
                      <span className="aa-who"><b>{g.name}</b><small>{plural(g.submissions, "graded attempt")}</small></span>
                      <Meter value={g.avg_score} />
                      <span className="ex-n">{g.avg_score >= 40 ? "Above pass mark" : "Below pass mark"}</span>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </>
        )
      )}
      {reportDialog}
    </div>
  );
}
