"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle, Clock, AlertCircle, Loader2, RotateCcw, FileText, Play } from "lucide-react";
import Link from "next/link";
import { LessonStage } from "@/components/student/course-player/LessonStage";
import ScoreRing, { scoreWords } from "@/components/portal/ScoreRing";
import AttemptHistory from "@/components/student/assignments/AttemptHistory";
import { useStudentAssignment, useSubmitAssignment, useRequestRetake } from "@/hooks/useStudentData";
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm";
import { loadFormData, clearFormData } from "@/lib/form-persistence";
import MCQQuestion from "@/components/student/assignments/questions/MCQQuestion";
import EssayQuestion from "@/components/student/assignments/questions/EssayQuestion";
import FillBlankQuestion from "@/components/student/assignments/questions/FillBlankQuestion";
import ProtectedAssignmentContent from "@/components/student/assignments/ProtectedAssignmentContent";
import QuestionStepper from "@/components/student/assignments/QuestionStepper";
import { apiClient } from "@/lib/api";
import { getStoredUserId } from "@/lib/session-utils";
import { useToast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { studentApi } from "@/lib/api/student.api";
import { useBeforeUnloadWhenDirty } from "@/hooks/useUnsavedCloseGuard";
import { useAssignmentLeaveGuard } from "@/hooks/useAssignmentLeaveGuard";
import { fmtWindow } from "@/lib/assignment-types";

interface Question {
  id: string;
  question?: string;
  question_text?: string;
  question_type?: string;
  options?: string[];
  word_bank?: string[];
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

function fmtClock(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return `${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(s).padStart(2, "0")}`;
}

function formatDue(date: Date | null): string {
  if (!date) return "No due date";
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function AssignmentDetailPage(props: PageProps) {
  const router = useRouter();
  const params = React.use(props.params);
  const assignmentId = params.assignmentId;
  const toast = useToast();

  const { data, isLoading, refetch } = useStudentAssignment(assignmentId);
  const submitAssignment = useSubmitAssignment();
  const requestRetake = useRequestRetake();

  // Scope drafts by student so a shared lab PC cannot restore the previous
  // student's answers after logout/login in the same browser tab.
  const userId = typeof window !== "undefined" ? getStoredUserId() : null;
  const draftFormId = userId
    ? `student-assignment-${userId}-${assignmentId}`
    : `student-assignment-pending-${assignmentId}`;

  const savedData =
    typeof window !== "undefined" && userId
      ? loadFormData<{ answers: Record<string, AnswerValue>; fileName?: string }>(
          draftFormId,
          true,
        )
      : null;

  const [mode, setMode] = useState<"overview" | "taking">("overview");
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(savedData?.answers || {});
  const [fileUpload, setFileUpload] = useState<File | null>(null);
  const [fileUploadName, setFileUploadName] = useState<string | null>(savedData?.fileName || null);
  const [submitting, setSubmitting] = useState(false);
  const [showRetakeRequestForm, setShowRetakeRequestForm] = useState(false);
  const [retakeReason, setRetakeReason] = useState("");
  const [requestingRetake, setRequestingRetake] = useState(false);
  // Exam timing. The deadline comes from the server; `skew` corrects for a wrong device clock.
  const [examStart, setExamStart] = useState<{ deadline: string | null; skew: number } | null>(null);
  const [starting, setStarting] = useState(false);
  const [tick, setTick] = useState(() => Date.now());
  const autoSubmitted = useRef(false);

  const assignment = (data as any)?.assignment as any;
  const submission = (data as any)?.submission as any;
  const attempts = ((data as any)?.attempts ?? []) as any[];
  const retake = (data as any)?.retake as {
    enabled?: boolean;
    allowed?: boolean;
    window_open?: boolean;
    granted?: boolean;
    max_attempts?: number | null;
    current_attempts?: number;
    scoring_rule?: string;
  } | undefined;
  const retakeRequest = (data as any)?.retake_request as {
    id: string;
    status: "pending" | "approved" | "rejected";
    reason?: string | null;
    teacher_remarks?: string | null;
    created_at: string;
    decided_at?: string | null;
  } | null | undefined;
  const questions: Question[] = useMemo(() => assignment?.questions ?? [], [assignment?.questions]);
  const isExam = assignment?.kind === "EXAM";
  const isClosed = assignment?.due_phase === "closed";
  const examPhase = (assignment?.exam_phase ?? null) as "upcoming" | "open" | "closed" | null;
  const deadlineIso: string | null = examStart?.deadline ?? assignment?.deadline ?? null;
  const skew = examStart?.skew ?? (assignment?.server_now ? Date.parse(assignment.server_now) - Date.now() : 0);
  const remainingMs = isExam && deadlineIso ? Date.parse(deadlineIso) - (tick + skew) : null;

  const effectiveType = useMemo(() => {
    if (assignment?.assignment_type) return assignment.assignment_type.toLowerCase();
    if (questions.length > 0 && questions[0]?.question_type) {
      const qt = questions[0].question_type.toLowerCase();
      if (qt === "mcq" || qt === "essay" || qt === "fill_blank" || qt === "fillblank") return qt;
      if (questions[0].options?.length) return "mcq";
    }
    return "essay";
  }, [assignment, questions]);

  const isQuestionAnswered = useMemo(() => (q: Question) => {
    const a = answers[q.id];
    if (!a) return false;
    if (a.type === "mcq") return typeof a.value === "number" && a.value >= 0;
    if (a.type === "essay") return typeof a.value === "string" && a.value.trim().length > 0;
    if (a.type === "fill_blank") return Array.isArray(a.value) && (a.value as string[]).some(v => v?.trim().length > 0);
    return false;
  }, [answers]);

  const answeredCount = useMemo(
    () => questions.filter(isQuestionAnswered).length,
    [isQuestionAnswered, questions]
  );

  // Unsubmitted draft restored from local auto-save — used for the overview notice.
  const draftAnsweredCount = !submission ? Object.keys(savedData?.answers ?? {}).length : 0;

  const hasGrade = submission?.grade !== null && submission?.grade !== undefined;
  const isSubmitted = !!(submission && (submission.status === "submitted" || submission.status === "graded" || hasGrade || submission.submitted_at));
  const canRetake = !!retake?.allowed;

  // Explains why the Retake button is hidden, rather than leaving the
  // student with "Unlimited" attempts shown and no way to act on it — that
  // "Unlimited" reflects max_attempts being unset, not that retakes are
  // actually enabled, so without this message the two states looked
  // identical to a student.
  const retakeUnavailableReason = useMemo(() => {
    if (!isSubmitted || canRetake) return null;
    if (!retake?.enabled) {
      return "Retakes aren't enabled for this assignment. Ask your teacher if you'd like another attempt.";
    }
    const maxAttempts = retake.max_attempts != null ? Number(retake.max_attempts) + 1 : null;
    if (maxAttempts != null && attempts.length >= maxAttempts) {
      return `You've used all ${maxAttempts} allowed attempt${maxAttempts === 1 ? "" : "s"} for this assignment.`;
    }
    const accessScope = assignment?.retake_access_scope ?? "all";
    if (accessScope === "selected" && !retake.granted) {
      return "Your teacher hasn't granted you a retake for this assignment yet.";
    }
    if (!retake.window_open) {
      return "Retakes aren't open right now. Ask your teacher to open a retake for you.";
    }
    return "Retakes aren't currently available for this assignment.";
  }, [isSubmitted, canRetake, retake, attempts.length, assignment?.retake_access_scope]);

  const { clearSavedData, isSaving, lastSaved } = useAutoSaveForm({
    formId: draftFormId,
    formData: { answers, fileName: fileUploadName || fileUpload?.name || undefined },
    // Only while actively answering — stops post-submit / overview rewrites
    // of drafts on shared lab machines.
    autoSave: !!userId && mode === "taking" && (!isSubmitted || canRetake),
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

  // Drop legacy unscoped drafts (`student-assignment-{assignmentId}`) left by
  // older builds — those keys are shared across every student on this browser.
  useEffect(() => {
    clearFormData(`student-assignment-${assignmentId}`, true);
    clearFormData(`student-assignment-${assignmentId}`, false);
  }, [assignmentId]);

  const takingIsDirty =
    mode === "taking" &&
    (!isSubmitted || canRetake) &&
    (Object.keys(answers).length > 0 || !!fileUpload || !!fileUploadName);
  useBeforeUnloadWhenDirty(takingIsDirty);

  const requestLeave = useAssignmentLeaveGuard(takingIsDirty, () => {
    clearFormData(draftFormId, true);
    clearSavedData();
    setAnswers({});
    setFileUpload(null);
    setFileUploadName(null);
  });

  const leaveTaking = () => requestLeave(() => setMode("overview"));

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
    clearFormData(draftFormId, true);
    clearSavedData();
    if (Object.keys(map).length) setAnswers(map);
  }, [submission, questions, assignmentId, clearSavedData, draftFormId]);

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

  const handleSubmit = async (force = false) => {
    if (force) { /* time is up: send whatever is answered */ }
    else if (questions.length > 0 && answeredCount === 0) {
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
      clearFormData(draftFormId, true);
      clearSavedData();
      toast.success(isExam ? "Exam submitted!" : "Assignment submitted!");
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

  useEffect(() => {
    if (!isExam || mode !== "taking") return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isExam, mode]);

  useEffect(() => {
    if (mode === "taking" && remainingMs !== null && remainingMs <= 0 && !autoSubmitted.current && !submitting) {
      autoSubmitted.current = true;
      toast.error("Time is up. Submitting your answers.");
      void handleSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when the clock runs out
  }, [remainingMs, mode]);

  /** Exams must be started on the server first: it records the start time and then reveals the questions. */
  const startExam = async (fresh: boolean) => {
    setStarting(true);
    try {
      const { data: s } = await studentApi.assignments.start(assignmentId);
      const r = s as { deadline: string | null; server_now: string };
      setExamStart({ deadline: r.deadline, skew: Date.parse(r.server_now) - Date.now() });
      setTick(Date.now());
      autoSubmitted.current = false;
      await refetch();
      if (fresh) { setAnswers({}); setFileUpload(null); setFileUploadName(null); clearSavedData(); }
      setMode("taking");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not start the exam.");
    } finally {
      setStarting(false);
    }
  };

  const handleRequestRetake = async () => {
    setRequestingRetake(true);
    try {
      await requestRetake.mutateAsync({ assignmentId, reason: retakeReason.trim() || undefined });
      setShowRetakeRequestForm(false);
      setRetakeReason("");
      toast.success("Retake request sent to your teacher.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send retake request.";
      toast.error(msg);
    } finally {
      setRequestingRetake(false);
    }
  };

  const renderQuestion = (q: Question, idx: number, disabled = false, showCorrect = false) => {
    const qt = (q.question_type?.toLowerCase() ?? "").replace("fillblank", "fill_blank");
    const ans = answers[q.id];

    const wrapper = (content: React.ReactNode) => <div key={q.id} id={`question-${idx}`}>{content}</div>;

    if (qt === "mcq") return wrapper(
      <MCQQuestion
        question={{ id: q.id, question: q.question || q.question_text || "", options: q.options || [],
          correct_answer: Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer, marks: q.marks }}
        index={idx} totalQuestions={questions.length} number={idx + 1}
        selectedAnswer={ans?.type === "mcq" ? (typeof ans.value === "number" ? ans.value : parseInt(String(ans.value))) : undefined}
        onAnswerChange={v => setAnswers(p => ({ ...p, [q.id]: { type: "mcq", value: v } }))}
        showCorrectAnswer={showCorrect} disabled={disabled}
      />
    );

    if (qt === "essay") return wrapper(
      <EssayQuestion
        question={{ id: q.id, question: q.question || q.question_text || "", marks: q.marks, word_limit: q.word_limit }}
        index={idx} totalQuestions={questions.length} number={idx + 1}
        answer={ans?.type === "essay" && typeof ans.value === "string" ? ans.value : ""}
        onAnswerChange={v => setAnswers(p => ({ ...p, [q.id]: { type: "essay", value: v } }))}
        disabled={disabled}
      />
    );

    if (qt === "fill_blank") return wrapper(
      <FillBlankQuestion
        question={{ id: q.id, question: q.question || q.question_text || "", correct_answer: q.correct_answer as string | string[], marks: q.marks, word_bank: q.word_bank }}
        index={idx} totalQuestions={questions.length} number={idx + 1}
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
      <div className="wr sd-player" aria-busy="true">
        <div className="ls">
          <div className="sd-skel" style={{ height: "2.5rem", width: "60%" }} />
          <div className="sd-skel" style={{ height: "9rem" }} />
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="wr sd-player">
        <div className="ls">
          <div className="ls-card">
            <span className="ls-card-ico"><FileText aria-hidden="true" /></span>
            <b>We could not find this assignment</b>
            <p>It may have been removed. Go back and pick another one.</p>
            <Link href="/lms/student/assignments" className="sd-btn sd-btn--ink"><ArrowLeft aria-hidden="true" />Back to assignments</Link>
          </div>
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
        const istDay = (t: number) => Math.floor((t + 19800000) / 86400000);
        daysLeft = assignment.kind === "EXAM" ? Math.ceil((d.getTime() - Date.now()) / 86400000) : istDay(d.getTime()) - istDay(Date.now());
        // DAILY/COURSE: the server decides (due date runs to the end of the day in IST).
        isOverdue = !submission && (assignment.kind === "EXAM" || !assignment.due_phase ? d < new Date() : assignment.due_phase !== "open");
      }
    } catch { /* ignore */ }
  }

  const gradeNum = submission?.grade != null ? (typeof submission.grade === "number" ? submission.grade : parseFloat(String(submission.grade))) : null;
  const rawType = String(effectiveType || "").toLowerCase();
  const typeText = /mcq/.test(rawType) ? "Multiple choice"
    : /fill/.test(rawType) ? "Fill in the blanks"
    : /essay/.test(rawType) ? "Writing"
    : rawType ? rawType.replace(/_/g, " ").replace(/^./, (c: string) => c.toUpperCase()) : "";

  /* ═══════════════════════════════════════════
     TAKING MODE
  ═══════════════════════════════════════════ */
  if (mode === "taking") {
    const fileUploadSection = (effectiveType === "project" || effectiveType === "quiz") && (
      <div className="wr-drop">
        <label htmlFor="file-upload">Add your work</label>
        <input
          id="file-upload"
          type="file"
          onChange={e => { if (e.target.files?.[0]) { setFileUpload(e.target.files[0]); setFileUploadName(e.target.files[0].name); } }}
          accept=".pdf,.doc,.docx,.zip,.png,.jpg,.jpeg"
        />
        {fileUpload && <p className="wr-ready"><CheckCircle aria-hidden="true" />{fileUpload.name} is ready to send</p>}
        <p>PDF, Word, pictures or ZIP files all work.</p>
      </div>
    );

    return (
      <ProtectedAssignmentContent className="wr sd-player">
        <header className="wr-bar">
          <div className="wr-bar-l">
            <button onClick={leaveTaking} aria-label="Back" className="sd-btn sd-btn--line" style={{ minHeight: "2.4rem", padding: "0.3rem 1rem" }}>
              <ArrowLeft aria-hidden="true" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div>
              <b>{assignment.title}</b>
              <span>{assignment.course_title || "Assignment"}{typeText ? ` • ${typeText}` : ""}</span>
            </div>
          </div>
          <div className="wr-bar-r">
            {/* Live auto-save status: students should always know their work is safe */}
            <span className="wr-chip" data-t={!isSaving && lastSaved ? "saved" : undefined} role="status">
              {isSaving ? <><Loader2 className="animate-spin" aria-hidden="true" />Saving</> : lastSaved ? <><CheckCircle aria-hidden="true" />Saved</> : "Saves as you go"}
            </span>
            {questions.length > 0 && <span className="wr-chip">{answeredCount} of {questions.length}</span>}
            {isExam && remainingMs !== null
              ? <span className="wr-chip wr-due" role="timer" aria-label="Time left" data-low={remainingMs < 300000 ? "true" : undefined}><Clock aria-hidden="true" />{fmtClock(remainingMs)} left</span>
              : dueDate && <span className="wr-chip wr-due"><Clock aria-hidden="true" />Due {formatDue(dueDate)}</span>}
          </div>
        </header>

        {questions.length > 0 ? (
          <QuestionStepper
            count={questions.length}
            isAnswered={(i) => isQuestionAnswered(questions[i])}
            renderQuestion={(i) => renderQuestion(questions[i], i)}
            onSubmit={() => void handleSubmit()}
            submitting={submitting}
            statusBarClassName=""
            lastStepExtra={fileUploadSection}
          />
        ) : (
          <div className="ls">
            {fileUploadSection}
            <button onClick={() => void handleSubmit()} disabled={submitting} className="sd-btn sd-btn--amber sd-btn--lg ls-big">
              {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle aria-hidden="true" />}
              {submitting ? "Handing in" : "Hand it in"}
            </button>
          </div>
        )}
      </ProtectedAssignmentContent>
    );
  }

  /* ═══════════════════════════════════════════
     OVERVIEW MODE
  ═══════════════════════════════════════════ */
  const attemptsText = retake?.granted
    ? `${attempts.length} used, 1 extra`
    : !retake?.enabled
    ? `${attempts.length} of 1`
    : retake.max_attempts != null
    ? `${attempts.length} of ${Number(retake.max_attempts) + 1}`
    : attempts.length > 0
    ? `${attempts.length} used`
    : "Unlimited";

  return (
    <div className="wr sd-player">
      <div className="ls">
        <Link href={isExam ? "/lms/student/exams" : "/lms/student/assignments"} className="ls-link"><ArrowLeft className="mr-1 inline h-4 w-4" />Back to {isExam ? "exams" : "assignments"}</Link>
      </div>
      <LessonStage
        kind="assignment"
        title={assignment.title}
        chapterName={[assignment.course_title, typeText].filter(Boolean).join(" • ") || undefined}
        task={isSubmitted ? null : "Do your best. Your answers save as you go."}
      >
        {assignment.description && <p className="ls-prose" style={{ fontSize: "1.1rem" }}>{assignment.description}</p>}

        <div className="sd-ledger" data-cols="3">
          {isExam ? (
            <div>
              <span className="sd-l">{examPhase === "upcoming" ? "Opens" : "Closes"}</span>
              <b className="sd-n" style={{ fontSize: "1.35rem" }}>{formatDue(new Date((examPhase === "upcoming" ? assignment.starts_at : assignment.ends_at) ?? Date.now()))}</b>
              <small>{examPhase === "upcoming" ? "Not open yet" : examPhase === "closed" ? "Closed" : assignment.duration_minutes ? `${assignment.duration_minutes} minutes once you start` : "Open now"}</small>
            </div>
          ) : (
          <div>
            <span className="sd-l">Due</span>
            <b className="sd-n" style={{ fontSize: "1.35rem", color: isOverdue ? "var(--sd-late)" : undefined }}>{dueDate ? formatDue(dueDate) : "No due date"}</b>
            <small>
              {dueDate && !isOverdue && daysLeft >= 0 ? (daysLeft === 0 ? "Today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`) : isOverdue ? `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} late` : "\u00a0"}
            </small>
          </div>
          )}
          <div><span className="sd-l">Tries</span><b className="sd-n" style={{ fontSize: "1.35rem" }}>{attemptsText}</b><small>&nbsp;</small></div>
          <div><span className="sd-l">Points</span><b className="sd-n">{assignment.max_marks ?? "—"}</b><small>&nbsp;</small></div>
        </div>

        {retake?.enabled && (
          <p className="as-fine" style={{ margin: 0 }}>
            {retake.scoring_rule === "highest" ? "We keep your highest score from all your tries." : "Your latest try is the one that counts."}
          </p>
        )}

        {!isSubmitted && draftAnsweredCount > 0 && (
          <div className="ls-note" data-t="warn" role="status">
            <b>You have a saved draft</b>
            <p>{draftAnsweredCount} answer{draftAnsweredCount !== 1 ? "s are" : " is"} saved. Pick up where you left off.</p>
          </div>
        )}

        <div className="wr-acts">
          {!isSubmitted && isExam && examPhase === "open" && (
            <button onClick={() => void startExam(false)} disabled={starting} className="sd-btn sd-btn--amber sd-btn--lg max-sm:w-full">
              {starting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
              {assignment.started_at ? "Continue the exam" : "Start the exam"}
            </button>
          )}
          {!isSubmitted && assignment?.due_phase === "late" && (
            <p role="status" className="sd-hint">This is past its due date and will be marked late{assignment?.closes_at ? `. It closes on ${new Date(assignment.closes_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}.</p>
          )}
          {isClosed && (
            <p role="status" className="sd-hint">This assignment closed on {assignment?.closes_at ? new Date(assignment.closes_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "its due date"} and no longer accepts submissions. Ask your teacher if you need more time.</p>
          )}
          {!isSubmitted && !isExam && !isClosed && (
            <button onClick={() => setMode("taking")} className="sd-btn sd-btn--amber sd-btn--lg max-sm:w-full">
              <Play aria-hidden="true" />
              {draftAnsweredCount > 0 ? "Keep going" : "Start the assignment"}
            </button>
          )}
          {isSubmitted && canRetake && !isClosed && (!isExam || examPhase === "open") && (
            <button
              onClick={() => {
                if (isExam) { void startExam(true); return; }
                setAnswers({});
                setFileUpload(null);
                setFileUploadName(null);
                clearSavedData();
                setMode("taking");
              }}
              className="sd-btn sd-btn--amber sd-btn--lg max-sm:w-full"
            >
              <RotateCcw aria-hidden="true" />
              Try again
            </button>
          )}
          {isSubmitted && (
            <Link href={`/lms/student/assignments/${assignmentId}/view`} className="sd-btn sd-btn--line sd-btn--lg max-sm:w-full">
              <FileText aria-hidden="true" />See my answers
            </Link>
          )}
        </div>

        {isSubmitted && !canRetake && (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {retakeRequest?.status === "pending" ? (
              <div className="ls-note" data-t="warn" role="status">
                <b>You asked for another try</b>
                <p>Your teacher will look at your request soon.</p>
              </div>
            ) : (
              <>
                {retakeUnavailableReason && (
                  <div className="ls-note"><p>{retakeUnavailableReason}</p></div>
                )}
                {retakeRequest?.status === "rejected" && (
                  <div className="ls-note" data-t="late" role="alert">
                    <b>Your teacher said not this time</b>
                    <p>{retakeRequest.teacher_remarks ? `"${retakeRequest.teacher_remarks}"` : "You can ask again if something has changed."}</p>
                  </div>
                )}
                {!showRetakeRequestForm ? (
                  <button onClick={() => setShowRetakeRequestForm(true)} className="sd-btn sd-btn--line" style={{ justifySelf: "start" }}>
                    <RotateCcw aria-hidden="true" />
                    {retakeRequest?.status === "rejected" ? "Ask again" : "Ask for another try"}
                  </button>
                ) : (
                  <div className="wr-retake">
                    <label htmlFor="retake-reason" style={{ fontWeight: 700 }}>Tell your teacher why (you can skip this)</label>
                    <Textarea
                      id="retake-reason"
                      value={retakeReason}
                      onChange={(e) => setRetakeReason(e.target.value)}
                      placeholder="For example: I read a question the wrong way."
                      rows={3}
                    />
                    <div className="wr-acts">
                      <button onClick={handleRequestRetake} disabled={requestingRetake} className="sd-btn sd-btn--amber">
                        {requestingRetake ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
                        Send request
                      </button>
                      <button onClick={() => { setShowRetakeRequestForm(false); setRetakeReason(""); }} disabled={requestingRetake} className="sd-btn sd-btn--line">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {isSubmitted && (
          <div className="ls-score">
            {hasGrade && gradeNum !== null ? <ScoreRing value={gradeNum} /> : null}
            <div className="ls-score-text">
              <b>{hasGrade && gradeNum !== null ? scoreWords(gradeNum) : "Waiting for a grade"}</b>
              <span>
                Handed in on {new Date(submission.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                {attempts.length > 1 ? `, try ${submission.attempt_number ?? attempts.length} of ${attempts.length}` : ""}
                {hasGrade ? "" : ". Your teacher will mark it soon."}
              </span>
            </div>
          </div>
        )}

        {isSubmitted && hasGrade && submission.feedback && (
          <div className="ls-note"><b>Teacher feedback</b><p>{submission.feedback}</p></div>
        )}

        {attempts.length > 1 && <AttemptHistory attempts={attempts} />}

        {isExam && !isSubmitted && examPhase !== "open" && (
          <div className="ls-note" data-t={examPhase === "closed" ? "late" : "warn"} role="status">
            <b>{examPhase === "upcoming" ? "This exam has not opened yet" : "This exam is closed"}</b>
            <p>{examPhase === "upcoming" ? `It opens ${fmtWindow(assignment.starts_at, null).split(" → ")[0]}. Come back then.` : "The window has ended. Talk to your teacher if you missed it."}</p>
          </div>
        )}

        {isExam && examPhase === "open" && !isSubmitted && (
          <div className="ls-note" role="note">
            <b>Before you start</b>
            <p>{assignment.duration_minutes ? `You get ${assignment.duration_minutes} minutes from the moment you press start. ` : ""}The exam closes for everyone at {formatDue(new Date(assignment.ends_at))}. Your answers are sent automatically when time runs out.</p>
          </div>
        )}

        {isOverdue && !isExam && (
          <div className="ls-note" data-t="late" role="alert">
            <b><AlertCircle className="mr-1.5 inline h-4 w-4" aria-hidden="true" />This assignment is late</b>
            <p>Late work may not be accepted. Tell your teacher if you need more time.</p>
          </div>
        )}
      </LessonStage>
    </div>
  );
}
