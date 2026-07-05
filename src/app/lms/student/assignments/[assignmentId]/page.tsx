"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle, Clock, AlertCircle, Globe, Loader2, RotateCcw, FileText, Upload } from "lucide-react";
import Link from "next/link";
import { useStudentAssignment, useSubmitAssignment } from "@/hooks/useStudentData";
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm";
import { loadFormData, clearFormData } from "@/lib/form-persistence";
import MCQQuestion from "@/components/student/assignments/questions/MCQQuestion";
import EssayQuestion from "@/components/student/assignments/questions/EssayQuestion";
import FillBlankQuestion from "@/components/student/assignments/questions/FillBlankQuestion";
import { apiClient } from "@/lib/api";
import { getStoredUserId } from "@/lib/session-utils";
import { useToast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { studentApi } from "@/lib/api/student.api";

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

type PageProps = {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatDue(date: Date | null): string {
  if (!date) return "No due date";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

export default function AssignmentDetailPage(props: PageProps) {
  const router = useRouter();
  const params = React.use(props.params);
  const assignmentId = params.assignmentId;
  const toast = useToast();

  const { data, isLoading } = useStudentAssignment(assignmentId);
  const submitAssignment = useSubmitAssignment();

  const savedData =
    typeof window !== "undefined"
      ? loadFormData<{ answers: Record<string, AnswerValue>; fileName?: string }>(`student-assignment-${assignmentId}`)
      : null;

  const [mode, setMode] = useState<"overview" | "taking">("overview");
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(savedData?.answers || {});
  const [fileUpload, setFileUpload] = useState<File | null>(null);
  const [fileUploadName, setFileUploadName] = useState<string | null>(savedData?.fileName || null);
  const [submitting, setSubmitting] = useState(false);

  const assignment = (data as any)?.assignment as any;
  const submission = (data as any)?.submission as any;
  const attempts = ((data as any)?.attempts ?? []) as any[];
  const retake = (data as any)?.retake as {
    enabled?: boolean;
    allowed?: boolean;
    max_attempts?: number | null;
    current_attempts?: number;
    scoring_rule?: string;
  } | undefined;
  const questions: Question[] = useMemo(() => assignment?.questions ?? [], [assignment?.questions]);

  const effectiveType = useMemo(() => {
    if (assignment?.assignment_type) return assignment.assignment_type.toLowerCase();
    if (questions.length > 0 && questions[0]?.question_type) {
      const qt = questions[0].question_type.toLowerCase();
      if (qt === "mcq" || qt === "essay" || qt === "fill_blank" || qt === "fillblank") return qt;
      if (questions[0].options?.length) return "mcq";
    }
    return "essay";
  }, [assignment, questions]);

  const answeredCount = useMemo(() => questions.filter(q => {
    const a = answers[q.id];
    if (!a) return false;
    if (a.type === "mcq") return typeof a.value === "number" && a.value >= 0;
    if (a.type === "essay") return typeof a.value === "string" && a.value.trim().length > 0;
    if (a.type === "fill_blank") return Array.isArray(a.value) && (a.value as string[]).some(v => v?.trim().length > 0);
    return false;
  }).length, [answers, questions]);

  const hasGrade = submission?.grade !== null && submission?.grade !== undefined;
  const isSubmitted = !!(submission && (submission.status === "submitted" || submission.status === "graded" || hasGrade || submission.submitted_at));
  const canRetake = !!retake?.allowed;

  const { clearSavedData } = useAutoSaveForm({
    formId: `student-assignment-${assignmentId}`,
    formData: { answers, fileName: fileUploadName || fileUpload?.name || undefined },
    autoSave: true,
    autoSaveInterval: 2000,
    debounceDelay: 500,
    useSession: true,
    onLoad: (d) => {
      if (d && !submission) {
        if (d.answers) setAnswers(d.answers);
        if (d.fileName) setFileUploadName(d.fileName);
      }
    },
    markDirty: true,
  });

  // Populate answers from existing submission
  useEffect(() => {
    if (!submission || !questions.length) return;
    const map: Record<string, AnswerValue> = {};
    const raw = submission.answers ?? submission.answers_json ?? {};
    if (typeof raw === "object") {
      Object.entries(raw as Record<string, unknown>).forEach(([qId, val]) => {
        const q = questions.find(q => q.id === qId);
        if (!q) return;
        const qt = q.question_type?.toLowerCase() ?? "";
        if (qt === "mcq") map[q.id] = { type: "mcq", value: typeof val === "number" ? val : parseInt(String(val)) };
        else if (qt === "fillblank" || qt === "fill_blank") map[q.id] = { type: "fill_blank", value: Array.isArray(val) ? val : [val as string] };
        else if (qt === "essay" && typeof val === "string") map[q.id] = { type: "essay", value: val };
      });
    }
    if (submission.text_content) {
      const eq = questions.find(q => q.question_type?.toLowerCase() === "essay" && !map[q.id]);
      if (eq) map[eq.id] = { type: "essay", value: submission.text_content };
    }
    if (Object.keys(map).length) setAnswers(map);
    clearFormData(`student-assignment-${assignmentId}`);
    clearSavedData();
  }, [submission, questions, assignmentId, clearSavedData]);

  const uploadFile = async (file: File): Promise<string> => {
    const userId = getStoredUserId();
    if (!userId) throw new Error("Not authenticated");
    const form = new FormData();
    form.append("file", file);
    form.append("assignmentId", assignmentId);
    const res = await apiClient.post("/student/assignments/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      validateStatus: s => s >= 200 && s < 500,
    });
    const url = (res.data as any)?.url || (res.data as any)?.publicUrl;
    if (!url || typeof url !== "string") throw new Error("Upload failed");
    return url;
  };

  const handleSubmit = async () => {
    if (questions.length > 0 && answeredCount === 0) {
      if (!(await confirmDialog({
        title: "Submit without answers?",
        description: "You haven't answered any questions.",
        confirmText: "Submit",
        variant: "danger",
      }))) return;
    } else if (questions.length > 0 && answeredCount < questions.length) {
      const rem = questions.length - answeredCount;
      if (!(await confirmDialog({
        title: "Submit incomplete?",
        description: `${rem} question${rem > 1 ? "s" : ""} unanswered. Unanswered questions will be marked incorrect.`,
        confirmText: "Submit",
        variant: "danger",
      }))) return;
    }
    setSubmitting(true);
    try {
      let fileUrl: string | undefined;
      if (fileUpload) fileUrl = await uploadFile(fileUpload);

      const finalAnswers: Record<string, unknown> = {};
      let essayContent: string | undefined;
      questions.forEach(q => {
        const a = answers[q.id];
        if (!a) return;
        const qt = q.question_type?.toLowerCase() ?? "";
        if (qt === "mcq" && a.type === "mcq" && typeof a.value === "number") finalAnswers[q.id] = a.value;
        else if (qt === "essay" && a.type === "essay" && typeof a.value === "string") essayContent = a.value;
        else if ((qt === "fillblank" || qt === "fill_blank") && a.type === "fill_blank" && Array.isArray(a.value))
          finalAnswers[q.id] = (a.value as string[]).map(v => (typeof v === "string" ? v : String(v ?? "")));
      });

      await submitAssignment.mutateAsync({ assignmentId, answers: finalAnswers, fileUrl, textContent: essayContent });
      clearFormData(`student-assignment-${assignmentId}`);
      clearSavedData();
      toast.success("Assignment submitted!");
      const courseId = assignment?.course_id;
      if (courseId) studentApi.progress.simpleSave({ courseId, isCompleted: true }).catch(() => {});
      router.push(`/lms/student/assignments/${assignmentId}/view`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit. Please try again.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (q: Question, idx: number, disabled = false, showCorrect = false) => {
    const qt = (q.question_type?.toLowerCase() ?? "").replace("fillblank", "fill_blank");
    const ans = answers[q.id];

    const wrapper = (content: React.ReactNode) => (
      <div key={q.id} className="py-7 border-b border-gray-100 last:border-0">
        <div className="flex items-start justify-between gap-4 mb-5">
          <span className="text-[15px] font-semibold text-gray-700">{idx + 1}.</span>
          <span className="text-sm text-gray-400 whitespace-nowrap flex-shrink-0">
            {q.marks ?? 1} point{(q.marks ?? 1) !== 1 ? "s" : ""}
          </span>
        </div>
        {content}
      </div>
    );

    if (qt === "mcq") return wrapper(
      <MCQQuestion
        question={{ id: q.id, question: q.question || q.question_text || "", options: q.options || [],
          correct_answer: Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer, marks: q.marks }}
        index={idx} totalQuestions={questions.length}
        selectedAnswer={ans?.type === "mcq" ? (typeof ans.value === "number" ? ans.value : parseInt(String(ans.value))) : undefined}
        onAnswerChange={v => setAnswers(p => ({ ...p, [q.id]: { type: "mcq", value: v } }))}
        showCorrectAnswer={showCorrect} disabled={disabled}
      />
    );

    if (qt === "essay") return wrapper(
      <EssayQuestion
        question={{ id: q.id, question: q.question || q.question_text || "", marks: q.marks, word_limit: q.word_limit }}
        index={idx} totalQuestions={questions.length}
        answer={ans?.type === "essay" && typeof ans.value === "string" ? ans.value : ""}
        onAnswerChange={v => setAnswers(p => ({ ...p, [q.id]: { type: "essay", value: v } }))}
        disabled={disabled}
      />
    );

    if (qt === "fill_blank") return wrapper(
      <FillBlankQuestion
        question={{ id: q.id, question: q.question || q.question_text || "", correct_answer: q.correct_answer as string | string[], marks: q.marks }}
        index={idx} totalQuestions={questions.length}
        answers={ans?.type === "fill_blank" && Array.isArray(ans.value) ? ans.value as string[] : []}
        onAnswerChange={(bi, v) => {
          const cur = ans?.type === "fill_blank" && Array.isArray(ans.value) ? [...(ans.value as string[])] : [];
          cur[bi] = v;
          setAnswers(p => ({ ...p, [q.id]: { type: "fill_blank", value: cur } }));
        }}
        showCorrectAnswer={showCorrect} disabled={disabled}
      />
    );

    return wrapper(<p className="text-sm text-gray-500">Unsupported question type: {qt}</p>);
  };

  /* ─── Loading ─── */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-14 w-14 mx-auto mb-4 text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Assignment not found</h2>
          <Link href="/lms/student/assignments" className="text-sm text-blue-600 hover:underline flex items-center gap-1 justify-center">
            <ArrowLeft className="h-4 w-4" /> Back to Assignments
          </Link>
        </div>
      </div>
    );
  }

  /* ─── Date helpers ─── */
  let dueDate: Date | null = null;
  let isOverdue = false;
  let daysLeft = 0;
  if (assignment.due_date) {
    try {
      const d = new Date(assignment.due_date);
      if (!isNaN(d.getTime())) {
        dueDate = d;
        daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
        isOverdue = d < new Date() && !submission;
      }
    } catch { /* ignore */ }
  }

  const gradeNum = submission?.grade != null ? (typeof submission.grade === "number" ? submission.grade : parseFloat(String(submission.grade))) : null;
  const gradeColor = gradeNum == null ? "text-gray-700" : gradeNum >= 70 ? "text-green-700" : gradeNum >= 50 ? "text-amber-700" : "text-red-700";
  const gradeBg = gradeNum == null ? "bg-gray-500" : gradeNum >= 70 ? "bg-green-600" : gradeNum >= 50 ? "bg-amber-500" : "bg-red-600";

  /* ═══════════════════════════════════════════
     TAKING MODE
  ═══════════════════════════════════════════ */
  if (mode === "taking") {
    return (
      <div className="min-h-screen bg-white">
        {/* Minimal sticky header */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-5 h-14">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setMode("overview")}
                className="flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 font-medium border border-blue-200 hover:border-blue-400 px-3 py-1.5 rounded-md transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{assignment.title}</p>
                <p className="text-xs text-gray-500 truncate">
                  {assignment.course_title || "Assignment"} &middot; {questions.length} question{questions.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0">
              {/* Progress */}
              {questions.length > 0 && (
                <span className="hidden sm:block text-xs text-gray-500">
                  {answeredCount}/{questions.length} answered
                </span>
              )}
              {/* Due date */}
              {dueDate && (
                <span className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
                  <Globe className="h-3.5 w-3.5" />
                  Due {formatDue(dueDate)}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* All questions */}
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="bg-white">
            {questions.map((q, i) => renderQuestion(q, i))}
          </div>

          {/* File upload for project type */}
          {(effectiveType === "project" || effectiveType === "quiz") && (
            <div className="mt-6 p-5 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <Label htmlFor="file-upload" className="block text-sm font-semibold text-gray-700 mb-3">
                Upload Your Work
              </Label>
              <Input
                id="file-upload"
                type="file"
                onChange={e => { if (e.target.files?.[0]) { setFileUpload(e.target.files[0]); setFileUploadName(e.target.files[0].name); } }}
                accept=".pdf,.doc,.docx,.zip,.png,.jpg,.jpeg"
                className="bg-white text-sm mb-2"
              />
              {fileUpload && (
                <p className="text-xs text-green-700 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" /> {fileUpload.name} ready to upload
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">PDF, Word, Images, ZIP supported</p>
            </div>
          )}

          {/* Submit section */}
          <div className="mt-10 pt-8 border-t border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                {answeredCount}/{questions.length} questions answered
                {answeredCount < questions.length && (
                  <span className="ml-2 text-amber-600">
                    ({questions.length - answeredCount} remaining)
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-400">Answers saved automatically</p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold px-8 py-3 rounded-lg transition-colors text-sm"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {submitting ? "Submitting…" : "Submit Assignment"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     OVERVIEW / LANDING MODE
  ═══════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-white">
      {/* Simple header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <Link
          href="/lms/student/assignments"
          className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 font-medium border border-blue-200 hover:border-blue-400 px-3 py-1.5 rounded-md transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Assignments
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Title */}
        <h1 className="text-3xl font-semibold text-gray-900 mb-1">{assignment.title}</h1>
        <p className="text-sm text-gray-500 mb-8">
          {assignment.course_title || "Assignment"}
          {effectiveType && effectiveType !== "essay" && <> &middot; <span className="capitalize">{effectiveType.replace("_", " ")}</span></>}
        </p>

        {/* Assignment details card */}
        <div className="bg-gray-50 rounded-xl p-6 mb-4 border border-gray-100">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Assignment details</h2>

          {/* Details grid */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-xs text-gray-500 mb-1">Due</p>
              <p className={`text-sm font-semibold ${isOverdue ? "text-red-600" : "text-gray-900"}`}>
                {dueDate ? formatDue(dueDate) : "No due date"}
              </p>
              {dueDate && !isOverdue && daysLeft >= 0 && (
                <p className="text-xs text-gray-400 mt-0.5">{daysLeft === 0 ? "Today" : `${daysLeft}d left`}</p>
              )}
              {isOverdue && <p className="text-xs text-red-500 mt-0.5">{Math.abs(daysLeft)}d overdue</p>}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Attempts</p>
              <p className="text-sm font-semibold text-gray-900">
                {retake?.max_attempts != null
                  ? `${attempts.length} / ${Number(retake.max_attempts) + 1}`
                  : attempts.length > 0
                  ? `${attempts.length} used (Unlimited)`
                  : "Unlimited"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Points</p>
              <p className="text-sm font-semibold text-gray-900">{assignment.max_marks ?? "—"}</p>
            </div>
          </div>

          {/* Description / instructions */}
          {assignment.description && (
            <p className="text-sm text-gray-600 leading-relaxed mb-6 pb-6 border-b border-gray-200">
              {assignment.description}
            </p>
          )}

          {/* Scoring rule notice */}
          {retake?.enabled && (
            <p className="text-xs text-gray-500 mb-4">
              {retake.scoring_rule === "highest"
                ? "We keep your highest score across all attempts."
                : "Your latest attempt score will be used."}
            </p>
          )}

          {/* Primary CTA */}
          <div className="flex items-center gap-3 flex-wrap">
            {!isSubmitted && (
              <button
                onClick={() => setMode("taking")}
                className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
              >
                Start Assignment
              </button>
            )}

            {isSubmitted && canRetake && (
              <button
                onClick={() => { setAnswers({}); setMode("taking"); }}
                className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
              >
                <RotateCcw className="h-4 w-4" />
                Retake Assignment
              </button>
            )}

            {isSubmitted && (
              <Link
                href={`/lms/student/assignments/${assignmentId}/view`}
                className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 font-medium border border-blue-200 hover:border-blue-400 px-4 py-2.5 rounded-lg transition-colors"
              >
                View submission →
              </Link>
            )}
          </div>
        </div>

        {/* Your grade card */}
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Your grade</h2>

          {!isSubmitted ? (
            <>
              <p className="text-sm text-gray-500 mb-4">
                You haven&apos;t submitted this yet.{" "}
                {retake?.scoring_rule === "highest" ? "We keep your highest score." : ""}
              </p>
              <p className="text-3xl font-bold text-gray-300">--</p>
            </>
          ) : hasGrade ? (
            <>
              <p className="text-sm text-gray-500 mb-3">
                Submitted on {new Date(submission.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {attempts.length > 1 && <> &middot; Attempt {submission.attempt_number ?? attempts.length} of {attempts.length}</>}
              </p>
              <div className="flex items-center gap-4 mb-4">
                <span className={`text-4xl font-bold ${gradeColor}`}>{gradeNum}%</span>
                <div className="flex-1 max-w-[200px]">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full ${gradeBg} rounded-full transition-all`} style={{ width: `${gradeNum}%` }} />
                  </div>
                </div>
              </div>
              {submission.feedback && (
                <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200 text-sm text-gray-700">
                  <p className="font-medium text-gray-500 text-xs mb-1">Teacher feedback</p>
                  {submission.feedback}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-blue-500" />
                <p className="text-sm text-blue-700 font-medium">Awaiting grade</p>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                Submitted on {new Date(submission.submitted_at).toLocaleDateString()}. Your teacher will grade this soon.
              </p>
              <p className="text-3xl font-bold text-gray-300">--</p>
            </>
          )}
        </div>

        {/* Attempt history (shown whenever there are multiple attempts) */}
        {attempts.length > 1 && (
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Attempt history</h2>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
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
                        {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
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
          </div>
        )}

        {/* Overdue warning */}
        {isOverdue && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">
              This assignment is overdue. Late submissions may not be accepted.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
