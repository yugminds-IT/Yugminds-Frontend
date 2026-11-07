'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Check,
  ChevronDown,
  X,
  Video,
  FileText,
  ClipboardList,
  Link as LinkIcon,
  Loader2,
  Lock,
  Image as ImageIcon,
  Volume2,
} from 'lucide-react'
import { useChapterContents } from '../../../hooks/useStudentData'
import { useCourseProgressStore } from '../../../store/course-progress-store'
import { makeIsCompleted, computeItemGating } from '../../../lib/course-gating'
import Link from 'next/link'

interface Chapter {
  id: string
  name?: string
  title?: string
  order_number?: number
  order_index?: number
  is_completed?: boolean
  is_unlocked?: boolean
  unlocks_in_days?: number | null
  lock_reason?: 'time' | 'sequential' | null
  content_count?: number
  completed_count?: number
}

interface Content {
  id: string
  title: string
  name?: string
  content_type?: string
  is_completed?: boolean
}

interface CourseSidebarProps {
  courseId: string
  courseName?: string
  chapters: Chapter[]
  currentChapterId?: string
  currentContentId?: string
  /** server-authoritative counts from the player (accurate, content-level) */
  completedContentItems?: number
  totalContentItems?: number
  onChapterSelect?: (chapterId: string) => void
  onContentSelect?: (contentId: string) => void
  /** hides the desktop outline so the lesson can use the full width */
  collapsed?: boolean
  /** controls the mobile outline drawer (opened from the player's top bar) */
  mobileOpen?: boolean
  onMobileOpenChange?: (open: boolean) => void
}

function getContentTypeLabel(contentType: string): string {
  const t = (contentType || '').toLowerCase()
  if (t === 'video' || t === 'video_link') return 'Video'
  if (t === 'text' || t === 'html') return 'Reading'
  if (t === 'pdf' || t === 'file') return 'File'
  if (t === 'image') return 'Image'
  if (t === 'audio') return 'Audio'
  if (t === 'link') return 'Link'
  if (t === 'quiz') return 'Practice quiz'
  if (t === 'assignment') return 'Assignment'
  return 'Item'
}

function getContentIcon(contentType: string) {
  const t = (contentType || '').toLowerCase()
  if (t === 'video' || t === 'video_link') return Video
  if (t === 'quiz' || t === 'assignment') return ClipboardList
  if (t === 'pdf' || t === 'file') return FileText
  if (t === 'image') return ImageIcon
  if (t === 'audio') return Volume2
  if (t === 'link') return LinkIcon
  return FileText
}

export default function CourseSidebar({
  courseId,
  courseName,
  chapters,
  currentChapterId,
  currentContentId,
  completedContentItems,
  totalContentItems,
  onChapterSelect,
  onContentSelect,
  collapsed = false,
  mobileOpen = false,
  onMobileOpenChange,
}: CourseSidebarProps) {
  const setMobileOpen = (open: boolean) => onMobileOpenChange?.(open)
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    new Set(currentChapterId ? [currentChapterId] : [])
  )

  const { isChapterCompleted } = useCourseProgressStore()

  useEffect(() => {
    if (!currentChapterId) return
    const t = setTimeout(() => {
      setExpandedChapters(prev => new Set([...prev, currentChapterId]))
    }, 0)
    return () => clearTimeout(t)
  }, [currentChapterId])

  const sortedChapters = useMemo(
    () =>
      [...chapters].sort(
        (a, b) =>
          (a.order_number || a.order_index || 0) - (b.order_number || b.order_index || 0)
      ),
    [chapters]
  )

  // Counts come from the player (server-authoritative, content-level). Fall back
  // to summing the per-chapter content counts when not provided.
  const totalContent =
    totalContentItems ?? chapters.reduce((s, ch) => s + (ch.content_count || 0), 0)
  const completedContent =
    completedContentItems ?? chapters.reduce((s, ch) => s + (ch.completed_count || 0), 0)

  const toggleChapter = (id: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const pct = totalContent > 0 ? Math.round((completedContent / totalContent) * 100) : 0

  const inner = (
    <div className="cs-inner">
      <div className="cs-head">
        <div className="cs-head-top">
          <h2>{courseName || 'Course'}</h2>
          <Link
            href="/lms/student/my-courses"
            className="pl-ico"
            onClick={() => setMobileOpen(false)}
            title="Back to My courses"
            aria-label="Back to My courses"
          >
            <X />
          </Link>
        </div>
        <div className="sd-meter" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress">
          <i style={{ '--p': `${pct}%` } as React.CSSProperties} />
        </div>
        <p><span><b>{completedContent}</b> of {totalContent} items done</span><b>{pct}%</b></p>
      </div>

      <nav className="cs-list" aria-label="Course modules">
        {sortedChapters.map((chapter, idx) => {
          const isCompleted = chapter.is_completed || isChapterCompleted(chapter.id)
          const isCurrent = chapter.id === currentChapterId
          const isExpanded = expandedChapters.has(chapter.id)
          const isLocked = chapter.is_unlocked === false
          const moduleNum = chapter.order_number || chapter.order_index || idx + 1
          const state = isCompleted ? 'done' : isCurrent ? 'current' : 'todo'
          const days = chapter.unlocks_in_days ?? 0

          return (
            <div key={chapter.id} className="cs-mod" data-state={state} data-open={isExpanded && !isLocked}>
              <button
                disabled={isLocked}
                className="cs-mod-btn"
                aria-expanded={isExpanded && !isLocked}
                onClick={() => {
                  if (isLocked) return
                  toggleChapter(chapter.id)
                  onChapterSelect?.(chapter.id)
                }}
                title={
                  isLocked
                    ? chapter.lock_reason === 'time'
                      ? `Unlocks in ${days} day${days === 1 ? '' : 's'}`
                      : 'Finish the previous module to unlock'
                    : undefined
                }
              >
                <span className="cs-num" aria-hidden="true">
                  {isLocked ? <Lock /> : isCompleted ? <Check /> : moduleNum}
                </span>
                <span className="cs-mod-text">
                  <b>{chapter.name || chapter.title || `Chapter ${moduleNum}`}</b>
                  {isLocked && chapter.lock_reason === 'time' ? (
                    <small className="cs-warn">Unlocks in {days} day{days === 1 ? '' : 's'}</small>
                  ) : isLocked ? (
                    <small>Finish the previous module to unlock</small>
                  ) : (chapter.content_count ?? 0) > 0 ? (
                    <small>{chapter.completed_count ?? 0} of {chapter.content_count} items</small>
                  ) : null}
                </span>
                {!isLocked && <ChevronDown className="cs-chev" aria-hidden="true" />}
              </button>

              {isExpanded && !isLocked && (
                <ChapterContents
                  courseId={courseId}
                  chapterId={chapter.id}
                  currentContentId={currentContentId}
                  onContentSelect={id => {
                    onContentSelect?.(id)
                    setMobileOpen(false)
                  }}
                />
              )}
            </div>
          )
        })}
      </nav>
    </div>
  )

  return (
    <>
      {mobileOpen && <div className="cs-scrim lg:hidden" onClick={() => setMobileOpen(false)} />}
      <div className="cs-drawer lg:hidden" data-open={mobileOpen}>
        {inner}
      </div>
      <div className="cs-side" data-show={!collapsed}>
        {inner}
      </div>
    </>
  )
}

function ChapterContents({
  courseId,
  chapterId,
  currentContentId,
  onContentSelect,
}: {
  courseId: string
  chapterId: string
  currentContentId?: string
  onContentSelect?: (id: string) => void
}) {
  const { data: contentsRaw, isLoading } = useChapterContents(chapterId, courseId)
  const contents = contentsRaw as Content[] | undefined
  const { isContentCompleted } = useCourseProgressStore()
  const isDone = makeIsCompleted(isContentCompleted)
  const gating = contents ? computeItemGating(contents, isDone) : []

  if (isLoading) {
    return (
      <div className="cs-note flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading items
      </div>
    )
  }

  if (!contents || contents.length === 0) {
    return <div className="cs-note">No items in this module yet.</div>
  }

  return (
    <div className="cs-items">
      {contents.map((content, idx) => {
        const isCurrent = content.id === currentContentId
        const gate = gating[idx]
        const completed = gate?.completed ?? (content.is_completed || isContentCompleted(content.id))
        const locked = gate ? !gate.unlocked : false
        const typeLabel = getContentTypeLabel(content.content_type || '')
        const Icon = getContentIcon(content.content_type || '')

        return (
          <button
            key={content.id || idx}
            disabled={locked}
            data-current={isCurrent}
            data-done={!!completed}
            aria-current={isCurrent ? 'true' : undefined}
            onClick={() => { if (!locked) onContentSelect?.(content.id) }}
            title={locked ? 'Finish the previous item to unlock' : undefined}
            className="cs-item"
          >
            <span className="cs-dot" aria-hidden="true">
              {completed ? <Check /> : locked ? <Lock /> : null}
            </span>
            <span className="cs-item-text">
              <b>{content.title || content.name || `Item ${idx + 1}`}</b>
              <small><Icon />{typeLabel}</small>
            </span>
          </button>
        )
      })}
    </div>
  )
}
