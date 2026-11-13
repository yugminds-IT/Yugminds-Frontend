'use client'

import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import {
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
import { LessonStage, DoneDock } from './LessonStage'
import ScoreRing, { scoreWords } from '../../portal/ScoreRing'
import { useStudentAssignment, useSubmitAssignment } from '../../../hooks/useStudentData'
import { useCourseProgressStore } from '../../../store/course-progress-store'
import { useToast } from '../../ui/toast'
import { confirmDialog } from '../../ui/confirm-dialog'
import { useBeforeUnloadWhenDirty } from '@/hooks/useUnsavedCloseGuard'
import { useAssignmentLeaveGuard } from '@/hooks/useAssignmentLeaveGuard'
import MCQQuestion from '../assignments/questions/MCQQuestion'
import EssayQuestion from '../assignments/questions/EssayQuestion'
import FillBlankQuestion from '../assignments/questions/FillBlankQuestion'
import ProtectedAssignmentContent from '../assignments/ProtectedAssignmentContent'
import QuestionStepper from '../assignments/QuestionStepper'

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
  word_bank?: string[]
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
  const isClosed = assignment?.due_phase === 'closed'
  const canRetake = !!retake?.allowed && !isClosed
  const hasGrade = submission?.grade !== null && submission?.grade !== undefined
  const gradeNum = submission?.grade != null
    ? typeof submission.grade === 'number' ? submission.grade : parseFloat(String(submission.grade))
    : null
  const dueDate = assignment?.due_date ? new Date(assignment.due_date) : null
  const isOverdue = dueDate ? (assignment?.due_phase ? assignment.due_phase !== 'open' : dueDate < new Date()) && !isSubmitted : false

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
  const isAnswered = useCallback((q: Question) => {
    const a = answers[q.id]
    if (!a) return false
    if (a.type === 'mcq') return typeof a.value === 'number' && a.value >= 0
    if (a.type === 'essay') return typeof a.value === 'string' && a.value.trim().length > 0
    if (a.type === 'fill_blank') return Array.isArray(a.value) && (a.value as string[]).some(v => v?.trim().length > 0)
    return false
  }, [answers])
  const answeredCount = useMemo(() => questions.filter(isAnswered).length, [isAnswered, questions])

  const takingIsDirty = mode === 'taking' && Object.keys(answers).length > 0
  useBeforeUnloadWhenDirty(takingIsDirty)

  const requestLeave = useAssignmentLeaveGuard(takingIsDirty, () => setAnswers({}))

  const leaveTaking = () => requestLeave(() => setMode('overview'))

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

    const wrapper = (children: React.ReactNode) => <div key={q.id}>{children}</div>

    if (qt === 'mcq') return wrapper(
      <MCQQuestion
        question={{ id: q.id, question: q.question || q.question_text || '', options: q.options || [], correct_answer: Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer, marks: q.marks }}
        index={idx} totalQuestions={questions.length} number={idx + 1}
        selectedAnswer={ans?.type === 'mcq' ? (typeof ans.value === 'number' ? ans.value : parseInt(String(ans.value))) : undefined}
        onAnswerChange={v => setAnswers(p => ({ ...p, [q.id]: { type: 'mcq', value: v } }))}
        showCorrectAnswer={false} disabled={false}
      />
    )
    if (qt === 'essay') return wrapper(
      <EssayQuestion
        question={{ id: q.id, question: q.question || q.question_text || '', marks: q.marks, word_limit: q.word_limit }}
        index={idx} totalQuestions={questions.length} number={idx + 1}
        answer={ans?.type === 'essay' && typeof ans.value === 'string' ? ans.value : ''}
        onAnswerChange={v => setAnswers(p => ({ ...p, [q.id]: { type: 'essay', value: v } }))}
        disabled={false}
      />
    )
    if (qt === 'fill_blank') return wrapper(
      <FillBlankQuestion
        question={{ id: q.id, question: q.question || q.question_text || '', correct_answer: q.correct_answer as string | string[], marks: q.marks, word_bank: q.word_bank }}
        index={idx} totalQuestions={questions.length} number={idx + 1}
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
      <div className="ls" aria-busy="true">
        <div className="sd-skel" style={{ height: '2.5rem', width: '70%' }} />
        <div className="sd-skel" style={{ height: '8rem' }} />
      </div>
    )
  }

  if (!assignment) {
    return (
      <LessonStage kind="assignment" title={content.title || 'Assignment'} task={null}>
        <div className="ls-card">
          <span className="ls-card-ico"><FileText aria-hidden="true" /></span>
          <b>We could not find this assignment</b>
          <p>Go back to the course and try again.</p>
        </div>
      </LessonStage>
    )
  }

  const rawType = (assignment.assignment_type ?? '').toLowerCase()
  const typeText = /mcq/.test(rawType) ? 'Multiple choice'
    : /fill/.test(rawType) ? 'Fill in the blanks'
    : /essay/.test(rawType) ? 'Writing'
    : rawType.replace(/_/g, ' ').replace(/^./, (c: string) => c.toUpperCase())

  /* ═══════════════════════════════════
     TAKING MODE
  ════════════════════════════════════ */
  if (mode === 'taking') {
    return (
      <div>
        <div className="ls" style={{ paddingBottom: 0 }}>
          <button onClick={leaveTaking} className="ls-link"><ArrowLeft className="mr-1 inline h-4 w-4" />Back to the assignment</button>
          <h1 className="ls-title">{assignment.title}</h1>
          <p className="ls-task">
            {typeText ? `${typeText} • ` : ''}{questions.length} question{questions.length !== 1 ? 's' : ''}
          </p>
        </div>

        <ProtectedAssignmentContent>
          <QuestionStepper
            count={questions.length}
            isAnswered={i => isAnswered(questions[i])}
            renderQuestion={i => renderTakingQuestion(questions[i], i)}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        </ProtectedAssignmentContent>

        {questions.length === 0 && (
          <div className="ls">
            <button onClick={handleSubmit} disabled={submitting} className="sd-btn sd-btn--amber sd-btn--lg">
              {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle aria-hidden="true" />}
              {submitting ? 'Handing in' : 'Hand it in'}
            </button>
          </div>
        )}
      </div>
    )
  }

  /* ═══════════════════════════════════
     REVIEW MODE
  ════════════════════════════════════ */
  if (mode === 'review') {
    const submittedAt = submission?.submitted_at
      ? new Date(submission.submitted_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      : null

    return (
      <div className="ls">
        <button onClick={() => setMode('overview')} className="ls-link"><ArrowLeft className="mr-1 inline h-4 w-4" />Back to the assignment</button>
        <h1 className="ls-title">{assignment.title}</h1>
        {assignment.course_title && <p className="ls-task">{assignment.course_title}</p>}

        <div className="ls-score">
          {gradeNum !== null && <ScoreRing value={gradeNum} />}
          <div className="ls-score-text">
            <b>{hasGrade && gradeNum !== null ? scoreWords(gradeNum) : 'Waiting for a grade'}</b>
            <span>{submittedAt ? `Handed in on ${submittedAt}` : 'Your teacher will mark it soon.'}</span>
          </div>
        </div>

        {submission?.feedback && (
          <div className="ls-note">
            <b><MessageSquare className="mr-1.5 inline h-4 w-4" aria-hidden="true" />Teacher feedback</b>
            <p>{submission.feedback}</p>
          </div>
        )}

        {submission?.file_url && (
          <a href={submission.file_url} target="_blank" rel="noopener noreferrer" className="sd-btn sd-btn--line" style={{ justifySelf: 'start' }}>
            <Download aria-hidden="true" />Download your file
          </a>
        )}

        {questions.length > 0 && (
          <section>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' }}>Your answers</h2>
            {hasGrade && <p className="ls-task" style={{ fontSize: '0.95rem' }}>The right answers are shown too.</p>}
            <ProtectedAssignmentContent className="border-t border-gray-100">
              {questions.map((q, i) => renderReviewQuestion(q, i))}
            </ProtectedAssignmentContent>
          </section>
        )}

        {attempts.length > 1 && (
          <section>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.6rem' }}>Your tries</h2>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Try</th>
                    <th className="px-4 py-2.5 text-left font-medium">Handed in</th>
                    <th className="px-4 py-2.5 text-right font-medium">Score</th>
                    <th className="px-4 py-2.5 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {attempts.map((a) => (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    <tr key={String((a as any).id)}>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <td className="px-4 py-3 text-gray-700">#{(a as any).attempt_number ?? '—'}</td>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <td className="px-4 py-3 text-gray-500">{(a as any).submitted_at ? new Date(String((a as any).submitted_at)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</td>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <td className="px-4 py-3 text-right font-medium text-gray-700">{(a as any).score ?? 0}/{(a as any).max_score ?? 0}</td>
                      <td className="px-4 py-3 text-right">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${(a as any).status === 'graded' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {String((a as any).status ?? '—')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {canRetake && (
          <div className="ls-score" style={{ justifyContent: 'space-between', background: 'rgb(251 191 36 / 0.12)', borderColor: 'var(--sd-amber-deep)' }}>
            <div className="ls-score-text"><b>You can try again</b><span>Your best score is the one that counts.</span></div>
            <button onClick={handleStart} className="sd-btn sd-btn--amber"><RotateCcw aria-hidden="true" />Try again</button>
          </div>
        )}
      </div>
    )
  }

  /* ═══════════════════════════════════
     OVERVIEW MODE
  ════════════════════════════════════ */
  const attemptsText = retake?.granted
    ? `${retake.current_attempts ?? 0} used, 1 extra`
    : !retake?.enabled
    ? `${retake?.current_attempts ?? 0} of 1`
    : retake.max_attempts != null
    ? `${retake.current_attempts ?? 0} of ${Number(retake.max_attempts) + 1}`
    : 'Unlimited'

  return (
    <LessonStage kind="assignment" title={assignment.title} chapterName={assignment.course_title || undefined} task={isSubmitted ? null : 'Do your best. You can check your answers before you hand in.'}>
      {assignment.description && <p className="ls-prose" style={{ fontSize: '1.1rem' }}>{assignment.description}</p>}

      <div className="sd-ledger" data-cols="3">
        <div>
          <span className="sd-l">Due</span>
          <b className="sd-n" style={{ fontSize: '1.35rem', color: isOverdue ? 'var(--sd-late)' : undefined }}>{dueDate ? formatDue(assignment.due_date) : 'No due date'}</b>
          <small>{isOverdue ? 'This is late' : '\u00a0'}</small>
        </div>
        <div><span className="sd-l">Tries</span><b className="sd-n" style={{ fontSize: '1.35rem' }}>{attemptsText}</b><small>&nbsp;</small></div>
        <div><span className="sd-l">Points</span><b className="sd-n">{assignment.max_marks ?? '—'}</b><small>&nbsp;</small></div>
      </div>

      {!isSubmitted && isClosed && (
        <p role="status" className="sd-hint">This assignment is closed and no longer accepts submissions. Ask your teacher if you need more time.</p>
      )}
      {!isSubmitted && !isClosed && (
        <button onClick={handleStart} className="sd-btn sd-btn--amber sd-btn--lg ls-big"><Play aria-hidden="true" />Start the assignment</button>
      )}
      {isSubmitted && canRetake && (
        <button onClick={handleStart} className="sd-btn sd-btn--amber sd-btn--lg ls-big"><RotateCcw aria-hidden="true" />Try again</button>
      )}

      {isSubmitted && (
        <div className="ls-score">
          {hasGrade && gradeNum !== null ? <ScoreRing value={gradeNum} /> : null}
          <div className="ls-score-text">
            <b>{hasGrade && gradeNum !== null ? scoreWords(gradeNum) : 'Waiting for a grade'}</b>
            <span>
              Handed in on {new Date(submission.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              {hasGrade ? '' : '. Your teacher will mark it soon.'}
            </span>
          </div>
          <button onClick={handleReview} className="sd-btn sd-btn--line" style={{ marginLeft: 'auto' }}><FileText aria-hidden="true" />See my answers</button>
        </div>
      )}

      {isSubmitted && submission?.feedback && (
        <div className="ls-note"><b>Teacher feedback</b><p>{submission.feedback}</p></div>
      )}

      {!isSubmitted && <p className="ls-task" style={{ fontSize: '0.95rem' }}>We keep your highest score.</p>}

      {isOverdue && (
        <div className="ls-note" role="alert" style={{ borderColor: 'var(--sd-late)' }}>
          <b style={{ color: 'var(--sd-late)' }}><AlertCircle className="mr-1.5 inline h-4 w-4" aria-hidden="true" />This assignment is late</b>
          <p>Late work may not be accepted. Tell your teacher if you need more time.</p>
        </div>
      )}

      <DoneDock auto done={isCompleted || isSubmitted} ready={false} hint="Hand in the assignment to unlock the next item." />
    </LessonStage>
  )
}
