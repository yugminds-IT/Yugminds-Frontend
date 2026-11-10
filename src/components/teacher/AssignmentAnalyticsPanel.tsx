"use client";

import { useState } from "react";
import { classLabel } from "./overview/utils";

/* Analytics tab of the teacher assignments page — extracted from the
 * ~1500-line page file. Pure display over the analytics payload; the sub-tab
 * selection is local UI state and lives here. */

export type AssignmentAnalyticsSummary = {
  assignments_count: number;
  total_submissions: number;
  graded_count: number;
  avg_score: number;
  retake_count: number;
};

export type AssignmentAnalyticsRow = {
  assignment_id: string;
  title: string;
  subject: string | null;
  assignment_type: string;
  retake_enabled: boolean;
  total_submissions: number;
  graded_count: number;
  retake_count: number;
  avg_score_percentage: number;
  highest_score: number;
  lowest_score: number;
};

export type AssignmentStudentRank = {
  rank: number;
  school_rank?: number;
  grade_rank?: number;
  section_rank?: number;
  student_id: number;
  student_name: string;
  grade?: string;
  section?: string;
  course_score: number;
  daily_score: number;
  overall_score: number;
};

export type AssignmentSubjectStat = { subject: string; avg_score: number; submissions: number };

export type AssignmentAnalyticsData = {
  summary: AssignmentAnalyticsSummary;
  assignments: AssignmentAnalyticsRow[];
  top_students: AssignmentStudentRank[];
  subject_breakdown: AssignmentSubjectStat[];
};

const pctClass = (pct: number) => (pct < 50 ? "low" : undefined);

function Pct({ pct, label }: { pct: number; label?: string }) {
  return (
    <span className="tg-pct">
      <b>{pct.toFixed(1)}%</b>
      <span className="sd-meter" data-t={pctClass(pct)}><i style={{ "--p": `${Math.min(100, Math.max(0, pct))}%` } as React.CSSProperties} /></span>
      {label && <small className="tg-note">{label}</small>}
    </span>
  );
}

/** Scores and rankings across your assignments: who is doing well, which assignments were hard, which subjects lag. */
export default function AssignmentAnalyticsPanel({ loading, data }: { loading: boolean; data: AssignmentAnalyticsData | null }) {
  const [subTab, setSubTab] = useState<"leaderboard" | "assignments" | "subjects">("leaderboard");

  if (loading) {
    return <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>;
  }
  if (!data) {
    return (
      <div className="sd-panel">
        <div className="sd-empty"><b>No analytics yet</b><p>Numbers appear once students start handing in your assignments.</p></div>
      </div>
    );
  }

  const tiles = [
    { label: "Assignments", value: data.summary.assignments_count, hint: "Set so far" },
    { label: "Submissions", value: data.summary.total_submissions, hint: `${data.summary.retake_count ?? 0} of them retakes` },
    { label: "Graded", value: data.summary.graded_count, hint: `${Math.max(0, data.summary.total_submissions - data.summary.graded_count)} still to grade` },
    { label: "Average score", value: `${(data.summary.avg_score ?? 0).toFixed(1)}%`, hint: "Across graded work" },
  ];
  const students = data.top_students ?? [];
  const rows = data.assignments ?? [];
  const subjects = data.subject_breakdown ?? [];

  return (
    <div className="tg-detail" style={{ gap: "1rem" }}>
      <div className="sd-ledger" role="group" aria-label="Assignment numbers">
        {tiles.map((t) => (
          <div key={t.label}><span className="sd-l">{t.label}</span><b className="sd-n">{t.value}</b><small>{t.hint}</small></div>
        ))}
      </div>

      <div className="mc-tabs" role="tablist" aria-label="Analytics views" style={{ justifySelf: "start" }}>
        {([["leaderboard", "Leaderboard"], ["assignments", "Assignments"], ["subjects", "Subjects"]] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={subTab === key} className="mc-tab" onClick={() => setSubTab(key)}>{label}</button>
        ))}
      </div>

      {subTab === "leaderboard" && (
        <div className="sd-panel as-list">
          <div className="sd-panel-head" style={{ margin: 0, padding: "1.25rem 1.25rem 0.9rem" }}>
            <div><h2>Student rankings</h2><p>Overall is 60% course and 40% daily work, or just the one a student has.</p></div>
          </div>
          {students.length === 0 ? (
            <div className="sd-empty" style={{ padding: "0 1.25rem 1.25rem" }}><b>No rankings yet</b><p>Rankings appear once students have graded work.</p></div>
          ) : (
            <div className="tg-line">
              {students.map((st) => {
                const rank = st.school_rank ?? st.rank;
                return (
                  <div key={st.student_id} className="tg-rank" data-top={rank <= 3}>
                    <i>{rank}</i>
                    <span className="tg-who"><b>{st.student_name}</b><small>{classLabel(st.grade, st.section) || "No class"}</small></span>
                    <span className="tg-num">{st.course_score.toFixed(0)}<small>course</small></span>
                    <span className="tg-num">{st.daily_score.toFixed(0)}<small>daily</small></span>
                    <Pct pct={st.overall_score} label="overall" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === "assignments" && (
        <div className="sd-panel as-list">
          <div className="sd-panel-head" style={{ margin: 0, padding: "1.25rem 1.25rem 0.9rem" }}>
            <div><h2>How each assignment went</h2><p>Average score across graded submissions</p></div>
          </div>
          {rows.length === 0 ? (
            <div className="sd-empty" style={{ padding: "0 1.25rem 1.25rem" }}><b>Nothing to show yet</b><p>Assignments appear here once they have submissions.</p></div>
          ) : (
            <div className="tg-line">
              {rows.map((r) => (
                <div key={r.assignment_id} className="tg-perf">
                  <span className="tg-who"><b>{r.title}</b><small>{[r.subject, r.assignment_type === "COURSE" ? "Course" : "Daily"].filter(Boolean).join(", ")}</small></span>
                  <span className="tg-num">{r.total_submissions}<small>submitted</small></span>
                  <span className="tg-num">{r.graded_count}<small>graded</small></span>
                  <Pct pct={r.avg_score_percentage} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === "subjects" && (
        <div className="sd-panel as-list">
          <div className="sd-panel-head" style={{ margin: 0, padding: "1.25rem 1.25rem 0.9rem" }}>
            <div><h2>How each subject went</h2><p>Average score by subject</p></div>
          </div>
          {subjects.length === 0 ? (
            <div className="sd-empty" style={{ padding: "0 1.25rem 1.25rem" }}><b>No subjects yet</b><p>Set a subject on an assignment and it shows up here.</p></div>
          ) : (
            <div className="tg-line">
              {subjects.map((r) => (
                <div key={r.subject} className="tg-subj">
                  <div><b>{r.subject}</b><small>{r.submissions} {r.submissions === 1 ? "submission" : "submissions"}</small></div>
                  <Pct pct={r.avg_score} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
