'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '../../ui/card'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'
import { CheckCircle, AlertCircle, Loader2, ClipboardList } from 'lucide-react'
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
      <Card className="p-6">
        <div className="text-center py-8 flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" aria-hidden="true" />
          <span className="text-gray-600">Loading assignment...</span>
          <span className="text-xs text-gray-400 mt-1">This should only take a moment</span>
        </div>
      </Card>
    )
  }

  if (!assignment) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" aria-hidden="true" />
          <p className="text-gray-500">No quiz available for this content</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-blue-600" aria-hidden="true" />
          <h2 className="text-2xl font-bold">{content.title || assignment?.title || 'Assignment'}</h2>
        </div>
        
        {/* Status badges */}
        <div className="flex items-center gap-2">
          {submission && (
            <Badge 
              className={submission.status === 'graded' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
              role="status"
              aria-label={submission.status === 'graded' ? 'Assignment graded' : 'Assignment submitted'}
            >
              {submission.status === 'graded' ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" aria-hidden="true" />
                  Graded: {submission.score}/{assignment.max_score}
                </>
              ) : (
                'Submitted'
              )}
            </Badge>
          )}
          
          {(isCompleted || saving) && !submission && (
            <Badge 
              variant="secondary" 
              className={saving ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}
              role="status"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" aria-hidden="true" /> Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" aria-hidden="true" /> Viewed
                </>
              )}
            </Badge>
          )}
        </div>
      </div>

      {(assignment?.description || content.content_text) && (
        <div 
          className="prose prose-lg max-w-none mb-6"
          dangerouslySetInnerHTML={{ 
            __html: sanitizeHtml(assignment?.description || content.content_text || '') 
          }}
          aria-label="Assignment description"
        />
      )}
      
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg" role="region" aria-label="Assignment details">
          {(() => {
            const calculatedMaxScore = questions.reduce((sum, q) => sum + (q.marks || 1), 0)
            const displayMaxScore = calculatedMaxScore > 0 ? calculatedMaxScore : assignment?.max_score
            return displayMaxScore ? (
              <p className="text-sm text-blue-800">
                <strong>Maximum Score:</strong> {displayMaxScore} points
              </p>
            ) : null
          })()}
          {assignment?.auto_grading_enabled && (
            <p className="text-sm text-blue-800 mt-1">
              <strong>Auto-grading:</strong> Enabled
            </p>
          )}
          {questions.length > 0 && (
            <p className="text-sm text-blue-800 mt-1">
              <strong>Questions:</strong> {questions.length}
            </p>
          )}
        </div>

        {assignment?.id && (
          <Button 
            className="w-full transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]" 
            size="lg"
            onClick={() => {
              router.push(`/lms/student/assignments/${assignment.id}?courseId=${courseId}&chapterId=${chapterId}`)
            }}
            aria-label={submission ? 'View your submission' : questions.length > 0 ? 'Start this assignment' : 'View assignment details'}
          >
            <CheckCircle className="h-4 w-4 mr-2" aria-hidden="true" />
            {isSubmitted ? (isPassed ? 'View Submission' : 'Retake Quiz') : questions.length > 0 ? 'Start Quiz' : 'View Assignment'}
          </Button>
        )}
        
        {questions.length > 0 && !submission && (
          <div className="mt-6">
            <h3 className="font-semibold mb-3">Preview Questions:</h3>
            <div className="space-y-3" role="list" aria-label="Question preview">
              {questions.slice(0, 3).map((q, idx: number) => (
                <div key={q.id} className="p-3 bg-gray-50 rounded-lg" role="listitem">
                  <p className="text-sm font-medium">
                    {idx + 1}. {q.question_text}
                  </p>
                  {q.question_type === 'MCQ' && q.options && Array.isArray(q.options) ? (
                    <div className="mt-2 text-xs text-gray-600">
                      Options: {String((q.options as unknown[]).length)} choices
                    </div>
                  ) : null}
                </div>
              ))}
              {questions.length > 3 && (
                <p className="text-sm text-gray-500 text-center">
                  + {questions.length - 3} more questions
                </p>
              )}
            </div>
          </div>
        )}

        {/* Gating hint */}
        {!isPassed && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500 text-center">
              {isSubmitted && autoGraded
                ? `Score at least ${Math.round(PASS_THRESHOLD * 100)}% to complete this quiz and unlock the next item.`
                : 'Submit this assignment to mark it complete and unlock the next item.'}
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
