'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Play, RotateCcw, FileText } from 'lucide-react'
import { LessonStage, DoneDock } from './LessonStage'
import ScoreRing, { scoreWords } from '../../portal/ScoreRing'
import { getStoredUserId } from '../../../lib/session-utils'
import { studentApi } from '../../../lib/api'
import { useCourseProgressStore } from '../../../store/course-progress-store'
import { sanitizeHtml } from '../../../lib/sanitize-html'

interface QuizContentViewerProps {
  content: {
    id: string
    title: string
    content_url?: string
    source?: string
    content_text?: string
    max_score?: number
    auto_grading_enabled?: boolean
  }
  courseId: string
  chapterId: string
  onComplete?: () => void
}

interface Assignment {
  id: string
  title: string
  description?: string
  max_score?: number
  auto_grading_enabled?: boolean
  chapter_id?: string
}

interface Question {
  id: string
  question_text: string
  question_type: string
  options?: unknown
  marks?: number
}

interface Submission {
  id: string
  status: string
  score?: number
  submitted_at?: string
}

export default function QuizContentViewer({
  content, 
  courseId, 
  chapterId,
  onComplete 
}: QuizContentViewerProps) {
  const router = useRouter()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<Question[]>([])
  const [submission, setSubmission] = useState<Submission | null>(null)
  
  const hasCompletedRef = useRef(false)

  // Global progress store
  const { 
    setContentCompleted, 
    isContentCompleted,
    isSaving 
  } = useCourseProgressStore()

  const isCompleted = isContentCompleted(content.id)
  const saving = isSaving(content.id)

  useEffect(() => {
    const fetchAssignment = async () => {
      try {
        console.log('🚀 [QuizViewer] Starting assignment fetch...', { contentId: content.id, chapterId })
        
        const startTime = performance.now()
        const _userId = getStoredUserId()
        
        let assignmentId: string | null = null
        let assignmentData: Assignment | null = null

        // Step 1: Get assignment data (optimized)
        if (content.source === 'assignments' && content.id) {
          // Use content data directly (fastest path)
          assignmentId = content.id
          assignmentData = {
            id: content.id,
            title: content.title,
            description: content.content_text || '',
            max_score: content.max_score,
            auto_grading_enabled: content.auto_grading_enabled,
            chapter_id: chapterId,
          }
          console.log('✅ [QuizViewer] Using content data directly')
        } else {
          // Fallback: Query via API
          console.log('🔍 [QuizViewer] Querying assignments via API...')
          try {
            const { data: assignmentsRes } = await studentApi.assignments.list({ chapter_id: chapterId })
            const assignments = (assignmentsRes as { assignments?: Array<{ id: string; title?: string; description?: string; max_score?: number; auto_grading_enabled?: boolean; chapter_id?: string }> })?.assignments || []
            if (assignments.length > 0) {
              const assignmentRow = assignments[0]
              assignmentData = {
                id: assignmentRow.id,
                title: assignmentRow.title ?? '',
                description: assignmentRow.description,
                max_score: assignmentRow.max_score,
                auto_grading_enabled: assignmentRow.auto_grading_enabled,
                chapter_id: assignmentRow.chapter_id,
              }
              assignmentId = assignmentRow.id
              console.log('✅ [QuizViewer] Found assignment via API')
            }
          } catch (err) {
            console.error('❌ [QuizViewer] Assignment API error:', err)
            throw err
          }
        }

        if (!assignmentId || !assignmentData) {
          console.log('⚠️ [QuizViewer] No assignment found')
          setLoading(false)
          return
        }

        setAssignment(assignmentData)

        // Step 2: Fetch assignment details (questions, submission) via API
        console.log('🔄 [QuizViewer] Fetching assignment details via API...')
        
        try {
          const { data: detailRes } = await studentApi.assignments.get(assignmentId)
          const detail = detailRes as {
            assignment?: { questions?: Array<{ id: string; question_text: string; question_type: string; options: unknown; marks: number }> };
            submission?: { id: string; status: string; score?: number; submitted_at?: string } | null;
          }

          if (detail?.assignment?.questions) {
            setQuestions(detail.assignment.questions)
            console.log(`✅ [QuizViewer] Loaded ${detail.assignment.questions.length} questions`)
          }

          if (detail?.submission) {
            // Completion is decided by the pass/submit rule below, not merely by
            // a submission existing.
            setSubmission(detail.submission as unknown as Submission)
            console.log('✅ [QuizViewer] Found existing submission')
          }
        } catch (err) {
          console.warn('⚠️ [QuizViewer] Error fetching assignment details:', err)
        }

        // Check progress via store (no separate server call needed)
        if (isContentCompleted(content.id)) {
          hasCompletedRef.current = true
          console.log('✅ [QuizViewer] Content already completed in store')
        }

        const endTime = performance.now()
        console.log(`⚡ [QuizViewer] Assignment loaded in ${Math.round(endTime - startTime)}ms`)

      } catch (error) {
        console.error('❌ [QuizViewer] Error fetching assignment:', error)
      } finally {
        setLoading(false)
      }
    }

    if (chapterId) {
      fetchAssignment()
    } else {
      setLoading(false)
    }
  }, [content.id, content.auto_grading_enabled, content.content_text, content.max_score, content.source, content.title, chapterId, courseId, isContentCompleted, setContentCompleted])

  // ── Pass / submit rule ──────────────────────────────────────────────────────
  // A quiz counts as complete only when there is a real submission. For an
  // auto-graded quiz with a max score we additionally require >= 50%; otherwise a
  // submission (pending manual grading) is enough.
  const PASS_THRESHOLD = 0.5
  const isSubmitted = !!(
    submission &&
    (submission.status === 'submitted' || submission.status === 'graded' || submission.submitted_at)
  )
  const maxScore =
    questions.reduce((sum, q) => sum + (q.marks || 1), 0) || assignment?.max_score || 0
  const autoGraded = !!assignment?.auto_grading_enabled
  const isPassed = (() => {
    if (!isSubmitted) return false
    if (autoGraded && maxScore > 0 && submission?.status === 'graded' && submission.score != null) {
      return submission.score / maxScore >= PASS_THRESHOLD
    }
    return true // submitted (or awaiting manual grade) counts
  })()

  // Record completion when (and only when) the pass/submit rule is satisfied.
  useEffect(() => {
    if (isPassed && !hasCompletedRef.current) {
      hasCompletedRef.current = true
      setContentCompleted(content.id, chapterId, courseId, true)
      onComplete?.()
    }
  }, [isPassed, content.id, chapterId, courseId, onComplete, setContentCompleted])

  if (loading) {
    return (
      <div className="ls" aria-busy="true">
        <div className="sd-skel" style={{ height: '2.5rem', width: '70%' }} />
        <div className="sd-skel" style={{ height: '8rem' }} />
      </div>
    )
  }

  if (!assignment) {
    return (
      <LessonStage kind="quiz" title={content.title || 'Quiz'} task={null}>
        <div className="ls-card">
          <span className="ls-card-ico"><FileText aria-hidden="true" /></span>
          <b>This quiz is not ready yet</b>
          <p>Ask your teacher to add the questions.</p>
        </div>
      </LessonStage>
    )
  }

  const displayMax = maxScore > 0 ? maxScore : assignment.max_score
  const graded = submission?.status === 'graded' && submission.score != null && displayMax
  const pct = graded ? Math.round(((submission?.score ?? 0) / (displayMax as number)) * 100) : null
  const description = assignment?.description || content.content_text || ''
  const goLabel = isSubmitted ? (isPassed ? 'See my answers' : 'Try the quiz again') : questions.length > 0 ? 'Start the quiz' : 'See the details'
  const GoIcon = isSubmitted && !isPassed ? RotateCcw : Play

  return (
    <LessonStage kind="quiz" title={content.title || assignment?.title || 'Quiz'}>
      {description && (
        <div className="ls-prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(description) }} aria-label="Quiz description" />
      )}

      <ul className="ls-facts" aria-label="About this quiz">
        {questions.length > 0 && <li>{questions.length} question{questions.length === 1 ? '' : 's'}</li>}
        {displayMax ? <li>{displayMax} point{displayMax === 1 ? '' : 's'}</li> : null}
        {autoGraded && <li>Marked for you straight away</li>}
      </ul>

      {submission && (
        <div className="ls-score">
          {pct != null ? <ScoreRing value={pct} /> : null}
          <div className="ls-score-text">
            <b>{pct != null ? scoreWords(pct) : 'Handed in'}</b>
            <span>
              {pct != null
                ? `You scored ${submission.score} out of ${displayMax}.`
                : 'Your teacher will mark it soon.'}
            </span>
          </div>
        </div>
      )}

      {assignment?.id && (
        <button
          className="sd-btn sd-btn--amber sd-btn--lg ls-big"
          onClick={() => router.push(`/lms/student/assignments/${assignment.id}?courseId=${courseId}&chapterId=${chapterId}`)}
        >
          <GoIcon aria-hidden="true" />
          {goLabel}
        </button>
      )}

      {questions.length > 0 && !submission && (
        <details className="ls-note">
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Peek at the first questions</summary>
          <ol style={{ margin: '0.75rem 0 0', paddingLeft: '1.25rem', display: 'grid', gap: '0.5rem' }}>
            {questions.slice(0, 3).map(q => <li key={q.id}>{q.question_text}</li>)}
          </ol>
          {questions.length > 3 && <p style={{ marginTop: '0.5rem' }}>and {questions.length - 3} more.</p>}
        </details>
      )}

      <DoneDock
        auto
        done={isCompleted || isPassed}
        ready={false}
        saving={saving}
        hint={
          isSubmitted && autoGraded
            ? `Score at least ${Math.round(PASS_THRESHOLD * 100)}% to unlock the next item.`
            : 'Hand in the quiz to unlock the next item.'
        }
      />
    </LessonStage>
  )
}
