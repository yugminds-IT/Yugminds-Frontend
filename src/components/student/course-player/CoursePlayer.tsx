'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import CourseSidebar from './CourseSidebar'
import CourseOverview from './CourseOverview'
import VideoContentViewer from './VideoContentViewer'
import TextContentViewer from './TextContentViewer'
import PDFContentViewer from './PDFContentViewer'
import QuizContentViewer from './QuizContentViewer'
import AssignmentContentViewer from './AssignmentContentViewer'
import LessonTabs from './LessonTabs'
import ErrorBoundary from './ErrorBoundary'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import {
  useCourseWithRealtime,
  useCourseChapters,
  useChapterContents,
  useStudentAssignments,
  useStudentDailyAssignments,
} from '../../../hooks/useStudentData'
import { Card } from '../../ui/card'
import { Button } from '../../ui/button'
import { useCourseProgressStore } from '../../../store/course-progress-store'
import { useToast } from '../../ui/toast'
import { makeIsCompleted, computeItemGating, firstIncompleteIndex } from '../../../lib/course-gating'

import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  FileText,
  Loader2,
  Play,
  ArrowRight,
  Lock,
  X,
  AlertCircle,
} from 'lucide-react'
import { getStoredUserId } from '../../../lib/session-utils'
import { studentApi } from '../../../lib/api'
import CircularProgress from '../CircularProgress'

interface CoursePlayerProps {
  courseId: string
}

interface Content {
  id: string
  title: string
  name?: string
  content_type?: string
  content_url?: string
  content_text?: string
  chapter_id?: string
  course_id?: string
  source?: string
  max_score?: number
  auto_grading_enabled?: boolean
  is_completed?: boolean
  [key: string]: unknown
}

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
  [key: string]: unknown
}

interface Course {
  id: string
  name?: string
  title?: string
  course_name?: string
  description?: string
  thumbnail_url?: string
  is_published?: boolean
  status?: string
  progress_percentage?: number
  [key: string]: unknown
}

export default function CoursePlayer({ courseId: propCourseId }: CoursePlayerProps) {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const isResuming = searchParams?.get('resume') === '1'
  const [chapterId, setChapterId] = useState<string | undefined>(
    () => searchParams?.get('chapter') || undefined
  )
  const [contentId, setContentId] = useState<string | undefined>(
    () => searchParams?.get('content') || undefined
  )
  const courseId = propCourseId || (params?.courseId as string | undefined)

  const { data: course, isLoading: courseLoading, error: courseError } = useCourseWithRealtime(courseId || '')
  const { data: chaptersRaw, isLoading: chaptersLoading, error: chaptersError } = useCourseChapters(courseId || '')
  const chapters = chaptersRaw as Chapter[] | undefined
  const { data: contentsRaw, isLoading: contentsLoading, error: contentsError } = useChapterContents(
    chapterId || '',
    courseId || undefined
  )
  const contents = contentsRaw as Content[] | undefined
  const [currentContentIndex, setCurrentContentIndex] = useState(0)
  const [retryCount, setRetryCount] = useState(0)
  // Up-next auto-advance (Udemy-style): countdown after a lesson is completed.
  const [upNextCountdown, setUpNextCountdown] = useState<number | null>(null)
  const upNextShownRef = useRef<Set<string>>(new Set())
  // Root element for the F-key fullscreen shortcut.
  const playerRootRef = useRef<HTMLDivElement>(null)
  // Latest-handler refs (assigned each render) keep the timer/key effects stable.
  const handleNextRef = useRef<() => void>(() => {})
  const handlePrevRef = useRef<() => void>(() => {})

  const {
    ensureOwner,
    isContentCompleted,
    setContentCompleted,
    setChapterCompleted,
    setLastViewed,
    getLastViewed,
    setSavingProgress,
  } = useCourseProgressStore()

  const toast = useToast()
  const queryClient = useQueryClient()

  // ── Deadline nudge: homework due today / overdue, surfaced inside the player ─
  // Uses the same cached queries as the dashboard, so this adds no extra load
  // when the student navigated here from the dashboard.
  const { data: courseAssignmentsData } = useStudentAssignments()
  const { data: dailyAssignmentsData } = useStudentDailyAssignments()
  const [dueBannerDismissed, setDueBannerDismissed] = useState(true)
  // One dismissal per day (key derived in the effect — no Date read during render).
  const dueBannerKeyRef = useRef('')
  useEffect(() => {
    const key = `yug-due-banner-${new Date().toDateString()}`
    dueBannerKeyRef.current = key
    try {
      setDueBannerDismissed(sessionStorage.getItem(key) === '1')
    } catch {
      setDueBannerDismissed(false)
    }
  }, [])

  interface DueItem {
    id?: string
    title?: string
    status?: string
    is_overdue?: boolean
    days_until_due?: number
    submission?: unknown
  }
  const urgentAssignments = (() => {
    const all = [
      ...(Array.isArray(courseAssignmentsData) ? (courseAssignmentsData as DueItem[]) : []),
      ...(Array.isArray(dailyAssignmentsData) ? (dailyAssignmentsData as DueItem[]) : []),
    ]
    const seen = new Set<string>()
    return all.filter(a => {
      if (!a.id || seen.has(a.id)) return false
      seen.add(a.id)
      const pending = (a.status === 'not_started' || a.status === 'pending' || a.status == null) && !a.submission
      return pending && (a.is_overdue || a.days_until_due === 0)
    })
  })()

  const dismissDueBanner = () => {
    setDueBannerDismissed(true)
    try { sessionStorage.setItem(dueBannerKeyRef.current, '1') } catch { /* ignore */ }
  }

  // Combined completion predicate: server truth OR optimistic overlay.
  const isDone = makeIsCompleted(isContentCompleted)

  // ── Bind the progress cache to the current user (wipes any prior user's data) ─
  useEffect(() => {
    ensureOwner(getStoredUserId())
  }, [ensureOwner])

  const currentChapter = chapters?.find((c: Chapter) => c.id === chapterId)

  // Find currentContent
  let currentContent: Content | null = null
  if (contents && Array.isArray(contents) && contents.length > 0) {
    if (contentId) {
      currentContent = contents.find((c: Content) => c.id === contentId) || null
      if (currentContent) {
        const idx = contents.findIndex((c: Content) => c.id === contentId)
        if (idx >= 0 && idx !== currentContentIndex) setCurrentContentIndex(idx)
      }
    }
    if (!currentContent) currentContent = contents[currentContentIndex] || null
  }

  const isCompleted = currentContent ? isDone(currentContent) : false

  // ── Accurate, content-level progress (server-authoritative counts) ──────────
  const totalContentItems = (chapters || []).reduce((acc, ch) => acc + (ch.content_count || 0), 0)
  const completedContentItems = (chapters || []).reduce(
    (acc, ch) => acc + (ch.completed_count || 0),
    0
  )
  const overallProgressPercent =
    totalContentItems > 0 ? Math.round((completedContentItems / totalContentItems) * 100) : 0

  const sortedChapters =
    chapters && chapters.length > 0
      ? [...chapters].sort(
          (a: Chapter, b: Chapter) =>
            (a.order_number || a.order_index || 0) - (b.order_number || b.order_index || 0)
        )
      : ([] as Chapter[])

  // Within-chapter gating for the active chapter
  const gating = contents && Array.isArray(contents) ? computeItemGating(contents, isDone) : []
  const currentGate = currentContent ? gating.find(g => g.id === currentContent!.id) : undefined
  const currentUnlocked = currentGate?.unlocked ?? true

  let nextChapter: Chapter | null = null
  if (chapterId && sortedChapters.length > 0) {
    const idx = sortedChapters.findIndex((c: Chapter) => c.id === chapterId)
    if (idx >= 0 && idx < sortedChapters.length - 1) nextChapter = sortedChapters[idx + 1]
  }
  // The next chapter is reachable once it is unlocked OR once every item in the
  // current chapter is done (covers the moment before the chapters query refetches).
  const currentChapterAllDone =
    !!contents && Array.isArray(contents) && contents.length > 0 && contents.every(isDone)
  const nextChapterReachable =
    !!nextChapter && (nextChapter.is_unlocked !== false || currentChapterAllDone)

  // Is there a next item to advance to (within this chapter or the next module)?
  const hasNextItem =
    (!!contents && currentContentIndex < contents.length - 1) || nextChapterReachable
  const nextItemLabel =
    contents && currentContentIndex < contents.length - 1
      ? contents[currentContentIndex + 1]?.title
      : nextChapterReachable && nextChapter
      ? nextChapter.name || nextChapter.title || 'Next module'
      : null

  const courseName =
    (course as Course)?.name ||
    (course as Course)?.title ||
    (course as Course)?.course_name ||
    'Course'

  // ── Effects ──────────────────────────────────────────────────────────────

  // Persist last-viewed position (local per-user + server) for resume.
  useEffect(() => {
    if (!courseId || !chapterId) return
    setLastViewed(courseId, {
      chapterId,
      contentId: contentId || undefined,
      chapterTitle: currentChapter?.name || currentChapter?.title,
      contentTitle: currentContent?.title || undefined,
    })
    studentApi.progress
      .saveLastViewed({ courseId, chapterId, contentId: contentId || undefined })
      .catch(() => {})
  }, [courseId, chapterId, contentId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep currentContentIndex in sync with contentId
  useEffect(() => {
    let rafId: number | undefined
    if (contents && Array.isArray(contents) && contentId) {
      const index = contents.findIndex((c: Content) => c.id === contentId)
      if (index >= 0 && index !== currentContentIndex) {
        rafId = requestAnimationFrame(() => setCurrentContentIndex(index))
      }
    } else if (contents && Array.isArray(contents) && !contentId && contents.length > 0) {
      if (currentContentIndex >= contents.length) {
        rafId = requestAnimationFrame(() => setCurrentContentIndex(0))
      }
    }
    return () => { if (rafId != null) cancelAnimationFrame(rafId) }
  }, [contentId, contents, currentContentIndex, chapterId, chapters])

  // When a chapter is open but no item selected, land on the first INCOMPLETE item
  // (everything before it is complete, so it is guaranteed unlocked).
  useEffect(() => {
    if (!courseId || !chapterId || contentsLoading || contentId) return
    if (contents && contents.length > 0) {
      const idx = firstIncompleteIndex(contents, isDone)
      const target = idx >= 0 ? contents[idx] : contents[0]
      if (target?.id) setContentId(target.id)
    }
  }, [chapterId, contentId, contents, contentsLoading, courseId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Resume flow: only auto-open a chapter when the student clicked "Continue"
  // (?resume=1). Otherwise we show the course overview landing.
  useEffect(() => {
    if (chapterId || !isResuming || chaptersLoading || !chapters || chapters.length === 0) return
    const sorted = [...chapters].sort(
      (a: Chapter, b: Chapter) =>
        (a.order_number || a.order_index || 0) - (b.order_number || b.order_index || 0)
    )
    const lastViewed = getLastViewed(courseId || '')
    const lvChapter =
      lastViewed?.chapterId &&
      sorted.find(c => c.id === lastViewed.chapterId && c.is_unlocked !== false)
    if (lvChapter) {
      setChapterId(lastViewed!.chapterId)
      if (lastViewed!.contentId) setContentId(lastViewed!.contentId)
      return
    }
    const target =
      sorted.find((c: Chapter) => !c.is_completed && c.is_unlocked !== false) || sorted[0]
    setChapterId(target.id)
    setContentId(undefined)
  }, [chapterId, isResuming, chaptersLoading, chapters, courseId, getLastViewed])

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleNext = async () => {
    // Strict gating: cannot advance until the current item is complete.
    if (!isCompleted) {
      toast.info('Complete this item to continue')
      return
    }
    if (contents && Array.isArray(contents) && currentContentIndex < contents.length - 1) {
      const next = contents[currentContentIndex + 1]
      if (next?.id) { setCurrentContentIndex(currentContentIndex + 1); setContentId(next.id) }
    } else if (nextChapterReachable && nextChapter?.id) {
      setChapterId(nextChapter.id); setContentId(undefined)
    } else {
      toast.success('Course completed! 🎉')
      setChapterId(undefined); setContentId(undefined)
      router.push('/lms/student/my-courses')
    }
  }

  const handlePrevious = () => {
    if (currentContentIndex > 0) {
      const prevIdx = currentContentIndex - 1
      setCurrentContentIndex(prevIdx)
      const prev = (contents as Content[])?.[prevIdx]
      if (prev) setContentId(prev.id)
    }
  }

  const swipeTouchStartX = useRef<number | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    swipeTouchStartX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (swipeTouchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - swipeTouchStartX.current
    swipeTouchStartX.current = null
    if (Math.abs(dx) < 60) return
    if (dx < 0) handleNext()
    else handlePrevious()
  }

  const handleMarkComplete = useCallback(async () => {
    if (!currentContent || !chapterId || !courseId) return false
    const userId = getStoredUserId()
    if (!userId) { toast.error('Please log in to save progress'); return false }

    // Optimistic overlay — instant UI feedback (reconciled by refetch below).
    setContentCompleted(currentContent.id, chapterId, courseId, true)
    setSavingProgress(currentContent.id, true)

    let allDone = false
    if (contents && Array.isArray(contents)) {
      allDone = contents.every(
        (c: Content) => c.id === currentContent!.id || isDone(c)
      )
      if (allDone) setChapterCompleted(chapterId, courseId, true, 100)
    }

    try {
      await studentApi.progress.simpleSave({ courseId, chapterId, contentId: currentContent.id, isCompleted: true })
      if (allDone) {
        await studentApi.progress.simpleSave({ courseId, chapterId, isCompleted: true }).catch(() => {})
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['courseChapters', courseId] }),
        queryClient.invalidateQueries({ queryKey: ['studentDashboardStats'] }),
        queryClient.invalidateQueries({ queryKey: ['studentCourses'] }),
        queryClient.invalidateQueries({ queryKey: ['chapterContents', chapterId] }),
      ])
      toast.success(allDone ? 'Chapter completed! 🎉' : 'Progress saved!', allDone ? 3000 : 2000)
      return true
    } catch (error) {
      const msg = error instanceof Error ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || error.message : 'Unexpected error'
      toast.error(`Failed to save progress: ${msg}`)
      return false
    } finally {
      setSavingProgress(currentContent.id, false)
    }
  }, [currentContent, chapterId, courseId, contents, isDone, setContentCompleted, setChapterCompleted, setSavingProgress, toast, queryClient])

  // Latest-handler refs so the timer/keyboard effects stay stable across renders.
  handleNextRef.current = () => { void handleNext() }
  handlePrevRef.current = handlePrevious

  // ── Up-next auto-advance ───────────────────────────────────────────────────
  // When the current lesson is complete and another item follows, surface a
  // short countdown that auto-advances (cancelable).
  useEffect(() => {
    if (!currentContent) return
    const id = currentContent.id
    if (isCompleted && hasNextItem && !upNextShownRef.current.has(id)) {
      upNextShownRef.current.add(id)
      setUpNextCountdown(5)
    }
  }, [isCompleted, currentContent, hasNextItem])

  useEffect(() => {
    if (upNextCountdown === null) return
    if (upNextCountdown <= 0) {
      setUpNextCountdown(null)
      handleNextRef.current()
      return
    }
    const t = setTimeout(() => setUpNextCountdown((c) => (c === null ? null : c - 1)), 1000)
    return () => clearTimeout(t)
  }, [upNextCountdown])

  // Dismiss the card whenever the active item changes.
  useEffect(() => {
    setUpNextCountdown(null)
  }, [contentId, chapterId])

  // ── Keyboard shortcuts: ← prev · → next · F fullscreen ─────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return
      if (e.key === 'ArrowLeft') handlePrevRef.current()
      else if (e.key === 'ArrowRight') { if (isCompleted) handleNextRef.current() }
      else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        const root = playerRootRef.current
        if (!document.fullscreenElement) root?.requestFullscreen?.().catch(() => {})
        else document.exitFullscreen?.().catch(() => {})
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isCompleted])

  // ── Content renderer ──────────────────────────────────────────────────────

  const chapterDisplayName = currentChapter?.name || currentChapter?.title || ''

  const renderContentViewer = (): React.ReactNode => {
    if (contentsLoading) {
      return (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        </div>
      )
    }
    if (contentsError) {
      return (
        <div className="max-w-3xl mx-auto px-6 py-12 text-center text-gray-500">
          <FileText className="h-14 w-14 mx-auto mb-4 text-gray-300" />
          <p className="text-red-600 mb-1">Error loading content</p>
          <p className="text-sm">{contentsError.message}</p>
        </div>
      )
    }
    if (!contents || contents.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <FileText className="h-14 w-14 mb-4 opacity-30" />
          <p className="text-sm">No content available for this chapter</p>
        </div>
      )
    }
    if (!currentContent) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <Play className="h-14 w-14 mb-4 opacity-20" />
          <p className="text-sm">Select a lesson from the sidebar to start</p>
        </div>
      )
    }

    // Strict gating: a locked item cannot be opened.
    if (!currentUnlocked) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center text-gray-500 px-6">
          <div className="bg-gray-100 rounded-full p-4 mb-4">
            <Lock className="h-8 w-8 text-gray-400" />
          </div>
          <p className="font-semibold text-gray-700 mb-1">This item is locked</p>
          <p className="text-sm max-w-sm">
            Complete the previous item to unlock <span className="font-medium">{currentContent.title}</span>.
          </p>
        </div>
      )
    }

    const contentType = (currentContent.content_type || '').toLowerCase()
    switch (contentType) {
      case 'video':
      case 'video_link':
        return (
          <VideoContentViewer
            key={currentContent.id}
            content={currentContent as { id: string; title: string; content_url?: string; content_type?: string; chapter_id?: string; course_id?: string }}
            courseId={courseId}
            chapterId={chapterId}
            onComplete={handleMarkComplete}
          />
        )
      case 'text':
      case 'html':
        return (
          <TextContentViewer
            key={currentContent.id}
            content={currentContent as { id: string; title: string; content_text?: string; content_url?: string; chapter_id?: string; course_id?: string }}
            courseId={courseId}
            chapterId={chapterId}
            onComplete={handleMarkComplete}
          />
        )
      // image/audio/link share this viewer: it already owns the explicit
      // "Mark as Complete" path these types need. Without a case here they
      // fell to the default branch, which offers no completion control — so
      // `nextDisabled = !isCompleted` never cleared and a single image lesson
      // permanently blocked every item after it.
      case 'pdf':
      case 'file':
      case 'image':
      case 'audio':
      case 'link':
        return (
          <PDFContentViewer
            key={currentContent.id}
            content={currentContent as { id: string; title: string; content_url?: string; content_type?: string; chapter_id?: string; course_id?: string }}
            courseId={courseId}
            chapterId={chapterId}
            chapterName={chapterDisplayName}
            onComplete={handleMarkComplete}
          />
        )
      case 'quiz':
        return (
          <QuizContentViewer
            key={currentContent.id}
            content={currentContent as { id: string; title: string; content_url?: string; source?: string; content_text?: string; max_score?: number; auto_grading_enabled?: boolean }}
            courseId={courseId || ''}
            chapterId={chapterId || ''}
            onComplete={handleMarkComplete}
          />
        )
      case 'assignment':
        return (
          <AssignmentContentViewer
            key={currentContent.id}
            content={currentContent as { id: string; title: string; content_text?: string; chapter_id?: string; course_id?: string }}
            courseId={courseId || ''}
            chapterId={chapterId || ''}
            onComplete={handleMarkComplete}
          />
        )
      default:
        return (
          <div className="max-w-3xl mx-auto px-6 py-12 text-center text-gray-400">
            <FileText className="h-14 w-14 mx-auto mb-4 opacity-30" />
            <p>Unsupported content type: {contentType}</p>
          </div>
        )
    }
  }

  // ── Error handling ────────────────────────────────────────────────────────

  useEffect(() => {
    if (courseError || chaptersError || contentsError) {
      const error = courseError || chaptersError || contentsError
      console.error('[CoursePlayer] Error:', error instanceof Error ? error.message : String(error))
    }
  }, [courseError, chaptersError, contentsError, courseId, chapterId, contentId, retryCount])

  const handleRetry = () => {
    if (retryCount < 3) { setRetryCount(p => p + 1); window.location.reload() }
  }

  if (courseError || chaptersError) {
    const error = courseError || chaptersError
    interface SupabaseError { code?: string; message?: string }
    const errorCode = (error as SupabaseError)?.code
    const canRetry = retryCount < 3 && errorCode !== 'NO_ACCESS' && errorCode !== 'ACCESS_DENIED'

    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">
            {errorCode === 'NO_ACCESS' ? 'Access Denied' : 'Error Loading Course'}
          </h2>
          <p className="text-gray-700 mb-4">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <Button onClick={() => router.push('/lms/student/my-courses')} variant="outline">
              Back to Courses
            </Button>
            {canRetry && <Button onClick={handleRetry}>Retry</Button>}
          </div>
        </Card>
      </div>
    )
  }

  if (courseLoading || chaptersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!courseId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Course ID is missing</p>
      </div>
    )
  }

  // No chapter selected — show the course overview landing (unless resuming, in
  // which case the resume effect above is about to pick a chapter).
  if (!chapterId) {
    if (isResuming) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )
    }
    return (
      <CourseOverview
        courseId={courseId}
        course={course as Course}
        chapters={sortedChapters}
        courseName={courseName}
        overallProgressPercent={overallProgressPercent}
        completedContentItems={completedContentItems}
        totalContentItems={totalContentItems}
        onStart={(chId, ctId) => { setChapterId(chId); setContentId(ctId) }}
        onExit={() => router.push('/lms/student/my-courses')}
      />
    )
  }

  // ── Coursera 3-column player layout ──────────────────────────────────────

  const isLastContent =
    (!contents || currentContentIndex >= (contents?.length || 0) - 1) && !nextChapterReachable
  const nextDisabled = !isCompleted

  // Lesson tabs (Overview/Notes/Resources) only under reading/watching content;
  // quiz & assignment viewers are self-contained interactive flows.
  const lessonTabContentType = (currentContent?.content_type || '').toLowerCase()
  const showLessonTabs =
    !!currentContent &&
    currentUnlocked &&
    !contentsLoading &&
    !contentsError &&
    ['video', 'video_link', 'text', 'html', 'pdf', 'file', 'image', 'audio', 'link'].includes(lessonTabContentType)

  return (
    <ErrorBoundary>
      <div ref={playerRootRef} className="flex overflow-hidden bg-white" style={{ height: '100vh' }}>

        {/* ─── Left: module sidebar ─────────────────────────────────────── */}
        <CourseSidebar
          courseId={courseId}
          courseName={courseName}
          chapters={chapters || []}
          currentChapterId={chapterId}
          currentContentId={currentContent?.id}
          completedContentItems={completedContentItems}
          totalContentItems={totalContentItems}
          onChapterSelect={id => { setChapterId(id); setContentId(undefined) }}
          onContentSelect={id => setContentId(id)}
        />

        {/* ─── Center: top-bar + scrollable content + bottom nav ────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Top bar — breadcrumb · progress bar · progress ring */}
          <div className="flex-shrink-0 border-b border-gray-200 bg-white px-5 flex items-center gap-4" style={{ minHeight: 52 }}>
            {/* Breadcrumb: Course › Module › Lesson */}
            <nav className="flex items-center gap-1.5 text-sm min-w-0 flex-shrink" aria-label="Breadcrumb">
              <button
                onClick={() => { setChapterId(undefined); setContentId(undefined) }}
                className="flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors font-medium truncate max-w-[150px] flex-shrink-0"
                title="Course overview"
              >
                <ChevronLeft className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{courseName}</span>
              </button>
              {chapterDisplayName && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-300 flex-shrink-0 hidden md:block" />
                  <span className="text-gray-500 truncate max-w-[140px] hidden md:inline">{chapterDisplayName}</span>
                </>
              )}
              {currentContent?.title && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-300 flex-shrink-0 hidden lg:block" />
                  <span className="text-gray-900 font-medium truncate max-w-[180px] hidden lg:inline">{currentContent.title}</span>
                </>
              )}
            </nav>

            {/* Progress bar (center) */}
            <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
              <div className="w-40 sm:w-56 md:w-72 h-1.5 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${overallProgressPercent}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0 hidden sm:inline">
                {completedContentItems}/{totalContentItems} items
              </span>
            </div>

            {/* Progress ring (right) */}
            <CircularProgress value={overallProgressPercent} size={34} stroke={4} className="flex-shrink-0" />
          </div>

          {/* Deadline nudge — homework due today shouldn't be invisible mid-lesson */}
          {!dueBannerDismissed && urgentAssignments.length > 0 && (
            <div className="flex-shrink-0 flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-5 py-2 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-500" />
              <span className="min-w-0 truncate">
                {urgentAssignments.length === 1 ? (
                  <>&ldquo;{urgentAssignments[0].title}&rdquo; is {urgentAssignments[0].is_overdue ? 'overdue' : 'due today'}</>
                ) : (
                  <>{urgentAssignments.length} assignments are due today or overdue</>
                )}
              </span>
              <Link
                href={
                  urgentAssignments.length === 1
                    ? `/lms/student/assignments/${urgentAssignments[0].id}`
                    : '/lms/student/assignments?filter=pending'
                }
                className="ml-auto flex-shrink-0 text-xs font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700"
              >
                {urgentAssignments.length === 1 ? 'Start now' : 'View all'}
              </Link>
              <button
                onClick={dismissDueBanner}
                aria-label="Dismiss reminder"
                className="flex-shrink-0 text-amber-500 hover:text-amber-700 p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Scrollable content area */}
          <div
            className="flex-1 overflow-y-auto bg-white"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {renderContentViewer()}
            {showLessonTabs && currentContent && (
              <LessonTabs
                courseId={courseId}
                chapterId={chapterId}
                chapterName={chapterDisplayName}
                content={currentContent}
                chapterContents={(contents as Content[]) || []}
                courseDescription={(course as Course)?.description}
              />
            )}
          </div>

          {/* Up-next auto-advance card */}
          {upNextCountdown !== null && nextItemLabel && (
            <div className="flex-shrink-0 px-5 pb-2">
              <div className="flex items-center gap-3 bg-gray-900 text-white rounded-xl px-4 py-3 shadow-lg">
                <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Play className="h-4 w-4 fill-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                    Up next in {upNextCountdown}s
                  </p>
                  <p className="text-sm font-medium truncate">{nextItemLabel}</p>
                </div>
                <button
                  onClick={() => setUpNextCountdown(null)}
                  className="text-xs text-gray-300 hover:text-white px-2 py-1.5 rounded-md hover:bg-white/10 transition-colors flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
                <button
                  onClick={() => { setUpNextCountdown(null); handleNext() }}
                  className="text-sm font-semibold bg-white text-gray-900 hover:bg-gray-100 px-3.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
                >
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Bottom navigation bar */}
          <div className="flex-shrink-0 border-t border-gray-200 bg-white px-5 py-3 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevious}
              disabled={currentContentIndex === 0}
              className="text-gray-600 hover:text-gray-900 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Previous</span>
            </Button>

            <div className="flex items-center gap-3 min-w-0">
              {nextDisabled && currentUnlocked && (
                <span className="hidden md:inline text-xs text-gray-400 truncate">
                  Complete this item to continue
                </span>
              )}
              <Button
                onClick={handleNext}
                disabled={nextDisabled}
                className="bg-blue-700 hover:bg-blue-800 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                title={nextDisabled ? 'Complete this item to continue' : undefined}
              >
                {isLastContent ? 'Finish Course' : 'Go to next item'}
                {isLastContent ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
