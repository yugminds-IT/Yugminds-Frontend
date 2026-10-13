'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Badge } from '../../ui/badge'
import { CheckCircle, Loader2, ArrowDown } from 'lucide-react'
import { useCourseProgressStore } from '../../../store/course-progress-store'
import { sanitizeHtml } from '../../../lib/sanitize-html'

interface TextContentViewerProps {
  content: {
    id: string
    title: string
    content_text?: string
    content_url?: string
    chapter_id?: string
    course_id?: string
  }
  courseId?: string
  chapterId?: string
  onComplete?: () => void
}

// Minimum reading dwell before completion can be confirmed (engagement signal).
const MIN_DWELL_SECONDS = 4

export default function TextContentViewer({ content, onComplete }: TextContentViewerProps) {
  const textContent = content.content_text || 'No content available.'
  // The admin builder authors text lessons in a plain textarea; only treat it as HTML if it has tags.
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(textContent)
  const [reachedEnd, setReachedEnd] = useState(false)
  const [dwellDone, setDwellDone] = useState(false)
  const [hasCompleted, setHasCompleted] = useState(false)
  const endSentinelRef = useRef<HTMLDivElement>(null)

  const { isContentCompleted, isSaving } = useCourseProgressStore()
  const isCompleted = isContentCompleted(content.id)
  const saving = isSaving(content.id)

  // Completion is always an explicit, gated action — never silent.
  const canComplete = (reachedEnd && dwellDone) || isCompleted
  const handleMarkComplete = useCallback(() => {
    if (hasCompleted || !canComplete) return
    setHasCompleted(true)
    onComplete?.()
  }, [hasCompleted, canComplete, onComplete])

  // Minimum dwell timer.
  useEffect(() => {
    if (isCompleted) return
    const t = setTimeout(() => setDwellDone(true), MIN_DWELL_SECONDS * 1000)
    return () => clearTimeout(t)
  }, [isCompleted])

  // Detect scroll-to-end via a sentinel at the bottom of the article.
  useEffect(() => {
    if (isCompleted) return
    const el = endSentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) setReachedEnd(true) },
      { threshold: 1.0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [isCompleted])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
      {/* Title row */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <h1 className="text-xl sm:text-3xl font-semibold text-gray-900 leading-tight">{content.title}</h1>
        <div className="flex items-center gap-2 flex-shrink-0 mt-1">
          {saving && (
            <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving...
            </Badge>
          )}
          {isCompleted && !saving && (
            <Badge className="bg-green-100 text-green-700 border-0 text-xs">
              <CheckCircle className="h-3 w-3 mr-1" /> Read
            </Badge>
          )}
        </div>
      </div>

      {/* Prose content */}
      {isHtml ? (
        <article
          className="prose prose-gray max-w-none break-words prose-headings:font-semibold prose-a:text-blue-600 prose-img:mx-auto prose-img:rounded-lg prose-img:h-auto prose-img:max-w-full prose-pre:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(textContent) }}
          aria-label="Lesson content"
        />
      ) : (
        <article
          className="whitespace-pre-wrap break-words text-base leading-relaxed text-gray-700"
          aria-label="Lesson content"
        >
          {textContent}
        </article>
      )}

      {/* End-of-content sentinel */}
      <div ref={endSentinelRef} aria-hidden className="h-1" />

      {/* Mark as complete (gated) */}
      {!isCompleted && (
        <div className="mt-10 pt-8 border-t border-gray-100">
          <button
            onClick={handleMarkComplete}
            disabled={saving || !canComplete}
            className="inline-flex items-center justify-center gap-2 max-sm:w-full bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Mark as Complete
          </button>
          {!canComplete && (
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <ArrowDown className="h-3 w-3" />
              {reachedEnd
                ? 'Just a moment…'
                : 'Scroll to the end of the reading to mark it complete'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
