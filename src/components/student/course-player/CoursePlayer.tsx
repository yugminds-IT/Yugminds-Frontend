'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import CourseSidebar from './CourseSidebar'
import CourseOverview from './CourseOverview'
import VideoContentViewer from './VideoContentViewer'
import { looksLikeVideo } from './media'
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
import { useCourseProgressStore } from '../../../store/course-progress-store'
import { useToast } from '../../ui/toast'
import { makeIsCompleted, computeItemGating, firstIncompleteIndex } from '../../../lib/course-gating'

import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  FileText,
  Play,
  ArrowRight,
  Lock,
  X,
  AlertCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Check,
} from 'lucide-react'
import { getStoredUserId } from '../../../lib/session-utils'
import { studentApi } from '../../../lib/api'
import { confirmLeaveAssignment } from '@/hooks/useAssignmentLeaveGuard'
import Droid from '../../portal/Droid'

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
  const [outlineCollapsed, setOutlineCollapsed] = useState(false)
  const [mobileOutlineOpen, setMobileOutlineOpen] = useState(false)
  // Up-next auto-advance (Udemy-style): countdown after a lesson is completed.
  const [upNextCountdown, setUpNextCountdown] = useState<number | null>(null)
  const upNextShownRef = useRef<Set<string>>(new Set())
  const seenIdRef = useRef<string | undefined>(undefined)
  // Shown when the last item of a module is finished.
  const [cheer, setCheer] = useState<{ name: string } | null>(null)
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
    days_until_due?: number | null
    is_locked?: boolean
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
      if (!pending || a.is_locked) return false
      // days_until_due is null/absent for assignments with no deadline.
      return a.is_overdue || (typeof a.days_until_due === 'number' && a.days_until_due === 0)
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

  const afterLeaveConfirmed = (go: () => void) => {
    void confirmLeaveAssignment().then(ok => { if (ok) go() })
  }

  const handlePrevious = () => afterLeaveConfirmed(() => {
    if (currentContentIndex > 0) {
      const prevIdx = currentContentIndex - 1
      setCurrentContentIndex(prevIdx)
      const prev = (contents as Content[])?.[prevIdx]
      if (prev) setContentId(prev.id)
    }
  })

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
      if (allDone) {
        setUpNextCountdown(null)
        setCheer({ name: currentChapter?.name || currentChapter?.title || '' })
      }
      return true
    } catch (error) {
      const msg = error instanceof Error ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || error.message : 'Unexpected error'
      toast.error(`Failed to save progress: ${msg}`)
      return false
    } finally {
      setSavingProgress(currentContent.id, false)
    }
  }, [currentContent, currentChapter, chapterId, courseId, contents, isDone, setContentCompleted, setChapterCompleted, setSavingProgress, toast, queryClient])

  // Latest-handler refs so the timer/keyboard effects stay stable across renders.
  handleNextRef.current = () => { void handleNext() }
  handlePrevRef.current = handlePrevious

  // ── Up-next auto-advance ───────────────────────────────────────────────────
  // When the current lesson is complete and another item follows, surface a
  // short countdown that auto-advances (cancelable).
  useEffect(() => {
    if (!currentContent) return
    const id = currentContent.id
    // Reviewing an item that was already finished should not whisk the child on to the next one.
    if (id !== seenIdRef.current) {
      seenIdRef.current = id
      if (isCompleted) upNextShownRef.current.add(id)
    }
    if (isCompleted && hasNextItem && !cheer && !upNextShownRef.current.has(id)) {
      upNextShownRef.current.add(id)
      setUpNextCountdown(5)
    }
  }, [isCompleted, currentContent, hasNextItem, cheer])

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
    setCheer(null)
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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10" aria-busy="true">
          <div className="sd-skel" style={{ height: '2.5rem', width: '60%' }} />
          <div className="sd-skel" style={{ height: '16rem', marginTop: '1.25rem' }} />
        </div>
      )
    }
    if (contentsError) {
      return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center text-gray-500">
          <FileText className="h-14 w-14 mx-auto mb-4 text-gray-300" />
          <p className="text-red-600 mb-1">This item did not load</p>
          <p className="text-sm">{contentsError.message}</p>
        </div>
      )
    }
    if (!contents || contents.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <FileText className="h-14 w-14 mb-4 opacity-30" />
          <p className="text-sm">Your teacher has not added items to this module yet.</p>
        </div>
      )
    }
    if (!currentContent) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <Play className="h-14 w-14 mb-4 opacity-20" />
          <p className="text-sm">Pick an item from the outline to start.</p>
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
            Finish the previous item to unlock <span className="font-medium">{currentContent.title}</span>.
          </p>
        </div>
      )
    }

    const declaredType = (currentContent.content_type || '').toLowerCase()
    const contentType =
      (declaredType === 'link' || declaredType === 'file') && looksLikeVideo(currentContent.content_url)
        ? 'video'
        : declaredType
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
      // "Mark as complete" path these types need. Without a case here they
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
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center text-gray-400">
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
      <div className="pl-center">
        <section className="sd-panel" role="alert">
          <div className="sd-empty">
            <AlertCircle aria-hidden="true" size={28} color="var(--sd-late)" />
            <b>{errorCode === 'NO_ACCESS' ? 'You do not have access to this course' : 'This course did not load'}</b>
            <p>{error instanceof Error ? error.message : 'Something went wrong while loading the course.'}</p>
            <div className="sd-hero-actions" style={{ marginTop: '0.5rem' }}>
              <button className="sd-btn sd-btn--line" onClick={() => router.push('/lms/student/my-courses')}>Back to my courses</button>
              {canRetry && <button className="sd-btn sd-btn--ink" onClick={handleRetry}>Try again</button>}
            </div>
          </div>
        </section>
      </div>
    )
  }

  if (courseLoading || chaptersLoading) {
    return (
      <div className="pl-center" aria-busy="true">
        <div style={{ width: 'min(100%, 36rem)' }}>
          <div className="sd-skel" style={{ height: '2.5rem' }} />
          <div className="sd-skel" style={{ height: '12rem' }} />
        </div>
      </div>
    )
  }

  if (!courseId) {
    return (
      <div className="pl-center">
        <p>Course ID is missing.</p>
      </div>
    )
  }

  // No chapter selected: show the course overview landing (unless resuming, in
  // which case the resume effect above is about to pick a chapter).
  if (!chapterId) {
    if (isResuming) {
      return (
        <div className="pl-center" aria-busy="true">
          <div className="sd-skel" style={{ height: '12rem', width: 'min(100%, 36rem)' }} />
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

  // ── Player: outline, lesson, bottom navigation ───────────────────────────

  const isLastContent =
    (!contents || currentContentIndex >= (contents?.length || 0) - 1) && !nextChapterReachable
  const nextDisabled = !isCompleted
  const trailGate = contents && Array.isArray(contents) ? computeItemGating(contents, isDone) : []

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
      <div ref={playerRootRef} className="pl-root sd-player">

        <CourseSidebar
          courseId={courseId}
          courseName={courseName}
          chapters={chapters || []}
          currentChapterId={chapterId}
          currentContentId={currentContent?.id}
          completedContentItems={completedContentItems}
          totalContentItems={totalContentItems}
          onChapterSelect={id => afterLeaveConfirmed(() => { setChapterId(id); setContentId(undefined) })}
          onContentSelect={id => afterLeaveConfirmed(() => setContentId(id))}
          collapsed={outlineCollapsed}
          mobileOpen={mobileOutlineOpen}
          onMobileOpenChange={setMobileOutlineOpen}
        />

        <div className="pl-main">

          <div className="pl-top">
            <button
              onClick={() => setOutlineCollapsed(c => !c)}
              className="pl-ico hidden lg:inline-grid"
              title={outlineCollapsed ? 'Show course outline' : 'Hide course outline'}
              aria-label={outlineCollapsed ? 'Show course outline' : 'Hide course outline'}
            >
              {outlineCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </button>
            <button onClick={() => setMobileOutlineOpen(true)} className="pl-outline-btn" aria-label="Open course outline">
              <PanelLeftOpen />
              Outline
            </button>

            <nav className="pl-crumb" aria-label="Breadcrumb">
              <button
                onClick={() => afterLeaveConfirmed(() => { setChapterId(undefined); setContentId(undefined) })}
                title={`Course overview: ${courseName}`}
              >
                <ChevronLeft aria-hidden="true" />
                <span>{courseName}</span>
              </button>
              {chapterDisplayName && (
                <>
                  <ChevronRight className="hidden md:block" aria-hidden="true" />
                  <span className="hidden md:inline" title={chapterDisplayName}>{chapterDisplayName}</span>
                </>
              )}
              {currentContent?.title && (
                <>
                  <ChevronRight className="hidden lg:block" aria-hidden="true" />
                  <span className="pl-here hidden lg:inline" title={currentContent.title}>{currentContent.title}</span>
                </>
              )}
            </nav>

            <div className="pl-prog">
              <div className="sd-meter" role="progressbar" aria-valuenow={overallProgressPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress">
                <i style={{ '--p': `${overallProgressPercent}%` } as React.CSSProperties} />
              </div>
              <small>{completedContentItems} of {totalContentItems} items</small>
              <span className="pl-pct">{Math.round(overallProgressPercent)}%</span>
            </div>
          </div>

          {/* Deadline nudge: homework due today shouldn't be invisible mid-lesson */}
          {!dueBannerDismissed && urgentAssignments.length > 0 && (
            <div className="pl-due [@media(max-height:500px)]:hidden" role="status">
              <AlertCircle aria-hidden="true" />
              <span>
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
              >
                {urgentAssignments.length === 1 ? 'Start now' : 'View all'}
              </Link>
              <button onClick={dismissDueBanner} aria-label="Dismiss reminder"><X size={16} /></button>
            </div>
          )}

          <div className="pl-body" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
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
          {upNextCountdown !== null && nextItemLabel && !cheer && (
            <div className="pl-up" role="status">
              <div>
                <span className="pl-up-ico"><Play aria-hidden="true" /></span>
                <span className="pl-up-text">
                  <small>Up next in {upNextCountdown}s</small>
                  <b>{nextItemLabel}</b>
                </span>
                <button className="sd-btn sd-btn--ghost-dark" onClick={() => setUpNextCountdown(null)}>Cancel</button>
                <button className="sd-btn sd-btn--amber" onClick={() => { setUpNextCountdown(null); handleNext() }}>
                  Next <ArrowRight aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          <div className="pl-bottom [@media(max-height:500px)]:py-1.5">
            <button className="sd-btn sd-btn--line" onClick={handlePrevious} disabled={currentContentIndex === 0}>
              <ChevronLeft aria-hidden="true" />
              <span className="hidden sm:inline">Back</span>
            </button>

            <div className="pl-mid">
              <ol className="pl-trail" aria-label="Items in this module">
                {((contents as Content[]) || []).map((c, i) => {
                  const g = trailGate[i]
                  const here = c.id === currentContent?.id
                  return (
                    <li key={c.id}>
                      <button
                        className="pl-step"
                        data-done={!!g?.completed}
                        data-current={here}
                        disabled={g ? !g.unlocked : false}
                        aria-current={here ? 'step' : undefined}
                        aria-label={`Item ${i + 1}: ${c.title}`}
                        title={c.title}
                        onClick={() => { if (!here) afterLeaveConfirmed(() => setContentId(c.id)) }}
                      >
                        {g?.completed ? <Check aria-hidden="true" /> : i + 1}
                      </button>
                    </li>
                  )
                })}
              </ol>
              {contents && contents.length > 0 && <span className="pl-trail-of">{currentContentIndex + 1} of {contents.length}</span>}
            </div>

            <button
              className="sd-btn sd-btn--amber"
              data-ready={!nextDisabled}
              onClick={handleNext}
              disabled={nextDisabled}
              title={nextDisabled ? 'Finish this item to continue' : undefined}
            >
              {isLastContent ? 'Finish course' : 'Next'}
              {isLastContent ? <CheckCircle aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
            </button>
          </div>

          {cheer && (
            <div className="pl-cheer" role="dialog" aria-modal="true" aria-label="Module complete">
              <div className="pl-cheer-card">
                <span className="ls-droid"><Droid /></span>
                <span className="ls-burst" aria-hidden="true">
                  {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--a': `${i * 30}deg` } as React.CSSProperties} />)}
                </span>
                <h2>Module done!</h2>
                <p>{cheer.name ? `You finished ${cheer.name}.` : 'You finished every item in this module.'}</p>
                <div className="sd-hero-actions">
                  <button className="sd-btn sd-btn--ghost-dark" onClick={() => setCheer(null)}>Stay here</button>
                  <button className="sd-btn sd-btn--amber" autoFocus onClick={() => { setCheer(null); handleNext() }}>
                    {isLastContent ? 'Finish course' : 'Keep going'}
                    <ArrowRight aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}
