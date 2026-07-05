'use client'

import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import {
  Clock,
  RotateCcw,
  Play,
  AlertCircle,
  Loader2,
  FileText,
  CheckCircle,
  ArrowLeft,
  MessageSquare,
  Download,
} from 'lucide-react'
import { useStudentAssignment, useSubmitAssignment } from '../../../hooks/useStudentData'
import { useCourseProgressStore } from '../../../store/course-progress-store'
import { useToast } from '../../ui/toast'
import { confirmDialog } from '../../ui/confirm-dialog'
import MCQQuestion from '../assignments/questions/MCQQuestion'
import EssayQuestion from '../assignments/questions/EssayQuestion'
import FillBlankQuestion from '../assignments/questions/FillBlankQuestion'

/* ─── Types ─────────────────────────────────────────────── */

interface AssignmentContentViewerProps {
  content: {
    id: string
    title: string
    content_text?: string
    chapter_id?: string
    course_id?: string
  }
  courseId: string
  chapterId: string
  onComplete?: () => void
}

interface Question {
  id: string
  question?: string
  question_text?: string
  question_type?: string
  options?: string[]
  correct_answer?: number | string | string[]
  marks?: number
  word_limit?: number
}

interface AnswerValue {
  type: 'mcq' | 'essay' | 'fill_blank'
  value: number | string | string[]
}

type Mode = 'overview' | 'taking' | 'review'

/* ─── Helpers ─────────────────────────────────────────────── */

function formatDue(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function buildAnswerMap(submission: Record<string, unknown> | null, questions: Question[]): Record<string, AnswerValue> {
  const map: Record<string, AnswerValue> = {}
  if (!submission || !questions.length) return map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (submission as any).answers ?? (submission as any).answers_json ?? {}
  if (typeof raw === 'object') {
    Object.entries(raw as Record<string, unknown>).forEach(([qId, val]) => {
      const q = questions.find(q => q.id === qId)
      if (!q) return
      const qt = q.question_type?.toLowerCase() ?? ''
      if (qt === 'mcq') map[q.id] = { type: 'mcq', value: typeof val === 'number' ? val : parseInt(String(val)) }
      else if (qt === 'fillblank' || qt === 'fill_blank') map[q.id] = { type: 'fill_blank', value: Array.isArray(val) ? val as string[] : [val as string] }
      else if (qt === 'essay' && typeof val === 'string') map[q.id] = { type: 'essay', value: val }
    })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((submission as any).text_content) {
    const eq = questions.find(q => q.question_type?.toLowerCase() === 'essay' && !map[q.id])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (eq) map[eq.id] = { type: 'essay', value: (submission as any).text_content }
  }
  return map
}

/* ─── Component ─────────────────────────────────────────────── */

export default function AssignmentContentViewer({
  content,
  courseId,
  chapterId,
  onComplete,
}: AssignmentContentViewerProps) {
  const toast = useToast()
  const hasMarkedRef = useRef(false)
  const { isContentCompleted, setContentCompleted } = useCourseProgressStore()
  const isCompleted = isContentCompleted(content.id)

  const [mode, setMode] = useState<Mode>('overview')
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [submitting, setSubmitting] = useState(false)

  const { data, isLoading, refetch } = useStudentAssignment(content.id)
  const submitAssignment = useSubmitAssignment()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = data as any
  const assignment = raw?.assignment
  const submission = raw?.submission
  const retake = raw?.retake
  const attempts = (raw?.attempts ?? []) as Record<string, unknown>[]

  const questions: Question[] = useMemo(() => assignment?.questions ?? [], [assignment?.questions])

  /* ── Derived state ── */
  const isSubmitted = !!(submission && (submission.status === 'submitted' || submission.status === 'graded' || submission.submitted_at))
  const canRetake = !!retake?.allowed
  const hasGrade = submission?.grade !== null && submission?.grade !== undefined
  const gradeNum = submission?.grade != null
    ? typeof submission.grade === 'number' ? submission.grade : parseFloat(String(submission.grade))
    : null
  const gradeColor = gradeNum == null ? 'text-gray-700' : gradeNum >= 70 ? 'text-green-700' : gradeNum >= 50 ? 'text-amber-700' : 'text-red-700'
  const gradeBg = gradeNum == null ? 'bg-gray-500' : gradeNum >= 70 ? 'bg-green-600' : gradeNum >= 50 ? 'bg-amber-500' : 'bg-red-600'
  const dueDate = assignment?.due_date ? new Date(assignment.due_date) : null
  const isOverdue = dueDate ? dueDate < new Date() && !isSubmitted : false

  /* ── Mark viewed on existing submission ── */
  useEffect(() => {
    if (submission && !hasMarkedRef.current && !isCompleted) {
      hasMarkedRef.current = true
      setContentCompleted(content.id, chapterId, courseId, true)
      onComplete?.()
    }
  }, [submission]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Start/Retake ── */
  // Starting does NOT complete the item — completion is recorded only after a
  // successful submission (handled by the submission effect above and after submit).
  const handleStart = useCallback(() => {
    setAnswers({})
    setMode('taking')
  }, [])

  /* ── Review submission ── */
  const handleReview = useCallback(() => {
    setAnswers(buildAnswerMap(submission, questions))
    setMode('review')
  }, [submission, questions])

  /* ── Answered count ── */
  const answeredCount = useMemo(() => questions.filter(q => {
    const a = answers[q.id]
    if (!a) return false
    if (a.type === 'mcq') return typeof a.value === 'number' && a.value >= 0
    if (a.type === 'essay') return typeof a.value === 'string' && a.value.trim().length > 0
    if (a.type === 'fill_blank') return Array.isArray(a.value) && (a.value as string[]).some(v => v?.trim().length > 0)
    return false
  }).length, [answers, questions])

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (questions.length > 0 && answeredCount === 0) {
      if (!(await confirmDialog({
        title: "Submit without answers?",
        description: "You haven't answered any questions.",
        confirmText: "Submit",
        variant: "danger",
      }))) return
    } else if (questions.length > 0 && answeredCount < questions.length) {
      const rem = questions.length - answeredCount
      if (!(await confirmDialog({
        title: "Submit incomplete?",
        description: `${rem} question${rem > 1 ? 's' : ''} unanswered.`,
        confirmText: "Submit",
        variant: "danger",
      }))) return
    }
    setSubmitting(true)
    try {
      const finalAnswers: Record<string, unknown> = {}
      let essayContent: string | undefined
      questions.forEach(q => {
        const a = answers[q.id]
        if (!a) return
        const qt = q.question_type?.toLowerCase() ?? ''
        if (qt === 'mcq' && a.type === 'mcq' && typeof a.value === 'number') finalAnswers[q.id] = a.value
        else if (qt === 'essay' && a.type === 'essay' && typeof a.value === 'string') essayContent = a.value
        else if ((qt === 'fillblank' || qt === 'fill_blank') && a.type === 'fill_blank' && Array.isArray(a.value))
          finalAnswers[q.id] = (a.value as string[]).map(v => typeof v === 'string' ? v : String(v ?? ''))
      })
      await submitAssignment.mutateAsync({ assignmentId: content.id, answers: finalAnswers, textContent: essayContent })
      await refetch()
      toast.success('Assignment submitted!')
      setMode('overview')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Render a question (taking mode) ── */
  const renderTakingQuestion = (q: Question, idx: number) => {
    const qt = (q.question_type?.toLowerCase() ?? '').replace('fillblank', 'fill_blank')
    const ans = answers[q.id]

    const wrapper = (children: React.ReactNode) => (
      <div key={q.id} className="py-6 border-b border-gray-100 last:border-0">
        <div className="flex items-start justify-between gap-4 mb-4">
          <span className="text-sm font-semibold text-gray-500">Q{idx + 1}</span>
          <span className="text-xs text-gray-400">{q.marks ?? 1} pt{(q.marks ?? 1) !== 1 ? 's' : ''}</span>
        </div>
        {children}
      </div>
    )

    if (qt === 'mcq') return wrapper(
      <MCQQuestion
        question={{ id: q.id, question: q.question || q.question_text || '', options: q.options || [], correct_answer: Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer, marks: q.marks }}
        index={idx} totalQuestions={questions.length}
        selectedAnswer={ans?.type === 'mcq' ? (typeof ans.value === 'number' ? ans.value : parseInt(String(ans.value))) : undefined}
        onAnswerChange={v => setAnswers(p => ({ ...p, [q.id]: { type: 'mcq', value: v } }))}
        showCorrectAnswer={false} disabled={false}
      />
    )
    if (qt === 'essay') return wrapper(
      <EssayQuestion
        question={{ id: q.id, question: q.question || q.question_text || '', marks: q.marks, word_limit: q.word_limit }}
        index={idx} totalQuestions={questions.length}
        answer={ans?.type === 'essay' && typeof ans.value === 'string' ? ans.value : ''}
        onAnswerChange={v => setAnswers(p => ({ ...p, [q.id]: { type: 'essay', value: v } }))}
        disabled={false}
      />
    )
    if (qt === 'fill_blank') return wrapper(
      <FillBlankQuestion
        question={{ id: q.id, question: q.question || q.question_text || '', correct_answer: q.correct_answer as string | string[], marks: q.marks }}
        index={idx} totalQuestions={questions.length}
        answers={ans?.type === 'fill_blank' && Array.isArray(ans.value) ? ans.value as string[] : []}
        onAnswerChange={(bi, v) => {
          const cur = ans?.type === 'fill_blank' && Array.isArray(ans.value) ? [...(ans.value as string[])] : []
          cur[bi] = v
          setAnswers(p => ({ ...p, [q.id]: { type: 'fill_blank', value: cur } }))
        }}
        showCorrectAnswer={false} disabled={false}
      />
    )
    return wrapper(<p className="text-sm text-gray-400">Unsupported question type: {qt}</p>)
  }

  /* ── Render a question (review mode) ── */
  const renderReviewQuestion = (q: Question, idx: number) => {
    const qt = (q.question_type?.toLowerCase() ?? '').replace('fillblank', 'fill_blank')
    const ans = answers[q.id]

    return (
      <div key={q.id} className="py-6 border-b border-gray-100 last:border-0">
        <div className="flex items-start justify-between gap-4 mb-4">
          <span className="text-xs text-gray-400 font-medium">Question {idx + 1} of {questions.length}</span>
          <span className="text-xs text-gray-400">{q.marks ?? 1} pt{(q.marks ?? 1) !== 1 ? 's' : ''}</span>
        </div>
        {qt === 'mcq' && (
          <MCQQuestion
            question={{ id: q.id, question: q.question || q.question_text || '', options: q.options || [], correct_answer: Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer, marks: q.marks }}
            index={idx} totalQuestions={questions.length}
            selectedAnswer={ans?.type === 'mcq' && typeof ans.value === 'number' ? ans.value : undefined}
            onAnswerChange={() => {}} showCorrectAnswer={hasGrade} disabled
          />
        )}
        {qt === 'essay' && (
          <div>
            <p className="text-base text-gray-900 leading-relaxed mb-4">{q.question || q.question_text}</p>
            {ans?.type === 'essay' && typeof ans.value === 'string' && ans.value.trim() ? (
              <div className="px-4 py-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs text-gray-400 font-medium mb-2">Your answer</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{ans.value}</p>
              </div>
            ) : (
              <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-400 italic">No answer submitted.</p>
              </div>
            )}
          </div>
        )}
        {qt === 'fill_blank' && (
          <FillBlankQuestion
            question={{ id: q.id, question: q.question || q.question_text || '', correct_answer: q.correct_answer as string | string[], marks: q.marks }}
            index={idx} totalQuestions={questions.length}
            answers={ans?.type === 'fill_blank' && Array.isArray(ans.value) ? ans.value as string[] : []}
            onAnswerChange={() => {}} showCorrectAnswer={hasGrade} disabled
          />
        )}
      </div>
    )
  }

  /* ─── Loading ─────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 flex flex-col items-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
        <p className="text-sm text-gray-500">Loading assignment…</p>
      </div>
    )
  }

  if (!assignment) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <FileText className="h-14 w-14 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">Assignment not found</p>
      </div>
    )
  }

  /* ═══════════════════════════════════
     TAKING MODE
  ════════════════════════════════════ */
  if (mode === 'taking') {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Back link */}
        <button
          onClick={() => setMode('overview')}
          className="flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 font-medium mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to overview
        </button>

        <h1 className="text-2xl font-semibold text-gray-900 mb-1">{assignment.title}</h1>
        <p className="text-sm text-gray-500 mb-6 capitalize">
          {(assignment.assignment_type ?? '').replace(/_/g, ' ')} · {questions.length} question{questions.length !== 1 ? 's' : ''}
        </p>

        {/* Questions */}
        <div className="bg-white">
          {questions.map((q, i) => renderTakingQuestion(q, i))}
        </div>

        {/* Submit section */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              {answeredCount}/{questions.length} answered
              {answeredCount < questions.length && (
                <span className="ml-2 text-amber-600">({questions.length - answeredCount} remaining)</span>
              )}
            </p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold px-8 py-3 rounded-lg transition-colors text-sm"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {submitting ? 'Submitting…' : 'Submit Assignment'}
          </button>
        </div>
      </div>
    )
  }

  /* ═══════════════════════════════════
     REVIEW MODE
  ════════════════════════════════════ */
  if (mode === 'review') {
    const submittedAt = submission?.submitted_at
      ? new Date(submission.submitted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      : null

    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Back link */}
        <button
          onClick={() => setMode('overview')}
          className="flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 font-medium mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to overview
        </button>

        <h1 className="text-2xl font-semibold text-gray-900 mb-1">{assignment.title}</h1>
        <p className="text-sm text-gray-500 mb-6">{assignment.course_title || ''}</p>

        {/* Grade / status banner */}
        <div className={`flex items-center justify-between px-5 py-4 rounded-xl mb-5 border ${
          hasGrade ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center gap-3">
            {hasGrade
              ? <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              : <Clock className="h-5 w-5 text-blue-600 flex-shrink-0" />
            }
            <div>
              <p className={`text-sm font-semibold ${hasGrade ? 'text-green-800' : 'text-blue-800'}`}>
                {hasGrade ? 'Assignment Graded' : 'Awaiting Grade'}
              </p>
              {submittedAt && (
                <p className={`text-xs ${hasGrade ? 'text-green-600' : 'text-blue-600'}`}>
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
        {submission?.feedback && (
          <div className="mb-5 px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-gray-500" />
              <p className="text-sm font-semibold text-gray-700">Teacher Feedback</p>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{submission.feedback}</p>
          </div>
        )}

        {/* File download */}
        {submission?.file_url && (
          <div className="mb-5">
            <a href={submission.file_url} target="_blank" rel="noopener noreferrer">
              <button className="inline-flex items-center gap-2 text-sm text-blue-700 border border-blue-200 hover:border-blue-400 px-4 py-2 rounded-lg transition-colors">
                <Download className="h-4 w-4" /> Download Submitted File
              </button>
            </a>
          </div>
        )}

        {/* Answers */}
        {questions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold text-gray-900">Your Answers</h2>
              {hasGrade && (
                <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
                  <CheckCircle className="h-3.5 w-3.5" /> Correct answers shown
                </span>
              )}
            </div>
            <div className="border-t border-gray-100">
              {questions.map((q, i) => renderReviewQuestion(q, i))}
            </div>
          </div>
        )}

        {/* Attempt history */}
        {attempts.length > 1 && (
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Attempt History</h3>
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
                  {attempts.map((a) => (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    <tr key={String((a as any).id)} className="bg-white">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <td className="px-4 py-3 text-gray-700">#{(a as any).attempt_number ?? '—'}</td>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <td className="px-4 py-3 text-gray-500">{(a as any).submitted_at ? new Date(String((a as any).submitted_at)).toLocaleDateString() : '—'}</td>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <td className="px-4 py-3 text-right font-medium text-gray-700">{(a as any).score ?? 0}/{(a as any).max_score ?? 0}</td>
                      <td className="px-4 py-3 text-right">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${(a as any).status === 'graded' ? 'bg-green-100 text-green-700' : (a as any).status === 'submitted' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {String((a as any).status ?? '—')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Retake from review */}
        {canRetake && (
          <div className="mt-6 flex items-center justify-between px-5 py-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-semibold text-amber-800">Retake available</p>
            </div>
            <button
              onClick={handleStart}
              className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Retake
            </button>
          </div>
        )}
      </div>
    )
  }

  /* ═══════════════════════════════════
     OVERVIEW MODE
  ════════════════════════════════════ */
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Completed badge */}
      {isCompleted && (
        <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium mb-4">
          <CheckCircle className="h-4 w-4" /> Read
        </div>
      )}

      <h1 className="text-3xl font-semibold text-gray-900 mb-1">{assignment.title}</h1>
      <p className="text-sm text-gray-500 mb-8 capitalize">
        {(assignment.assignment_type ?? '').replace(/_/g, ' ')} assignment
        {assignment.max_marks ? ` · ${assignment.max_marks} points` : ''}
      </p>

      {assignment.description && (
        <p className="text-sm text-gray-600 leading-relaxed mb-6">{assignment.description}</p>
      )}

      {/* Assignment details card */}
      <div className="bg-gray-50 rounded-xl p-6 mb-4 border border-gray-100">
        <h2 className="text-base font-semibold text-gray-900 mb-5">Assignment details</h2>
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div>
            <p className="text-xs text-gray-500 mb-1">Due</p>
            <p className={`text-sm font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
              {dueDate ? formatDue(assignment.due_date) : 'No due date'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Attempts</p>
            <p className="text-sm font-semibold text-gray-900">
              {retake?.max_attempts != null
                ? `${retake.current_attempts ?? 0} / ${Number(retake.max_attempts) + 1}`
                : 'Unlimited'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Points</p>
            <p className="text-sm font-semibold text-gray-900">{assignment.max_marks ?? '—'}</p>
          </div>
        </div>

        {!isSubmitted && (
          <button onClick={handleStart}
            className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm">
            <Play className="h-4 w-4" /> Start Assignment
          </button>
        )}
        {isSubmitted && canRetake && (
          <button onClick={handleStart}
            className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm">
            <RotateCcw className="h-4 w-4" /> Retake Assignment
          </button>
        )}
        {isSubmitted && !canRetake && (
          <button onClick={handleReview}
            className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm">
            <FileText className="h-4 w-4" /> Review Submission
          </button>
        )}
      </div>

      {/* Grade card */}
      <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Your grade</h2>
        {!isSubmitted ? (
          <>
            <p className="text-sm text-gray-500 mb-4">You haven&apos;t submitted this yet. We keep your highest score.</p>
            <p className="text-3xl font-bold text-gray-300">--</p>
          </>
        ) : hasGrade ? (
          <>
            <p className="text-sm text-gray-500 mb-3">
              Submitted on {new Date(submission.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
            <button onClick={handleReview}
              className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 font-medium">
              View submission →
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-blue-500" />
              <p className="text-sm text-blue-700 font-medium">Awaiting grade</p>
            </div>
            <p className="text-sm text-gray-500 mb-1">Your submission will be graded soon.</p>
            <p className="text-3xl font-bold text-gray-300">--</p>
            <button onClick={handleReview}
              className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 font-medium mt-3">
              View your answers →
            </button>
          </>
        )}
      </div>

      {isOverdue && (
        <div className="mt-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">This assignment is overdue. Late submissions may not be accepted.</p>
        </div>
      )}
    </div>
  )
}
