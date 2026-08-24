'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  CheckCircle,
  ChevronUp,
  ChevronDown,
  Menu,
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
import { cn } from '../../../lib/utils'
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
}

function getContentTypeLabel(contentType: string): string {
  const t = (contentType || '').toLowerCase()
  if (t === 'video' || t === 'video_link') return 'Video'
  if (t === 'text' || t === 'html') return 'Reading'
  if (t === 'pdf' || t === 'file') return 'File'
  if (t === 'image') return 'Image'
  if (t === 'audio') return 'Audio'
  if (t === 'link') return 'Link'
  if (t === 'quiz') return 'Practice Quiz'
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
}: CourseSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
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

  const inner = (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h2 className="font-bold text-sm text-gray-900 leading-snug line-clamp-3 flex-1">
            {courseName || 'Course'}
          </h2>
          <Link
            href="/lms/student/my-courses"
            className="flex-shrink-0 p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
            onClick={() => setMobileOpen(false)}
            title="Back to My Courses"
          >
            <X className="h-4 w-4" />
          </Link>
        </div>
        <p className="text-[11px] text-gray-400">
          {completedContent}/{totalContent} learning items
        </p>
      </div>

      {/* Module list */}
      <nav className="flex-1 overflow-y-auto" aria-label="Course modules">
        {sortedChapters.map((chapter, idx) => {
          const isCompleted = chapter.is_completed || isChapterCompleted(chapter.id)
          const isCurrent = chapter.id === currentChapterId
          const isExpanded = expandedChapters.has(chapter.id)
          const isLocked = chapter.is_unlocked === false
          const moduleNum = chapter.order_number || chapter.order_index || idx + 1

          return (
            <div key={chapter.id} className="border-b border-gray-100">
              {/* Module header button */}
              <button
                disabled={isLocked}
                className={cn(
                  'w-full px-4 py-3.5 text-left flex items-start justify-between gap-3 transition-colors',
                  isLocked ? 'cursor-not-allowed opacity-70' : 'hover:bg-gray-50',
                  isCurrent && !isExpanded && 'bg-blue-50/70'
                )}
                onClick={() => {
                  if (isLocked) return
                  toggleChapter(chapter.id)
                  onChapterSelect?.(chapter.id)
                }}
                title={
                  isLocked
                    ? chapter.lock_reason === 'time'
                      ? `Unlocks in ${chapter.unlocks_in_days} day${chapter.unlocks_in_days === 1 ? '' : 's'}`
                      : 'Complete the previous module to unlock'
                    : undefined
                }
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">
                    Module {moduleNum}
                  </p>
                  <p
                    className={cn(
                      'text-[13px] font-semibold leading-snug',
                      isCompleted
                        ? 'text-gray-600'
                        : isCurrent
                        ? 'text-blue-700'
                        : 'text-gray-900'
                    )}
                  >
                    {chapter.name || chapter.title || `Chapter ${moduleNum}`}
                  </p>
                  {isLocked && chapter.lock_reason === 'time' && (
                    <p className="text-[11px] text-amber-600 font-medium mt-0.5">
                      Unlocks in {chapter.unlocks_in_days} day{chapter.unlocks_in_days === 1 ? '' : 's'}
                    </p>
                  )}
                  {isLocked && chapter.lock_reason === 'sequential' && (
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Complete the previous module to unlock
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                  {isLocked ? (
                    <Lock className="h-4 w-4 text-gray-400" />
                  ) : isCompleted ? (
                    <CheckCircle className="h-4 w-4 text-green-600" fill="none" />
                  ) : null}
                  {!isLocked &&
                    (isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ))}
                </div>
              </button>

              {/* Content items */}
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
      {/* Mobile FAB */}
      <button
        className="lg:hidden fixed bottom-20 left-4 z-50 bg-blue-600 text-white rounded-full p-3 shadow-lg"
        onClick={() => setMobileOpen(true)}
        aria-label="Open course menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={cn(
          'lg:hidden fixed top-0 left-0 h-full w-80 z-50 shadow-2xl transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {inner}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col w-72 flex-shrink-0 border-r border-gray-200 overflow-hidden h-full">
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
      <div className="px-4 py-3 flex items-center gap-2 text-xs text-gray-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading...
      </div>
    )
  }

  if (!contents || contents.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-gray-400 italic">No content available</div>
    )
  }

  return (
    <div className="bg-gray-50/40">
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
            onClick={() => { if (!locked) onContentSelect?.(content.id) }}
            title={locked ? 'Complete the previous item to unlock' : undefined}
            className={cn(
              'w-full px-4 py-3 flex items-start gap-3 text-left transition-colors border-b border-gray-100 last:border-0',
              locked
                ? 'cursor-not-allowed opacity-60'
                : isCurrent
                ? 'bg-blue-50 hover:bg-blue-100/80'
                : 'hover:bg-gray-100/70'
            )}
          >
            {/* Completion circle */}
            <div
              className={cn(
                'w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center border-2 transition-colors',
                completed
                  ? 'bg-green-500 border-green-500 text-white'
                  : locked
                  ? 'border-gray-200 bg-gray-50'
                  : isCurrent
                  ? 'border-blue-500'
                  : 'border-gray-300'
              )}
            >
              {completed && <CheckCircle className="h-3 w-3 fill-white text-white" />}
              {!completed && locked && <Lock className="h-2.5 w-2.5 text-gray-400" />}
              {isCurrent && !completed && !locked && (
                <div className="w-2 h-2 rounded-full bg-blue-500" />
              )}
            </div>

            {/* Title + type */}
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'text-xs leading-snug',
                  isCurrent
                    ? 'font-semibold text-blue-800'
                    : completed
                    ? 'text-gray-500'
                    : locked
                    ? 'text-gray-400'
                    : 'text-gray-800 font-medium'
                )}
              >
                {content.title || content.name || `Content ${idx + 1}`}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                <Icon className="h-3 w-3" />
                {typeLabel}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
