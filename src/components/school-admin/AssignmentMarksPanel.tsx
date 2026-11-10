"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { ChipGroup, Pager, initialsOf } from "../portal/notifications";
import { bandOf } from "./analytics/types";
import { formatGradeBadge, formatSectionLabel } from "./student-utils";
import "./students.css";
import "./teachers.css";
import "./analytics/analytics.css";

type MarksStudent = {
  student_id: number;
  student_name: string;
  grade: string | null;
  section: string | null;
  attempts: number;
  score: number | null;
  max_score: number | null;
  percent: number | null;
  status: "graded" | "pending";
  submitted_at: string;
};

type MarksData = {
  assignment: {
    id: string;
    title: string;
    assignment_type: string;
    subject: string | null;
    total_marks: number | null;
    scoring_rule: string;
  };
  students: MarksStudent[];
};

type Filter = "all" | "graded" | "pending";
const PAGE_SIZE = 25;

const classLabel = (s: MarksStudent) =>
  [formatGradeBadge(s.grade), s.section && formatSectionLabel(s.section).replace(/^section\s*/i, "")].filter(Boolean).join(" ");

/** Every student who has submitted this assignment, with their mark. Opens from the Assignments tab. */
export function AssignmentMarksPanel({ assignmentId, onBack }: { assignmentId: string; onBack: () => void }) {
  const [data, setData] = useState<MarksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [pageState, setPageState] = useState({ key: "", page: 1 });

  useEffect(() => {
    let cancelled = false;
    schoolAdminApi.stats
      .assignmentMarks(assignmentId)
      .then(({ data: res }) => { if (!cancelled) setData(res as MarksData); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [assignmentId]);

  const students = useMemo(() => data?.students ?? [], [data]);
  const classes = useMemo(
    () => [...new Set(students.map(classLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [students],
  );
  const gradedCount = students.filter((s) => s.status === "graded").length;
  const withScore = students.filter((s) => s.percent != null);
  const avg = withScore.length ? Math.round(withScore.reduce((sum, s) => sum + (s.percent ?? 0), 0) / withScore.length) : null;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter(
      (s) =>
        (filter === "all" || s.status === filter) &&
        (classFilter === "all" || classLabel(s) === classFilter) &&
        (!q || s.student_name.toLowerCase().includes(q) || classLabel(s).toLowerCase().includes(q)),
    );
  }, [students, filter, classFilter, search]);

  const filterKey = `${search}|${filter}|${classFilter}`;
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (p: number) => setPageState({ key: filterKey, page: p });
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = !!search || filter !== "all" || classFilter !== "all";
  const clear = () => { setSearch(""); setFilter("all"); setClassFilter("all"); };

  const a = data?.assignment;

  return (
    <div className="aa-marks">
      <button className="aa-back" onClick={onBack}><ArrowLeft aria-hidden="true" />All assignments</button>

      {loading ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : error || !a ? (
        <section className="sd-panel">
          <div className="sd-empty"><b>We could not load these marks</b><p>Check your connection, then go back and open the assignment again.</p><button className="sd-btn sd-btn--line" onClick={onBack}>Back to assignments</button></div>
        </section>
      ) : (
        <>
          <header className="aa-marks-head">
            <h2>{a.title}</h2>
            <p>
              <span className="sm-chip" data-class="true">{a.assignment_type === "COURSE" ? "Course" : "Daily"}</span>
              {a.subject && <span>{a.subject}</span>}
              {a.total_marks != null && <span>{a.total_marks} marks</span>}
            </p>
          </header>

          <div className="sd-ledger" data-cols="3" role="group" aria-label="Marks summary">
            <div><span className="sd-l">Submitted</span><b className="sd-n">{students.length}</b><small>From your school</small></div>
            <div><span className="sd-l">Graded</span><b className="sd-n">{gradedCount}</b><small>{students.length - gradedCount} waiting for a grade</small></div>
            <div><span className="sd-l">Average</span><b className="sd-n">{avg == null ? "–" : `${avg}%`}</b><small>{a.scoring_rule === "highest" ? "Each student’s highest graded attempt" : "Of graded attempts"}</small></div>
          </div>

          {students.length === 0 ? (
            <section className="sd-panel"><div className="sd-empty"><b>Nobody has submitted yet</b><p>No students from your school have submitted this assignment. Marks show up here as they do.</p></div></section>
          ) : (
            <>
              <div className="aa-bar">
                <input type="search" className="sd-field" placeholder="Search by student or class" aria-label="Search students" value={search} onChange={(e) => setSearch(e.target.value)} />
                {classes.length > 1 && (
                  <select className="sd-field" aria-label="Class" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                    <option value="all">All classes</option>
                    {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                <ChipGroup
                  label="Status"
                  value={filter}
                  options={[["all", `All ${students.length}`], ["graded", `Graded ${gradedCount}`], ["pending", `Pending ${students.length - gradedCount}`]] as const}
                  onChange={setFilter}
                />
                {hasFilters && <button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button>}
              </div>

              {rows.length === 0 ? (
                <section className="sd-panel"><div className="sd-empty"><b>No students match</b><p>Try a different name, or clear the filters.</p><button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button></div></section>
              ) : (
                <section className="sd-panel as-list mc-swap" aria-label="Marks">
                  <div className="aa-mrow aa-head"><span /><span>Student</span><span>Class</span><span>Attempts</span><span>Score</span><span>Status</span></div>
                  {pageRows.map((s) => {
                    const cls = classLabel(s);
                    const band = s.percent == null ? "none" : bandOf(s.percent);
                    return (
                      <article key={s.student_id} className="aa-mrow aa-item">
                        <span className="sd-avatar" aria-hidden="true">{initialsOf(s.student_name)}</span>
                        <span className="aa-who"><b>{s.student_name}</b></span>
                        <span className="sm-chip" data-class={cls ? "true" : undefined}>{cls || "No class"}</span>
                        <span className="aa-part">{s.attempts} {s.attempts === 1 ? "attempt" : "attempts"}</span>
                        <span className="aa-score" data-band={band}>
                          {s.score != null ? (
                            <>
                              <b>{s.score}/{s.max_score ?? "–"}{s.percent != null && <small> {s.percent}%</small>}</b>
                              {s.percent != null && <i className="tm-bar" aria-hidden="true"><u style={{ width: `${Math.min(100, s.percent)}%` }} /></i>}
                            </>
                          ) : <span className="sm-muted">No score</span>}
                        </span>
                        <span className="aa-state" data-state={s.status}>{s.status === "graded" ? "Graded" : "Waiting for grade"}</span>
                      </article>
                    );
                  })}
                  <Pager offset={(page - 1) * PAGE_SIZE} count={pageRows.length} total={rows.length} pageSize={PAGE_SIZE} noun="students" onPrev={() => setPage(Math.max(1, page - 1))} onNext={() => setPage(page + 1)} />
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
