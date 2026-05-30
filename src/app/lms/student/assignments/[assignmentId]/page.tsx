"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  ArrowLeft,
  Calendar,
  Clock,
  Award,
  Upload,
  CheckCircle,
  AlertCircle,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  BookOpen,
  Zap,
  RotateCcw,
  MessageSquare,
} from "lucide-react";
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
  explanation?: string;
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

/* ─── tiny helpers ─── */

function QuestionTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    mcq: { label: "MCQ", cls: "bg-violet-100 text-violet-700" },
    essay: { label: "Essay", cls: "bg-amber-100 text-amber-700" },
    fill_blank: { label: "Fill", cls: "bg-cyan-100 text-cyan-700" },
    fillblank: { label: "Fill", cls: "bg-cyan-100 text-cyan-700" },
  };
  const cfg = map[type] ?? { label: type.toUpperCase(), cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function DueDateChip({ dueDate, isOverdue, daysUntilDue }: { dueDate: Date | null; isOverdue: boolean; daysUntilDue: number }) {
  if (!dueDate) return <span className="text-gray-400 text-sm">No due date</span>;
  if (isOverdue)
    return (
      <span className="flex items-center gap-1 text-red-400 text-sm font-medium">
        <AlertCircle className="h-3.5 w-3.5" />
        Overdue {Math.abs(daysUntilDue)}d
      </span>
    );
  if (daysUntilDue === 0)
    return (
      <span className="flex items-center gap-1 text-orange-400 text-sm font-medium">
        <Zap className="h-3.5 w-3.5" />
        Due today
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-gray-300 text-sm">
      <Calendar className="h-3.5 w-3.5" />
      {daysUntilDue}d left
    </span>
  );
}

/* ─── main page ─── */

export default function AssignmentDetailPage(props: PageProps) {
  const router = useRouter();
  const params = React.use(props.params);
  const resolvedSearchParams = React.use(props.searchParams);
  const searchParams = useMemo(() => resolvedSearchParams ?? {}, [resolvedSearchParams]);
  const assignmentId = params.assignmentId;
  const toast = useToast();

  const { data, isLoading } = useStudentAssignment(assignmentId);
  const submitAssignment = useSubmitAssignment();

  const savedSubmissionData =
    typeof window !== "undefined"
      ? loadFormData<{ answers: { [questionId: string]: AnswerValue }; fileName?: string }>(
          `student-assignment-${assignmentId}`
        )
      : null;

  const [submissionMode, setSubmissionMode] = useState(false);
  const [answers, setAnswers] = useState<{ [questionId: string]: AnswerValue }>(
    savedSubmissionData?.answers || {}
  );
  const [fileUpload, setFileUpload] = useState<File | null>(null);
  const [fileUploadName, setFileUploadName] = useState<string | null>(
    savedSubmissionData?.fileName || null
  );
  const [uploading, setUploading] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const assignment = (data as any)?.assignment as any;
  const submission = (data as any)?.submission as any;
  const attempts = ((data as any)?.attempts ?? []) as Array<any>;
  const retake = (data as any)?.retake as
    | {
        enabled?: boolean;
        window_open?: boolean;
        max_attempts?: number | null;
        current_attempts?: number;
        granted?: boolean;
        allowed?: boolean;
      }
    | undefined;
  const questions = useMemo(() => assignment?.questions ?? [], [assignment?.questions]);

  const effectiveAssignmentType = useMemo(() => {
    if (assignment?.assignment_type) return assignment.assignment_type.toLowerCase();
    if (questions.length > 0) {
      const firstQuestion = questions[0];
      if (firstQuestion?.question_type) {
        const qt = firstQuestion.question_type.toLowerCase();
        if (qt === "mcq") return "mcq";
        if (qt === "essay") return "essay";
        if (qt === "fillblank" || qt === "fill_blank") return "fill_blank";
      }
      if (firstQuestion?.options?.length > 0) return "mcq";
    }
    return assignment?.assignment_type?.toLowerCase() || "essay";
  }, [assignment?.assignment_type, questions]);

  const answeredQuestions = useMemo(() => {
    return questions.filter((q: Question) => {
      const answer = answers[q.id];
      if (!answer) return false;
      switch (answer.type) {
        case "mcq":
          return typeof answer.value === "number" && answer.value >= 0;
        case "essay":
          return typeof answer.value === "string" && answer.value.trim().length > 0;
        case "fill_blank":
          return Array.isArray(answer.value) && answer.value.some((v: string) => v?.trim().length > 0);
        default:
          return false;
      }
    }).length;
  }, [answers, questions]);

  const progressPercentage =
    questions.length > 0 ? Math.round((answeredQuestions / questions.length) * 100) : 0;

  const { isDirty: _isSubmissionDirty, clearSavedData } = useAutoSaveForm({
    formId: `student-assignment-${assignmentId}`,
    formData: { answers, fileName: fileUploadName || fileUpload?.name || undefined },
    autoSave: true,
    autoSaveInterval: 2000,
    debounceDelay: 500,
    useSession: true,
    onLoad: (data) => {
      if (data && !submission) {
        if (data.answers) setAnswers(data.answers);
        if (data.fileName) setFileUploadName(data.fileName);
      }
    },
    markDirty: true,
  });

  useEffect(() => {
    if (submission && questions.length > 0) {
      const submissionAnswers: { [questionId: string]: AnswerValue } = {};
      if (submission.answers && typeof submission.answers === "object") {
        Object.entries(submission.answers).forEach(([qId, value]) => {
          const question = questions.find((q: any) => q.id === qId);
          if (question) {
            const qt = question.question_type?.toLowerCase();
            if (qt === "mcq") {
              submissionAnswers[question.id] = { type: "mcq", value: value as number };
            } else if (qt === "fillblank" || qt === "fill_blank") {
              submissionAnswers[question.id] = {
                type: "fill_blank",
                value: Array.isArray(value) ? value : [value as string],
              };
            } else if (qt === "essay" && typeof value === "string") {
              submissionAnswers[question.id] = { type: "essay", value };
            }
          }
        });
      }
      if (submission.text_content) {
        const essayQuestion = questions.find(
          (q: Question) =>
            q.question_type?.toLowerCase() === "essay" && !submissionAnswers[q.id]
        );
        if (essayQuestion) {
          submissionAnswers[essayQuestion.id] = { type: "essay", value: submission.text_content };
        }
      }
      if (Object.keys(submissionAnswers).length > 0) setAnswers(submissionAnswers);
      clearFormData(`student-assignment-${assignmentId}`);
      clearSavedData();
    }
  }, [submission, questions, assignmentId, clearSavedData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setFileUpload(file);
      setFileUploadName(file.name);
    }
  };

  const uploadFile = async (file: File): Promise<string> => {
    const userId = getStoredUserId();
    if (!userId) throw new Error("Not authenticated");
    const form = new FormData();
    form.append("file", file);
    form.append("assignmentId", assignmentId);
    const res = await apiClient.post("/lms/student/assignments/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      validateStatus: (s) => s >= 200 && s < 500,
    });
    const url = (res.data as any)?.url || (res.data as any)?.publicUrl;
    if (!url || typeof url !== "string") throw new Error("Upload failed");
    return url;
  };

  const hasGrade = submission && submission.grade !== null && submission.grade !== undefined;
  const isSubmittedOrGraded =
    submission &&
    (submission.status === "submitted" ||
      submission.status === "graded" ||
      hasGrade ||
      (submission.submitted_at !== null && submission.submitted_at !== undefined));
  const canSubmit = !isSubmittedOrGraded || !!retake?.allowed;

  useEffect(() => {
    const action = searchParams?.action as string | undefined;
    if (isSubmittedOrGraded && !retake?.allowed) {
      setSubmissionMode(false);
    } else if (action === "submit" && canSubmit && !submissionMode) {
      setSubmissionMode(true);
    }
  }, [isSubmittedOrGraded, canSubmit, searchParams, submissionMode, retake?.allowed]);

  const handleSubmit = async () => {
    try {
      if (questions.length > 0) {
        if (answeredQuestions === 0) {
          const proceed = window.confirm(
            "You have not answered any questions yet. Submitting now will record an empty submission and may result in a 0% score.\n\nAre you sure you want to submit?"
          );
          if (!proceed) return;
        } else if (answeredQuestions < questions.length) {
          const remaining = questions.length - answeredQuestions;
          const proceed = window.confirm(
            `You have ${remaining} unanswered question${remaining === 1 ? "" : "s"}. Unanswered questions will be marked incorrect.\n\nAre you sure you want to submit?`
          );
          if (!proceed) return;
        }
      }

      setUploading(true);
      let fileUrl: string | undefined;
      if (fileUpload) fileUrl = await uploadFile(fileUpload);

      const finalAnswers: Record<string, unknown> = {};
      let essayTextContent: string | undefined;

      questions.forEach((q: Question) => {
        const answer = answers[q.id];
        if (!answer) return;
        const qt = q.question_type?.toLowerCase();
        if (qt === "mcq" && answer.type === "mcq" && typeof answer.value === "number") {
          finalAnswers[q.id] = answer.value;
        } else if (qt === "essay" && answer.type === "essay" && typeof answer.value === "string") {
          essayTextContent = answer.value;
        } else if (
          (qt === "fillblank" || qt === "fill_blank") &&
          answer.type === "fill_blank" &&
          Array.isArray(answer.value)
        ) {
          finalAnswers[q.id] = answer.value.map((v) =>
            typeof v === "string" ? v : String(v ?? "")
          );
        }
      });

      await submitAssignment.mutateAsync({ assignmentId, answers: finalAnswers, fileUrl, textContent: essayTextContent });
      clearFormData(`student-assignment-${assignmentId}`);
      clearSavedData();
      toast.success("Assignment submitted successfully!");
      setSubmissionMode(false);

      // Fire-and-forget: record assignment completion in course progress
      const courseId = assignment?.course_id;
      if (courseId) {
        studentApi.progress.simpleSave({ courseId, isCompleted: true }).catch(() => {});
      }

      router.push("/lms/student/assignments");
    } catch (error: unknown) {
      console.error("Error submitting assignment:", error);
      const errorMessage =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message || "Failed to submit assignment. Please try again.")
          : "Failed to submit assignment. Please try again.";
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  /* ─── render question ─── */
  const renderQuestion = (
    question: Question,
    index: number,
    disabled = false,
    showCorrectAnswer = false
  ) => {
    const qt = question.question_type?.toLowerCase() || "";
    const normalized = qt === "fillblank" ? "fill_blank" : qt;
    const answer = answers[question.id];

    switch (normalized) {
      case "mcq":
        return (
          <MCQQuestion
            key={question.id}
            question={{
              id: question.id,
              question: question.question || question.question_text || "",
              question_text: question.question_text,
              options: question.options || [],
              correct_answer: Array.isArray(question.correct_answer)
                ? question.correct_answer[0]
                : question.correct_answer,
              marks: question.marks,
            }}
            index={index}
            totalQuestions={questions.length}
            selectedAnswer={
              answer?.type === "mcq"
                ? typeof answer.value === "number"
                  ? answer.value
                  : parseInt(String(answer.value))
                : undefined
            }
            onAnswerChange={(answerIndex: number) =>
              setAnswers((prev) => ({ ...prev, [question.id]: { type: "mcq", value: answerIndex } }))
            }
            showCorrectAnswer={showCorrectAnswer}
            disabled={disabled}
          />
        );
      case "essay":
        return (
          <EssayQuestion
            key={question.id}
            question={{
              id: question.id,
              question: question.question || question.question_text || "",
              question_text: question.question_text,
              marks: question.marks,
              word_limit: question.word_limit,
            }}
            index={index}
            totalQuestions={questions.length}
            answer={answer?.type === "essay" && typeof answer.value === "string" ? answer.value : ""}
            onAnswerChange={(answerText: string) =>
              setAnswers((prev) => ({ ...prev, [question.id]: { type: "essay", value: answerText } }))
            }
            disabled={disabled}
          />
        );
      case "fill_blank":
        return (
          <FillBlankQuestion
            key={question.id}
            question={{
              id: question.id,
              question: question.question || question.question_text || "",
              question_text: question.question_text,
              correct_answer: question.correct_answer as string | string[],
              marks: question.marks,
            }}
            index={index}
            totalQuestions={questions.length}
            answers={
              answer?.type === "fill_blank" && Array.isArray(answer.value) ? answer.value : []
            }
            onAnswerChange={(blankIndex: number, blankAnswer: string) => {
              const current =
                answer?.type === "fill_blank" && Array.isArray(answer.value)
                  ? [...answer.value]
                  : [];
              current[blankIndex] = blankAnswer;
              setAnswers((prev) => ({ ...prev, [question.id]: { type: "fill_blank", value: current } }));
            }}
            showCorrectAnswer={showCorrectAnswer}
            disabled={disabled}
          />
        );
      default:
        return (
          <div key={question.id} className="p-6 bg-white rounded-xl border">
            <p className="font-medium mb-2">
              {index + 1}. {question.question || question.question_text || "Question"}
            </p>
            <p className="text-sm text-gray-500">Unknown type: {qt}</p>
          </div>
        );
    }
  };

  /* ─── loading / not found ─── */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <div className="h-14 bg-gray-900 border-b border-gray-800" />
        <div className="flex flex-1">
          <div className="w-64 bg-gray-900 border-r border-gray-800 animate-pulse" />
          <div className="flex-1 p-8 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Assignment not found</h2>
          <Link
            href="/lms/student/assignments"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 px-4 py-2 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Assignments
          </Link>
        </div>
      </div>
    );
  }

  /* ─── date helpers ─── */
  let dueDate: Date | null = null;
  let daysUntilDue = 0;
  let isOverdue = false;
  if (assignment?.due_date) {
    try {
      dueDate = new Date(assignment.due_date);
      if (isNaN(dueDate.getTime())) { dueDate = null; }
      else {
        const now = new Date();
        daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        isOverdue = dueDate < now && !submission;
      }
    } catch {
      dueDate = null;
    }
  }

  const gradeNum =
    submission?.grade != null
      ? typeof submission.grade === "number"
        ? submission.grade
        : parseFloat(submission.grade)
      : null;

  const gradeColor =
    gradeNum == null
      ? "text-gray-600"
      : gradeNum >= 70
      ? "text-green-600"
      : gradeNum >= 50
      ? "text-yellow-600"
      : "text-red-600";

  const gradeBg =
    gradeNum == null
      ? "bg-gray-100"
      : gradeNum >= 70
      ? "bg-green-600"
      : gradeNum >= 50
      ? "bg-yellow-600"
      : "bg-red-600";

  /* ─── question nav helper ─── */
  const isAnswered = (q: Question) => {
    const a = answers[q.id];
    if (!a) return false;
    if (a.type === "mcq") return typeof a.value === "number" && a.value >= 0;
    if (a.type === "essay") return typeof a.value === "string" && a.value.trim().length > 0;
    if (a.type === "fill_blank") return Array.isArray(a.value) && a.value.some((v: string) => v?.trim().length > 0);
    return false;
  };

  /* ═══════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* ── Sticky Top Header ── */}
      <header className="sticky top-0 z-40 bg-gray-900 border-b border-gray-800 shadow-xl">
        <div className="flex items-center justify-between px-5 h-14 gap-4">

          {/* Left: back + title */}
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/lms/student/assignments">
              <button className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-800">
                <ArrowLeft className="h-5 w-5" />
              </button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-white font-semibold text-sm truncate leading-tight">
                {assignment.title}
              </h1>
              <p className="text-gray-500 text-xs truncate">
                {assignment.course_title || "Assignment"} ·{" "}
                <span className="capitalize">{effectiveAssignmentType}</span>
              </p>
            </div>
          </div>

          {/* Center: progress (submission mode only) */}
          {submissionMode && questions.length > 0 && (
            <div className="hidden sm:flex items-center gap-3 flex-1 max-w-xs mx-4">
              <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-green-400 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <span className="text-gray-400 text-xs whitespace-nowrap">
                {answeredQuestions}/{questions.length}
              </span>
            </div>
          )}

          {/* Right: timer + actions */}
          <div className="flex items-center gap-3 shrink-0">
            <DueDateChip dueDate={dueDate} isOverdue={isOverdue} daysUntilDue={daysUntilDue} />

            {submissionMode && (
              <>
                <button
                  onClick={() => setSubmissionMode(false)}
                  className="text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={uploading}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
                >
                  {uploading ? (
                    <Clock className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  {uploading ? "Submitting…" : "Submit"}
                </button>
              </>
            )}

            {!submissionMode && canSubmit && (
              <button
                onClick={() => setSubmissionMode(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
              >
                <Upload className="h-4 w-4" />
                {submission ? "Retake" : "Start"}
              </button>
            )}

            {isSubmittedOrGraded && !canSubmit && (
              <span
                className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                  hasGrade ? "bg-green-900 text-green-300" : "bg-blue-900 text-blue-300"
                }`}
              >
                {hasGrade ? `${gradeNum}%` : "Submitted"}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ════ LEFT SIDEBAR ════ */}
        <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col overflow-y-auto shrink-0">

          {/* Attempt / status summary */}
          <div className="p-4 border-b border-gray-800 space-y-3">
            {/* Status pill */}
            <div className="flex items-center gap-2">
              {isSubmittedOrGraded && hasGrade ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400">
                  <CheckCircle2 className="h-4 w-4" /> Graded
                </span>
              ) : isSubmittedOrGraded ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-400">
                  <Upload className="h-4 w-4" /> Submitted
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                  <BookOpen className="h-4 w-4" /> Not started
                </span>
              )}
              {retake?.allowed && (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <RotateCcw className="h-3 w-3" /> Retake open
                </span>
              )}
            </div>

            {/* Grade display */}
            {gradeNum != null && (
              <div className="flex items-center gap-3">
                <div
                  className={`text-2xl font-bold ${gradeColor}`}
                >
                  {gradeNum}%
                </div>
                <div className="flex-1">
                  <div className="h-1.5 bg-gray-700 rounded-full">
                    <div
                      className={`h-1.5 rounded-full ${gradeBg}`}
                      style={{ width: `${gradeNum}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Score
                  </p>
                </div>
              </div>
            )}

            {/* Attempts */}
            {(retake?.enabled || attempts.length > 0) && (
              <p className="text-xs text-gray-500">
                Attempts:{" "}
                <span className="text-gray-300 font-medium">{attempts.length}</span>
                {retake?.max_attempts != null ? ` / ${Number(retake.max_attempts) + 1}` : " / ∞"}
              </p>
            )}
          </div>

          {/* Assignment details */}
          <div className="p-4 border-b border-gray-800 space-y-2 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Max marks</span>
              <span className="text-gray-200 font-medium">{assignment.max_marks}</span>
            </div>
            {dueDate && (
              <div className="flex justify-between">
                <span>Due</span>
                <span className="text-gray-200 font-medium">
                  {dueDate.toLocaleDateString()}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Type</span>
              <QuestionTypeBadge type={effectiveAssignmentType} />
            </div>
          </div>

          {/* Question navigator (submission / review mode) */}
          {(submissionMode || isSubmittedOrGraded) && questions.length > 0 && (
            <div className="p-4 flex-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Questions
              </p>
              {submissionMode && (
                <div className="mb-3 text-xs text-gray-500">
                  {answeredQuestions}/{questions.length} answered
                </div>
              )}
              <div className="grid grid-cols-5 gap-1.5">
                {questions.map((q: Question, idx: number) => {
                  const answered = isAnswered(q);
                  const current = submissionMode && idx === currentQuestionIndex;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (submissionMode) setCurrentQuestionIndex(idx);
                      }}
                      title={`Q${idx + 1} · ${q.question_type?.toUpperCase() || "?"}`}
                      className={`
                        aspect-square rounded-lg text-xs font-bold flex items-center justify-center
                        border transition-all duration-150
                        ${
                          current
                            ? "border-blue-500 bg-blue-500/20 text-blue-300"
                            : answered
                            ? "border-green-600 bg-green-600/20 text-green-400"
                            : "border-gray-700 bg-gray-800 text-gray-500 hover:border-gray-600"
                        }
                      `}
                    >
                      {answered && !current ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        idx + 1
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Attempt history (compact) */}
          {attempts.length > 0 && (
            <div className="p-4 border-t border-gray-800">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                History
              </p>
              <div className="space-y-1">
                {attempts.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="flex items-center justify-between text-xs py-1"
                  >
                    <span className="text-gray-400">#{attempt.attempt_number}</span>
                    <span className="text-gray-300 font-medium">
                      {attempt.score ?? 0}/{attempt.max_score ?? 0}
                    </span>
                    <span className="text-gray-600 capitalize">{attempt.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ════ MAIN CONTENT ════ */}
        <main className="flex-1 overflow-y-auto bg-gray-50">

          {/* ── SUBMISSION MODE ── */}
          {submissionMode && (
            <div className="max-w-3xl mx-auto px-6 py-8">

              {/* Question card */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

                {/* Question header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-900">
                      Question {currentQuestionIndex + 1}
                    </span>
                    <span className="text-gray-400 text-sm">of {questions.length}</span>
                    {questions[currentQuestionIndex] && (
                      <QuestionTypeBadge type={questions[currentQuestionIndex].question_type || ""} />
                    )}
                  </div>
                  {questions[currentQuestionIndex]?.marks && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      {questions[currentQuestionIndex].marks} marks
                    </span>
                  )}
                </div>

                {/* Question body */}
                <div className="p-6 min-h-64">
                  {questions.length > 0 &&
                    renderQuestion(
                      questions[currentQuestionIndex] as Question,
                      currentQuestionIndex,
                      false,
                      false
                    )}
                </div>

                {/* File upload for project type */}
                {(effectiveAssignmentType === "project" || effectiveAssignmentType === "quiz") && (
                  <div className="mx-6 mb-6 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <Label htmlFor="file" className="text-sm font-semibold text-gray-700 block mb-3">
                      Upload Your Work
                    </Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="file"
                        type="file"
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx,.zip,.png,.jpg,.jpeg"
                        className="bg-white text-sm"
                      />
                      {fileUpload && (
                        <span className="text-green-600 text-xs flex items-center gap-1 whitespace-nowrap">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Ready
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Supported: PDF, Word, Images, ZIP
                    </p>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/70">
                  <button
                    onClick={() => setCurrentQuestionIndex((p) => Math.max(0, p - 1))}
                    disabled={currentQuestionIndex === 0}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors disabled:hover:border-gray-200"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>

                  {/* Dot indicators */}
                  <div className="flex items-center gap-1">
                    {questions.map((_: Question, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentQuestionIndex(idx)}
                        className={`rounded-full transition-all duration-150 ${
                          idx === currentQuestionIndex
                            ? "w-4 h-2 bg-blue-600"
                            : isAnswered(questions[idx])
                            ? "w-2 h-2 bg-green-500"
                            : "w-2 h-2 bg-gray-300"
                        }`}
                      />
                    ))}
                  </div>

                  {currentQuestionIndex < questions.length - 1 ? (
                    <button
                      onClick={() => setCurrentQuestionIndex((p) => Math.min(questions.length - 1, p + 1))}
                      className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={uploading}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {uploading ? "Submitting…" : "Submit All"}
                    </button>
                  )}
                </div>
              </div>

              {/* Auto-save notice */}
              <p className="text-center text-xs text-gray-400 mt-4">
                Your answers are auto-saved every 2 seconds
              </p>
            </div>
          )}

          {/* ── OVERVIEW / REVIEW MODE ── */}
          {!submissionMode && (
            <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

              {/* Stat row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  {
                    label: "Due Date",
                    icon: <Calendar className="h-4 w-4" />,
                    value: dueDate ? dueDate.toLocaleDateString() : "—",
                    sub: dueDate
                      ? isOverdue
                        ? "Overdue"
                        : `${daysUntilDue}d left`
                      : "No due date",
                    subColor: isOverdue ? "text-red-500" : "text-gray-400",
                    iconColor: "text-blue-500",
                    bg: "bg-blue-50",
                  },
                  {
                    label: "Max Marks",
                    icon: <Award className="h-4 w-4" />,
                    value: assignment.max_marks,
                    sub: "Total points",
                    subColor: "text-gray-400",
                    iconColor: "text-amber-500",
                    bg: "bg-amber-50",
                  },
                  {
                    label: "Questions",
                    icon: <BookOpen className="h-4 w-4" />,
                    value: questions.length,
                    sub: effectiveAssignmentType.toUpperCase(),
                    subColor: "text-gray-400",
                    iconColor: "text-violet-500",
                    bg: "bg-violet-50",
                  },
                  {
                    label: "Status",
                    icon: isSubmittedOrGraded && hasGrade
                      ? <CheckCircle className="h-4 w-4" />
                      : isSubmittedOrGraded
                      ? <Upload className="h-4 w-4" />
                      : <AlertCircle className="h-4 w-4" />,
                    value: isSubmittedOrGraded && hasGrade
                      ? "Graded"
                      : isSubmittedOrGraded
                      ? "Submitted"
                      : "Not started",
                    sub: gradeNum != null ? `${gradeNum}%` : "",
                    subColor: gradeColor,
                    iconColor: isSubmittedOrGraded && hasGrade
                      ? "text-green-500"
                      : isSubmittedOrGraded
                      ? "text-blue-500"
                      : "text-orange-500",
                    bg: isSubmittedOrGraded && hasGrade
                      ? "bg-green-50"
                      : isSubmittedOrGraded
                      ? "bg-blue-50"
                      : "bg-orange-50",
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500">{card.label}</span>
                      <span className={`${card.iconColor} ${card.bg} p-1 rounded-lg`}>
                        {card.icon}
                      </span>
                    </div>
                    <p className="text-xl font-bold text-gray-900 mb-0.5">{card.value}</p>
                    <p className={`text-xs ${card.subColor}`}>{card.sub}</p>
                  </div>
                ))}
              </div>

              {/* Instructions */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100 bg-gray-50/60">
                  <BookOpen className="h-4 w-4 text-gray-500" />
                  <h2 className="font-semibold text-gray-900 text-sm">Instructions</h2>
                </div>
                <div className="p-6 text-gray-700 leading-relaxed text-sm">
                  {assignment.description || "No specific instructions provided."}
                </div>
              </div>

              {/* CTA or Submission Review */}
              {!isSubmittedOrGraded && canSubmit && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Upload className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to begin?</h3>
                  <p className="text-sm text-gray-500 mb-6">
                    {questions.length} question{questions.length !== 1 ? "s" : ""} · {assignment.max_marks} marks
                    {dueDate && ` · Due ${dueDate.toLocaleDateString()}`}
                  </p>
                  <button
                    onClick={() => setSubmissionMode(true)}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3 rounded-xl transition-colors text-sm"
                  >
                    <Zap className="h-4 w-4" />
                    Start Assignment
                  </button>
                </div>
              )}

              {/* Submission review */}
              {submission && (
                <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                  hasGrade ? "border-green-200" : "border-blue-200"
                }`}>
                  <div className={`flex items-center justify-between px-6 py-4 border-b ${
                    hasGrade
                      ? "bg-green-50 border-green-100"
                      : "bg-blue-50 border-blue-100"
                  }`}>
                    <div className="flex items-center gap-2">
                      {hasGrade ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <Upload className="h-5 w-5 text-blue-600" />
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm">
                          {hasGrade ? "Assignment Graded" : "Your Submission"}
                        </h3>
                        <p className="text-xs text-gray-500">
                          Submitted {new Date(submission.submitted_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {gradeNum != null && (
                      <span className={`text-2xl font-bold px-4 py-2 rounded-xl text-white ${gradeBg}`}>
                        {gradeNum}%
                      </span>
                    )}
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Answers review */}
                    {questions.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold text-gray-900 text-sm">Review Answers</h4>
                          {hasGrade && (
                            <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
                              Correct answers shown
                            </span>
                          )}
                        </div>
                        <div className="space-y-4">
                          {questions.map((q: Question, idx: number) =>
                            renderQuestion(q, idx, true, hasGrade)
                          )}
                        </div>
                      </div>
                    )}

                    {/* File download */}
                    {submission.file_url && (
                      <div className="pt-4 border-t border-gray-100">
                        <a href={submission.file_url} target="_blank" rel="noopener noreferrer">
                          <button className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 px-4 py-2 rounded-lg transition-colors">
                            <Download className="h-4 w-4" />
                            Download Submission
                          </button>
                        </a>
                      </div>
                    )}

                    {/* Feedback */}
                    {submission.feedback && (
                      <div className="pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="h-4 w-4 text-gray-500" />
                          <h4 className="font-semibold text-sm text-gray-900">Teacher Feedback</h4>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed border border-gray-100">
                          {submission.feedback}
                        </div>
                      </div>
                    )}

                    {/* Pending grade notice */}
                    {submission.status === "submitted" && submission.grade == null && (
                      <div className="flex items-start gap-3 bg-blue-50 rounded-xl p-4 border border-blue-100">
                        <Clock className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-sm text-blue-900">Awaiting grade</p>
                          <p className="text-xs text-blue-600 mt-0.5">
                            Your submission has been received and will be graded soon.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Retake CTA */}
                    {retake?.allowed && canSubmit && (
                      <div className="flex items-center justify-between bg-amber-50 rounded-xl p-4 border border-amber-100">
                        <div className="flex items-center gap-2">
                          <RotateCcw className="h-5 w-5 text-amber-600" />
                          <div>
                            <p className="font-semibold text-sm text-amber-900">Retake available</p>
                            <p className="text-xs text-amber-600">Your teacher has opened a retake window.</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSubmissionMode(true)}
                          className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Retake
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
