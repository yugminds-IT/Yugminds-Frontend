"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo } from "react";
import { useStudentAssignment } from "@/hooks/useStudentData";
import { ArrowLeft, CheckCircle, Clock, Loader2, FileText, Download, MessageSquare, RotateCcw } from "lucide-react";
import Link from "next/link";
import MCQQuestion from "@/components/student/assignments/questions/MCQQuestion";
import EssayQuestion from "@/components/student/assignments/questions/EssayQuestion";
import FillBlankQuestion from "@/components/student/assignments/questions/FillBlankQuestion";

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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!assignment || !submission) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-14 w-14 mx-auto mb-4 text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Submission not found</h2>
          <Link href="/lms/student/assignments" className="text-sm text-blue-600 hover:underline flex items-center gap-1 justify-center">
            <ArrowLeft className="h-4 w-4" /> Back to Assignments
          </Link>
        </div>
      </div>
    );
  }

  const hasGrade = submission.grade !== null && submission.grade !== undefined;
  const gradeNum = hasGrade ? (typeof submission.grade === "number" ? submission.grade : parseFloat(String(submission.grade))) : null;
  const gradeBg = gradeNum == null ? "bg-gray-500" : gradeNum >= 70 ? "bg-green-600" : gradeNum >= 50 ? "bg-amber-500" : "bg-red-600";
  const submittedAt = submission.submitted_at ? new Date(submission.submitted_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : null;

  // ── Render a single reviewed question ──
  const renderQuestion = (q: Question, idx: number) => {
    const qt = (q.question_type?.toLowerCase() ?? "").replace("fillblank", "fill_blank");
    const ans = studentAnswers[q.id];

    return (
      <div key={q.id} className="py-8 border-b border-gray-100 last:border-0">
        {/* Question header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <span className="text-xs text-gray-400 font-medium">
              Question {idx + 1} of {questions.length}
            </span>
          </div>
          <span className="text-sm text-gray-400 flex-shrink-0">
            {q.marks ?? 1} point{(q.marks ?? 1) !== 1 ? "s" : ""}
          </span>
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
            <p className="text-base text-gray-900 leading-relaxed mb-4">{q.question || q.question_text}</p>
            {ans?.type === "essay" && typeof ans.value === "string" && ans.value.trim() ? (
              <div className="px-4 py-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs text-gray-400 font-medium mb-2">Your answer</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{ans.value}</p>
              </div>
            ) : (
              <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-400 italic">No answer submitted for this question.</p>
              </div>
            )}
            {!hasGrade && (
              <p className="text-xs text-gray-400 mt-2">Essay questions are graded manually by your teacher.</p>
            )}
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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <Link
          href={`/lms/student/assignments/${assignmentId}`}
          className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 font-medium border border-blue-200 hover:border-blue-400 px-3 py-1.5 rounded-md transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Assignments
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Title */}
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">{assignment.title}</h1>
        <p className="text-sm text-gray-500 mb-7">{assignment.course_title || "Assignment"}</p>

        {/* Grade / status banner */}
        <div className={`flex items-center justify-between px-5 py-4 rounded-xl mb-6 border ${
          hasGrade ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"
        }`}>
          <div className="flex items-center gap-3">
            {hasGrade
              ? <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              : <Clock className="h-5 w-5 text-blue-600 flex-shrink-0" />
            }
            <div>
              <p className={`text-sm font-semibold ${hasGrade ? "text-green-800" : "text-blue-800"}`}>
                {hasGrade ? "Assignment Graded" : "Awaiting Grade"}
              </p>
              {submittedAt && (
                <p className={`text-xs ${hasGrade ? "text-green-600" : "text-blue-600"}`}>
                  Submitted on {submittedAt}
                </p>
              )}
            </div>
          </div>

          {gradeNum !== null && (
            <div className={`w-14 h-14 rounded-full ${gradeBg} flex items-center justify-center flex-shrink-0`}>
              <span className="text-white font-bold text-sm">{gradeNum}%</span>
            </div>
          )}
        </div>

        {/* Teacher feedback */}
        {submission.feedback && (
          <div className="mb-6 px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-gray-500" />
              <p className="text-sm font-semibold text-gray-700">Teacher Feedback</p>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{submission.feedback}</p>
          </div>
        )}

        {/* File submission download */}
        {submission.file_url && (
          <div className="mb-6">
            <a href={submission.file_url} target="_blank" rel="noopener noreferrer">
              <button className="inline-flex items-center gap-2 text-sm text-blue-700 border border-blue-200 hover:border-blue-400 px-4 py-2 rounded-lg transition-colors">
                <Download className="h-4 w-4" />
                Download Submitted File
              </button>
            </a>
          </div>
        )}

        {/* Your answers section */}
        {questions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900">Your Answers</h2>
              {hasGrade && (
                <span className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Correct answers shown
                </span>
              )}
            </div>
            <div className="border-t border-gray-100">
              {questions.map((q, i) => renderQuestion(q, i))}
            </div>
          </div>
        )}

        {/* Attempt history — show whenever there are multiple attempts OR retake is available */}
        {(attempts.length > 1 || (retake?.enabled && attempts.length >= 1)) && (
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Attempt History</h3>
              <span className="text-xs text-gray-400">
                {retake?.max_attempts != null
                  ? `${attempts.length} of ${Number(retake.max_attempts) + 1} attempts used`
                  : `${attempts.length} attempt${attempts.length !== 1 ? "s" : ""} · Unlimited`}
              </span>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Attempt</th>
                    <th className="px-4 py-2.5 text-left font-medium">Submitted</th>
                    <th className="px-4 py-2.5 text-right font-medium">Score</th>
                    <th className="px-4 py-2.5 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {attempts.map((a: any) => (
                    <tr key={a.id} className="bg-white hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700 font-medium">#{a.attempt_number ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">
                        {a.score != null ? `${a.score}/${a.max_score ?? "—"}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          a.status === "graded" ? "bg-green-100 text-green-700" :
                          a.status === "submitted" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {a.status ?? "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {retake?.scoring_rule && (
              <p className="text-xs text-gray-400 mt-2">
                {retake.scoring_rule === "highest"
                  ? "Your highest score across all attempts is used for grading."
                  : "Your latest attempt score is used for grading."}
              </p>
            )}
          </div>
        )}

        {/* Retake CTA */}
        {retake?.allowed && (
          <div className="mt-6 flex items-center justify-between px-5 py-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Retake available</p>
                <p className="text-xs text-amber-600">
                  {retake.max_attempts == null
                    ? "Unlimited attempts — you can retake any time."
                    : `${retake.current_attempts ?? attempts.length} of ${Number(retake.max_attempts) + 1} attempts used.`}
                </p>
              </div>
            </div>
            <Link
              href={`/lms/student/assignments/${assignmentId}`}
              className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Retake
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
