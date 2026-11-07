'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { LessonStage, DoneDock } from './LessonStage'
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

  // The bar at the top fills as the child scrolls the lesson.
  const rootRef = useRef<HTMLDivElement>(null)
  const [read, setRead] = useState(0)
  useEffect(() => {
    const scroller = rootRef.current?.closest('.pl-body') as HTMLElement | null
    if (!scroller) return
    const onScroll = () => {
      const max = scroller.scrollHeight - scroller.clientHeight
      setRead(max > 0 ? Math.min(1, scroller.scrollTop / max) : 1)
    }
    onScroll()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [content.id])

  return (
    <div ref={rootRef}>
      <div className="ls-read" style={{ '--r': read } as React.CSSProperties} aria-hidden="true"><i /></div>
      <LessonStage kind="reading" title={content.title}>
        {isHtml ? (
          <article className="ls-prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(textContent) }} aria-label="Lesson content" />
        ) : (
          <article className="ls-prose" style={{ whiteSpace: 'pre-wrap' }} aria-label="Lesson content">
            {textContent}
          </article>
        )}

        {/* End-of-content sentinel */}
        <div ref={endSentinelRef} aria-hidden className="h-1" />

        <DoneDock
          done={isCompleted}
          saving={saving}
          ready={canComplete && !hasCompleted}
          progress={read}
          hint={reachedEnd ? 'Just a moment.' : 'Keep scrolling down to the end.'}
          onDone={handleMarkComplete}
        />
      </LessonStage>
    </div>
  )
}
