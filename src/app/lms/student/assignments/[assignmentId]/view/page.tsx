"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo } from "react";
import { useStudentAssignment } from "@/hooks/useStudentData";
import { ArrowLeft, Download, FileText, MessageSquare, RotateCcw } from "lucide-react";
import Link from "next/link";
import MCQQuestion from "@/components/student/assignments/questions/MCQQuestion";
import FillBlankQuestion from "@/components/student/assignments/questions/FillBlankQuestion";
import ProtectedAssignmentContent from "@/components/student/assignments/ProtectedAssignmentContent";
import AttemptHistory from "@/components/student/assignments/AttemptHistory";
import ScoreRing, { scoreWords } from "@/components/portal/ScoreRing";

interface Question {
  id: string;
  question?: string;
  question_text?: string;
  question_type?: string;
  options?: string[];
  correct_answer?: number | string | string[];
  marks?: number;
  word_limit?: number;
  order_index?: number;
}

interface AnswerValue {
  type: "mcq" | "essay" | "fill_blank";
  value: number | string | string[];
}

type PageProps = { params: Promise<{ assignmentId: string }> };

export default function ViewSubmissionPage(props: PageProps) {
  const params = React.use(props.params);
  const assignmentId = params.assignmentId;

  const { data, isLoading } = useStudentAssignment(assignmentId);

  const assignment = (data as any)?.assignment as any;
  const submission = (data as any)?.submission as any;
  const attempts = ((data as any)?.attempts ?? []) as any[];
  const retake = (data as any)?.retake as {
    allowed?: boolean;
    max_attempts?: number | null;
    current_attempts?: number;
    scoring_rule?: string;
    enabled?: boolean;
    granted?: boolean;
  } | undefined;
  const questions: Question[] = useMemo(() => assignment?.questions ?? [], [assignment?.questions]);

  // Extract student answers from submission
  const studentAnswers: Record<string, AnswerValue> = useMemo(() => {
    const map: Record<string, AnswerValue> = {};
    if (!submission || !questions.length) return map;
    const raw = submission.answers ?? submission.answers_json ?? {};
    if (typeof raw === "object") {
      Object.entries(raw as Record<string, unknown>).forEach(([qId, val]) => {
        const q = questions.find(q => q.id === qId);
        if (!q) return;
        const qt = q.question_type?.toLowerCase() ?? "";
        if (qt === "mcq") map[q.id] = { type: "mcq", value: typeof val === "number" ? val : parseInt(String(val)) };
        else if (qt === "fillblank" || qt === "fill_blank") map[q.id] = { type: "fill_blank", value: Array.isArray(val) ? val as string[] : [val as string] };
        else if (qt === "essay" && typeof val === "string") map[q.id] = { type: "essay", value: val };
      });
    }
    if (submission.text_content) {
      const eq = questions.find(q => q.question_type?.toLowerCase() === "essay" && !map[q.id]);
      if (eq) map[eq.id] = { type: "essay", value: submission.text_content };
    }
    return map;
  }, [submission, questions]);

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="wr sd-player" aria-busy="true">
        <div className="ls">
          <div className="sd-skel" style={{ height: "2.5rem", width: "60%" }} />
          <div className="sd-skel" style={{ height: "8rem" }} />
        </div>
      </div>
    );
  }

  if (!assignment || !submission) {
    return (
      <div className="wr sd-player">
        <div className="ls">
          <div className="ls-card">
            <span className="ls-card-ico"><FileText aria-hidden="true" /></span>
            <b>Nothing handed in yet</b>
            <p>When you hand this assignment in, your answers will show up here.</p>
            <Link href={`/lms/student/assignments/${assignmentId}`} className="sd-btn sd-btn--ink"><ArrowLeft aria-hidden="true" />Back to the assignment</Link>
          </div>
        </div>
      </div>
    );
  }

  const hasGrade = submission.grade !== null && submission.grade !== undefined;
  const gradeNum = hasGrade ? (typeof submission.grade === "number" ? submission.grade : parseFloat(String(submission.grade))) : null;
  const submittedAt = submission.submitted_at ? new Date(submission.submitted_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : null;

  // ── Render a single reviewed question ──
  const renderQuestion = (q: Question, idx: number) => {
    const qt = (q.question_type?.toLowerCase() ?? "").replace("fillblank", "fill_blank");
    const ans = studentAnswers[q.id];

    return (
      <div key={q.id} className="py-6" style={{ borderBottom: "1.5px solid var(--sd-line)" }}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <span className="qs-q" style={{ margin: 0 }}>Question {idx + 1} of {questions.length}</span>
          <span className="as-fine" style={{ margin: 0 }}>{q.marks ?? 1} point{(q.marks ?? 1) !== 1 ? "s" : ""}</span>
        </div>

        {qt === "mcq" && (
          <MCQQuestion
            question={{
              id: q.id,
              question: q.question || q.question_text || "",
              options: q.options || [],
              correct_answer: Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer,
              marks: q.marks,
            }}
            index={idx}
            totalQuestions={questions.length}
            selectedAnswer={ans?.type === "mcq" && typeof ans.value === "number" ? ans.value : undefined}
            onAnswerChange={() => {}}
            showCorrectAnswer={hasGrade}
            disabled
          />
        )}

        {qt === "essay" && (
          <div>
            <p className="qa-text">{q.question || q.question_text}</p>
            {ans?.type === "essay" && typeof ans.value === "string" && ans.value.trim() ? (
              <div className="ls-note">
                <b>Your answer</b>
                <p style={{ whiteSpace: "pre-wrap" }}>{ans.value}</p>
              </div>
            ) : (
              <p className="qa-none">No answer was handed in for this question.</p>
            )}
            {!hasGrade && <p className="as-fine">Your teacher marks writing questions by hand.</p>}
          </div>
        )}

        {qt === "fill_blank" && (
          <FillBlankQuestion
            question={{
              id: q.id,
              question: q.question || q.question_text || "",
              correct_answer: q.correct_answer as string | string[],
              marks: q.marks,
            }}
            index={idx}
            totalQuestions={questions.length}
            answers={ans?.type === "fill_blank" && Array.isArray(ans.value) ? ans.value as string[] : []}
            onAnswerChange={() => {}}
            showCorrectAnswer={hasGrade}
            disabled
          />
        )}
      </div>
    );
  };

  return (
    <div className="wr sd-player">
      <div className="ls">
        <Link href={`/lms/student/assignments/${assignmentId}`} className="ls-link"><ArrowLeft className="mr-1 inline h-4 w-4" />Back to the assignment</Link>
        <h1 className="ls-title">{assignment.title}</h1>
        <p className="ls-task">{assignment.course_title || "Assignment"}</p>

        <div className="ls-score">
          {gradeNum !== null && <ScoreRing value={gradeNum} />}
          <div className="ls-score-text">
            <b>{hasGrade && gradeNum !== null ? scoreWords(gradeNum) : "Waiting for a grade"}</b>
            <span>{submittedAt ? `Handed in on ${submittedAt}` : "Your teacher will mark it soon."}</span>
          </div>
        </div>

        {submission.feedback && (
          <div className="ls-note">
            <b><MessageSquare className="mr-1.5 inline h-4 w-4" aria-hidden="true" />Teacher feedback</b>
            <p>{submission.feedback}</p>
          </div>
        )}

        {submission.file_url && (
          <a href={submission.file_url} target="_blank" rel="noopener noreferrer" className="sd-btn sd-btn--line" style={{ justifySelf: "start" }}>
            <Download aria-hidden="true" />Download your file
          </a>
        )}

        {questions.length > 0 && (
          <section>
            <h2 className="as-h2" style={{ fontSize: "1.5rem" }}>Your answers</h2>
            {hasGrade && <p className="as-fine" style={{ margin: 0 }}>The right answers are shown too.</p>}
            <ProtectedAssignmentContent>
              {questions.map((q, i) => renderQuestion(q, i))}
            </ProtectedAssignmentContent>
          </section>
        )}

        {/* Show the tries whenever there are several, or a retake is possible */}
        {(attempts.length > 1 || (retake?.enabled && attempts.length >= 1)) && (
          <AttemptHistory
            attempts={attempts}
            note={
              retake?.scoring_rule
                ? retake.scoring_rule === "highest"
                  ? "Your highest score from all your tries is the one that counts."
                  : "Your latest try is the one that counts."
                : undefined
            }
          />
        )}

        {retake?.allowed && (
          <div className="ls-score" style={{ justifyContent: "space-between", background: "rgb(251 191 36 / 0.12)", borderColor: "var(--sd-amber-deep)" }}>
            <div className="ls-score-text">
              <b>You can try again</b>
              <span>
                {retake.granted
                  ? "Your teacher gave you one more try."
                  : retake.max_attempts == null
                  ? "You can try as many times as you like."
                  : `You have used ${retake.current_attempts ?? attempts.length} of ${Number(retake.max_attempts) + 1} tries.`}
              </span>
            </div>
            <Link href={`/lms/student/assignments/${assignmentId}`} className="sd-btn sd-btn--amber"><RotateCcw aria-hidden="true" />Try again</Link>
          </div>
        )}
      </div>
    </div>
  );
}
