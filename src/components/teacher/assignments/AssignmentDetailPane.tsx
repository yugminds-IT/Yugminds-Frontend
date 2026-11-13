"use client";

import { typeLabel, EXAM_TYPE_LABEL, fmtWindow } from "@/lib/assignment-types";
import { useState } from "react";
import { ArrowLeft, Check, ChevronDown, Download, Eye, EyeOff, Loader2, Lock, Pencil, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import type { TeacherClass } from "@/components/teacher/AssignmentAudiencePicker";
import { classLabel, plural } from "@/components/teacher/overview/utils";
import {
  StatusPill,
  dueClosesAtMs,
  Avatar,
  audienceChipLabel,
  stageOf,
  type TeacherAssignment,
  type AssignmentDetail,
  type StudentRow,
  type NotSubmittedStudent,
  type SubFilter,
  type DetailTab,
} from "./assignments-shared";
import ReportDownloadDialog from "./ReportDownloadDialog";

type Props = {
  tab: "daily" | "course" | "exam";
  selectedAssignment: TeacherAssignment | null;
  assignmentDetail: AssignmentDetail | null;
  detailLoading: boolean;
  detailTab: DetailTab;
  onDetailTabChange: (t: DetailTab) => void;
  onBack?: () => void;
  loading: boolean;
  teacherClasses: TeacherClass[];
  submissionsCount: number;
  gradedCount: number;
  pendingCount: number;
  // actions
  onEdit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
  onOpenRetakeForAll: () => void;
  onGrantRetake: (studentId: number) => void;
  onRevokeRetake: (studentId: number) => void;
  grantingStudentId: number | null;
  // submissions
  studentRows: StudentRow[];
  filteredStudentRows: StudentRow[];
  subSearch: string;
  onSubSearchChange: (v: string) => void;
  notSubmitted: NotSubmittedStudent[];
  filteredNotSubmitted: NotSubmittedStudent[];
  subFilter: SubFilter;
  onSubFilterChange: (v: SubFilter) => void;
  expanded: Set<number>;
  onToggleExpand: (studentId: number) => void;
  grading: Record<string, { score: string; feedback: string }>;
  onGradingChange: (
    id: string,
    patch: Partial<{ score: string; feedback: string }>,
  ) => void;
  onGrade: (submissionId: string) => void;
  retakeRuleLabel: string;
  // grant retake filters
  grantSearch: string;
  onGrantSearchChange: (v: string) => void;
  grantFilter: "all" | "graded" | "pending";
  onGrantFilterChange: (v: "all" | "graded" | "pending") => void;
  filteredGrantRows: StudentRow[];
};

const FILTERS: Record<string, string> = { all: "All", graded: "Graded", pending: "Waiting", not_submitted: "Not submitted" };

function FilterChips<K extends SubFilter>({ value, onChange, counts, label }: { value: K; onChange: (v: K) => void; counts: Record<K, number>; label: string }) {
  return (
    <div className="as-chips" role="group" aria-label={label}>
      {(Object.keys(counts) as K[]).map((f) => (
        <button key={f} type="button" className="as-chip" aria-pressed={value === f} onClick={() => onChange(f)}>
          {FILTERS[f] ?? f}<b>{counts[f]}</b>
        </button>
      ))}
    </div>
  );
}

const pctOf = (score: number | null | undefined, max: number | null | undefined) => (score != null && max ? Math.round((score / max) * 100) : null);
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");

/** One assignment: who has handed it in and how they scored, its questions, and who may retake it. */
export default function AssignmentDetailPane(props: Props) {
  const {
    tab, selectedAssignment, assignmentDetail, detailLoading, detailTab, onDetailTabChange, onBack, loading, teacherClasses,
    submissionsCount, gradedCount, pendingCount, onEdit, onTogglePublish, onDelete, onOpenRetakeForAll, onGrantRetake, onRevokeRetake,
    grantingStudentId, studentRows, filteredStudentRows, notSubmitted, filteredNotSubmitted, subSearch, onSubSearchChange, subFilter,
    onSubFilterChange, expanded, onToggleExpand, grading, onGradingChange, onGrade, retakeRuleLabel, grantSearch, onGrantSearchChange,
    grantFilter, onGrantFilterChange, filteredGrantRows,
  } = props;
  const [reportOpen, setReportOpen] = useState(false);
  const [now] = useState(() => Date.now());

  if (!selectedAssignment) {
    return (
      <div className="sd-panel tg-detail">
        <div className="tg-empty">
          <b>Pick an assignment</b>
          <p>Open one from the list to see who has handed it in, grade it, and manage retakes.</p>
        </div>
      </div>
    );
  }

  const a = selectedAssignment;
  const audience = audienceChipLabel(a, teacherClasses);
  const filterCounts = { all: studentRows.length, graded: studentRows.filter((r) => r.best).length, pending: studentRows.filter((r) => !r.best).length };
  const subFilterCounts = { ...filterCounts, not_submitted: notSubmitted.length };
  const locked = tab !== "course" && !detailLoading && (a.is_published || (a.submission_count ?? 0) > 0 || (assignmentDetail?.submission_count ?? 0) > 0);
  const hasSubs = (a.submission_count ?? assignmentDetail?.submission_count ?? 0) > 0;
  const questions = assignmentDetail?.questions ?? [];

  return (
    <div className="sd-panel tg-detail">
      {onBack && <button type="button" className="tg-back" onClick={onBack}><ArrowLeft aria-hidden="true" />Back to the list</button>}

      <div className="tg-head">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="tg-badges">
            <StatusPill stage={stageOf(a, now)} />
            {stageOf(a, now) === "past" && a.assignment_type !== "EXAM" && <span className="tg-chip" data-s="draft">{a.late_policy === "close" || (a.close_date && dueClosesAtMs(a.close_date) < now) ? "Closed to submissions" : a.close_date ? `Late until ${new Date(a.close_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}` : "Accepting late"}</span>}
            <span className="tg-chip">{typeLabel(tab === "course" ? "COURSE" : a.assignment_type ?? tab.toUpperCase())}</span>
            {tab === "exam" && <span className="tg-chip">{EXAM_TYPE_LABEL[a.exam_type ?? "OTHER"] ?? "Exam"}</span>}
          </div>
          <h2>{a.title}</h2>
          <p>
            {[a.subject ?? "General", audience, a.total_marks ? `${a.total_marks} marks` : null, tab === "exam" ? `${fmtWindow(a.starts_at, a.ends_at)}${a.duration_minutes ? `, ${a.duration_minutes} min` : ""}` : a.due_date ? `Due ${new Date(a.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : null].filter(Boolean).join(", ")}
          </p>
        </div>
        <div className="tg-acts">
          {tab !== "course" && <button type="button" className="sd-btn sd-btn--line" onClick={onEdit} disabled={loading}><Pencil aria-hidden="true" />Edit</button>}
          <button type="button" className="sd-btn sd-btn--line" onClick={onTogglePublish} disabled={loading}>
            {a.is_published ? <><EyeOff aria-hidden="true" />Unpublish</> : <><Eye aria-hidden="true" />Publish</>}
          </button>
          {tab !== "course" && <button type="button" className="sd-btn sd-btn--danger" onClick={onDelete} disabled={loading}><Trash2 aria-hidden="true" />Delete</button>}
        </div>
      </div>

      <div className="tg-facts" role="group" aria-label="Where this assignment stands">
        <div><b>{studentRows.length}</b><small>Handed in</small></div>
        <div data-hot={notSubmitted.length > 0}><b>{notSubmitted.length}</b><small>Not handed in</small></div>
        <div><b>{submissionsCount}</b><small>{submissionsCount === 1 ? "Attempt" : "Attempts"}</small></div>
        <div><b>{gradedCount}</b><small>Graded</small></div>
        <div><b>{pendingCount}</b><small>To grade</small></div>
      </div>

      <div className="mc-tabs" role="tablist" aria-label="Assignment sections" style={{ justifySelf: "start" }}>
        {([["submissions", "Submissions", studentRows.length], ["questions", "Questions", questions.length], ["retake", "Retakes", null]] as const).map(([key, label, n]) => (
          <button key={key} type="button" role="tab" aria-selected={detailTab === key} className="mc-tab" onClick={() => onDetailTabChange(key)}>
            {label}{n != null && <b>{n}</b>}
          </button>
        ))}
      </div>

      {detailTab === "submissions" && (
        <div className="tg-detail" style={{ gap: "0.9rem" }}>
          <div className="tg-bar">
            <input type="search" className="sd-field" placeholder="Search students" aria-label="Search students" value={subSearch} onChange={(e) => onSubSearchChange(e.target.value)} />
            <FilterChips label="Show" value={subFilter} onChange={onSubFilterChange} counts={subFilterCounts} />
            <button type="button" className="sd-btn sd-btn--line tg-btn" onClick={() => setReportOpen(true)} disabled={studentRows.length + notSubmitted.length === 0}><Download aria-hidden="true" />Download report</button>
          </div>
          {reportOpen && <ReportDownloadDialog assignment={a} rows={studentRows} missing={notSubmitted} onClose={() => setReportOpen(false)} />}

          {subFilter === "not_submitted" ? (
            filteredNotSubmitted.length === 0 ? (
              <div className="sd-empty"><b>{notSubmitted.length === 0 ? "Everyone has handed it in" : "No students match"}</b><p>{notSubmitted.length === 0 ? "Every student this was set for has submitted." : "Try a different search."}</p></div>
            ) : (
              <div className="tg-rows">
                {filteredNotSubmitted.map((row) => (
                  <div key={row.student_id} className="tg-item-wrap">
                    <div className="tg-srow" style={{ gridTemplateColumns: "2.4rem minmax(0, 1fr) auto" }}>
                      <Avatar name={row.student_name} />
                      <span className="tg-who"><b>{row.student_name}</b><small>{classLabel(row.grade, row.section) || "No class"}</small></span>
                      <span className="tg-chip" data-s="missing">Not handed in</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : studentRows.length === 0 ? (
            <div className="sd-empty"><b>No submissions yet</b><p>Students have not handed this in. They show up here as they do.</p></div>
          ) : filteredStudentRows.length === 0 ? (
            <div className="sd-empty"><b>No students match</b><p>Try a different search or filter.</p></div>
          ) : (
            <div className="tg-rows">
              <div className="tg-srow tg-head-row"><span /><span>Student</span><span>Attempts</span><span>{retakeRuleLabel}</span><span>Status</span><span /></div>
              {filteredStudentRows.map((row) => {
                const open = expanded.has(row.student_id);
                const best = row.best;
                const pct = pctOf(best?.score, best?.max_score);
                const many = row.attempts.length > 1;
                return (
                  <div key={row.student_id} className="tg-item-wrap">
                    <div className="tg-srow">
                      <Avatar name={row.student_name} />
                      <button type="button" className="tg-who" onClick={() => onToggleExpand(row.student_id)} aria-expanded={open}>
                        <b>{row.student_name}</b>
                        <small>{classLabel(row.grade, row.section) || "No class"}</small>
                      </button>
                      <span className="tg-tries">{many && <RotateCcw aria-hidden="true" />}{plural(row.attempts.length, "try", "tries")}</span>
                      <span className="tg-score" data-none={!best}>
                        {best ? (
                          <>
                            <b>{best.score}/{best.max_score}{pct != null && <> <small>{pct}%</small></>}</b>
                            {pct != null && <span className="sd-meter" data-t={pct < 50 ? "low" : undefined}><i style={{ "--p": `${pct}%` } as React.CSSProperties} /></span>}
                          </>
                        ) : <b>{row.latest.status !== "graded" ? "Waiting" : "–"}</b>}
                      </span>
                      <span className="tg-chip" data-s={best ? "graded" : "pending"}>{best ? "Graded" : "To grade"}</span>
                      <button type="button" className="pl-ico" onClick={() => onToggleExpand(row.student_id)} aria-label={`${open ? "Hide" : "Show"} attempts for ${row.student_name}`} aria-expanded={open}>
                        <ChevronDown style={{ transition: "rotate 0.2s ease", rotate: open ? "180deg" : "0deg" }} />
                      </button>
                    </div>
                    {open && (
                      <div className="tg-attempts">
                        <ol aria-label={`Attempts by ${row.student_name}`}>
                          {row.attempts.map((att) => (
                            <li key={att.id} className="tg-att" data-best={att.id === best?.id}>
                              <span><b>Attempt {att.attempt_number}</b><small>{when(att.submitted_at)}</small></span>
                              <span>{att.is_retake ? "Retake" : "First try"}{att.is_late && <small> · Late</small>}</span>
                              <span>{att.status === "graded" ? <b>{att.score}/{att.max_score}</b> : "–"}{att.id === best?.id && <small>Counts: {retakeRuleLabel.toLowerCase()}</small>}</span>
                              {att.status !== "graded" ? (
                                <span className="tg-grade">
                                  <input type="number" className="sd-field" placeholder="Score" aria-label={`Score for attempt ${att.attempt_number}`} value={grading[att.id]?.score ?? ""} onChange={(e) => onGradingChange(att.id, { score: e.target.value })} />
                                  <input type="text" className="sd-field" placeholder="Feedback" aria-label={`Feedback for attempt ${att.attempt_number}`} value={grading[att.id]?.feedback ?? ""} onChange={(e) => onGradingChange(att.id, { feedback: e.target.value })} />
                                  <button type="button" className="sd-btn sd-btn--amber tg-btn" onClick={() => onGrade(att.id)} disabled={loading}><Check aria-hidden="true" />Grade</button>
                                </span>
                              ) : (
                                <span className="tg-att-last"><span className="tg-chip" data-s="graded"><Check aria-hidden="true" />Graded</span>{att.feedback && <span className="tg-note"> {att.feedback}</span>}</span>
                              )}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {detailTab === "questions" && (
        <div className="tg-detail" style={{ gap: "0.9rem" }}>
          <div className="tg-head">
            <div>
              <p style={{ marginTop: 0 }}>{detailLoading ? "Loading questions…" : plural(questions.length, "question")}</p>
              {assignmentDetail?.description && <p className="tg-note">{assignmentDetail.description}</p>}
              {locked && <p className="tg-lock"><Lock aria-hidden="true" />Questions are locked {hasSubs ? "because students have handed this in" : "while it is published"}.</p>}
            </div>
            {tab !== "course" && <button type="button" className="sd-btn sd-btn--line" onClick={onEdit} disabled={loading || detailLoading}><Pencil aria-hidden="true" />Edit</button>}
          </div>

          {detailLoading ? (
            <div className="sd-skel" style={{ height: "8rem" }} />
          ) : questions.length === 0 ? (
            <div className="sd-empty"><b>No questions yet</b><p>{tab !== "course" ? "Edit this assignment to add questions." : "This course assignment has no questions attached."}</p></div>
          ) : (
            <ol className="tg-qs">
              {questions.map((q, i) => {
                const options = Array.isArray(q.options) ? q.options : [];
                const answer = (q.correct_answer || "").trim();
                return (
                  <li key={q.id || i} className="tg-q">
                    <div>
                      <p>{q.question_text}</p>
                      <small>{q.question_type === "FillBlank" ? "Fill in the blank" : "Multiple choice"}, {plural(q.marks, "mark")}</small>
                      {q.question_type !== "FillBlank" && options.length > 0 && (
                        <ul className="tg-opts">
                          {options.map((o, oi) => (
                            <li key={oi} data-ok={o.trim().toLowerCase() === answer.toLowerCase()}>{String.fromCharCode(65 + oi)}. {o}</li>
                          ))}
                        </ul>
                      )}
                      {q.question_type === "FillBlank" && (
                        <small style={{ margin: 0 }}>
                          Answer: <b style={{ color: "var(--sd-ink)" }}>{answer || "–"}</b>
                          {options.length > 0 && <> . Wrong choices: {options.join(", ")}</>}
                        </small>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {detailTab === "retake" && (
        <div className="tg-detail" style={{ gap: "0.9rem" }}>
          <div className="tg-box">
            <div>
              <b>Open a retake for everyone</b>
              <p>Lets every student who has handed this in try again. The {retakeRuleLabel.toLowerCase()} counts.</p>
            </div>
            <button type="button" className="sd-btn sd-btn--ink tg-btn" onClick={onOpenRetakeForAll} disabled={loading}><RefreshCw aria-hidden="true" />Open the window</button>
          </div>

          <div>
            <h3 className="tg-h3">Give one student a retake</h3>
            <p className="tg-note">Anyone who has already handed it in.</p>
          </div>

          {studentRows.length === 0 ? (
            <div className="sd-empty"><b>Nobody has handed it in yet</b><p>Students must submit before you can give them a retake.</p></div>
          ) : (
            <>
              <div className="tg-bar">
                <input type="search" className="sd-field" placeholder="Search by name, grade or section" aria-label="Search students for a retake" value={grantSearch} onChange={(e) => onGrantSearchChange(e.target.value)} />
                <FilterChips label="Show" value={grantFilter} onChange={(v) => onGrantFilterChange(v as "all" | "graded" | "pending")} counts={filterCounts as Record<SubFilter, number>} />
              </div>
              {filteredGrantRows.length === 0 ? (
                <div className="sd-empty"><b>No students match</b><p>Try a different search.</p></div>
              ) : (
                <div className="tg-rows">
                  {filteredGrantRows.map((row) => {
                    const busy = grantingStudentId === row.student_id;
                    return (
                      <div key={row.student_id} className="tg-item-wrap">
                        <div className="tg-grant">
                          <Avatar name={row.student_name} />
                          <span className="tg-who"><b>{row.student_name}</b><small>{classLabel(row.grade, row.section) || "No class"}</small></span>
                          <span className="tg-tries">{plural(row.attempts.length, "try", "tries")}</span>
                          <span className="tg-score" data-none={!row.best}><b>{row.best ? `${row.best.score}/${row.best.max_score}` : "Waiting"}</b></span>
                          <span>
                            {row.retake_granted ? <span className="tg-chip" data-s="granted">Granted{row.retake_grant_count > 1 ? ` x${row.retake_grant_count}` : ""}</span>
                              : row.retake_grant_count > 0 ? <span className="tg-note">Used or revoked (x{row.retake_grant_count})</span> : null}
                          </span>
                          {row.retake_granted ? (
                            <button type="button" className="sd-btn sd-btn--line tg-btn" onClick={() => onRevokeRetake(row.student_id)} disabled={loading || busy}>
                              {busy ? <><Loader2 className="animate-spin" aria-hidden="true" />Updating</> : "Revoke"}
                            </button>
                          ) : (
                            <button type="button" className="sd-btn sd-btn--ink tg-btn" onClick={() => onGrantRetake(row.student_id)} disabled={loading || busy}>
                              {busy ? <><Loader2 className="animate-spin" aria-hidden="true" />Granting</> : <><RotateCcw aria-hidden="true" />Give retake</>}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
