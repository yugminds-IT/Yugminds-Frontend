'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import CourseHeader from './CourseHeader'
import CourseSidebar from './CourseSidebar'
import VideoContentViewer from './VideoContentViewer'
import TextContentViewer from './TextContentViewer'
import PDFContentViewer from './PDFContentViewer'
import QuizContentViewer from './QuizContentViewer'
import ErrorBoundary from './ErrorBoundary'
import { useQueryClient } from '@tanstack/react-query'
import { useCourseWithRealtime, useCourseChapters, useChapterContents } from '../../../hooks/useStudentData'
import { Badge } from '../../ui/badge'
import { Progress } from '../../ui/progress'
import { Card } from '../../ui/card'
import { Button } from '../../ui/button'
import { useCourseProgressStore } from '../../../store/course-progress-store'
import { useToast } from '../../ui/toast'

import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle,
  FileText,
  Loader2,
  BookOpen,
  Play
} from 'lucide-react'
import { getStoredUserId, getSession } from '../../../lib/session-utils'
import { setAuthToken, studentApi } from '../../../lib/api'

interface CoursePlayerProps {
  courseId: string
}

interface Content {
  id: string;
  title: string;
  name?: string;
  content_type?: string;
  content_url?: string;
  content_text?: string;
  chapter_id?: string;
  course_id?: string;
  source?: string;
  max_score?: number;
  auto_grading_enabled?: boolean;
  is_completed?: boolean;
  [key: string]: unknown;
}

interface Chapter {
  id: string;
  name?: string;
  title?: string;
  order_number?: number;
  order_index?: number;
  is_completed?: boolean;
  is_unlocked?: boolean;
  content_count?: number;
  completed_count?: number;
  [key: string]: unknown;
}

interface ErrorWithCode extends Error {
  code?: string;
}

interface Course {
  id: string;
  name?: string;
  title?: string;
  course_name?: string;
  description?: string;
  is_published?: boolean;
  status?: string;
  progress_percentage?: number;
  [key: string]: unknown;
}

export default function CoursePlayer({ courseId: propCourseId }: CoursePlayerProps) {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const isResuming = searchParams?.get('resume') === '1'
  const [chapterId, setChapterId] = useState<string | undefined>(() => searchParams?.get('chapter') || undefined)
  const [contentId, setContentId] = useState<string | undefined>(() => searchParams?.get('content') || undefined)
  const courseId = propCourseId || (params?.courseId as string | undefined)
  
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  // Use empty string as fallback to ensure hooks are always called with valid parameters
  const { data: course, isLoading: courseLoading, error: courseError } = useCourseWithRealtime(courseId || '')
  const { data: chaptersRaw, isLoading: chaptersLoading, error: chaptersError } = useCourseChapters(courseId || '')
  const chapters = chaptersRaw as Chapter[] | undefined
  const { data: contentsRaw, isLoading: contentsLoading, error: contentsError } = useChapterContents(chapterId || '', courseId || undefined)
  const contents = contentsRaw as Content[] | undefined
  const [currentContentIndex, setCurrentContentIndex] = useState(0)
  const [retryCount, setRetryCount] = useState(0)

  // Global progress store for optimistic UI
  const {
    isContentCompleted,
    setContentCompleted,
    setChapterCompleted,
    isChapterCompleted,
    contentProgress: _contentProgress,
    chapterProgress,
    setLastViewed,
    getLastViewed,
  } = useCourseProgressStore()
  
  const toast = useToast()
  const queryClient = useQueryClient()

  // Find current chapter
  const currentChapter = chapters?.find((c: Chapter) => c.id === chapterId)
  
  // Get current content - prioritize contentId if available, otherwise use index
  let currentContent: Content | null = null
  if (contents && Array.isArray(contents) && contents.length > 0) {
    if (contentId) {
      // Find content by ID (most reliable when contentId is in URL)
      currentContent = (contents as Content[]).find((c: Content) => c.id === contentId) || null
      // If found by ID, update index to match
      if (currentContent) {
        const foundIndex = (contents as Content[]).findIndex((c: Content) => c.id === contentId)
        if (foundIndex >= 0 && foundIndex !== currentContentIndex) {
          setCurrentContentIndex(foundIndex)
        }
      }
    }
    // Fallback to index-based selection if contentId not found or not provided
    if (!currentContent) {
      currentContent = (contents as Content[])[currentContentIndex] || null
    }
  } else if (contents && !Array.isArray(contents)) {
    // Handle non-array contents (shouldn't happen, but handle gracefully)
    currentContent = (contents as Content[])?.[currentContentIndex] || null
  }
  
  // Check completion from global store (must be after currentContent is defined)
  const isCompleted = currentContent ? isContentCompleted(currentContent.id) : false

  // Calculate progress - use server-side progress data from API
  // The chapters API already includes progress from course_progress table in is_completed field
  const totalContentItems = (chapters || []).reduce((acc, ch) => acc + (ch.content_count || 0), 0)
  const completedContentItems = (chapters || []).reduce((acc, ch) => {
    // Reactive check: if chapter is marked as complete in local store OR backend
    const isDone = ch.is_completed || chapterProgress[ch.id]?.isCompleted
    return acc + (isDone ? (ch.content_count || 0) : (ch.completed_count || 0))
  }, 0)
  
  // Overall percentage based on content items
  const overallProgressPercent = totalContentItems > 0 
    ? Math.round((completedContentItems / totalContentItems) * 100) 
    : 0

  const completedChapters = (chapters || []).filter((c: Chapter) => {
    return c.is_completed === true || isChapterCompleted(c.id)
  }).length || 0
  const totalChapters = chapters?.length || 0
  
  // Sort chapters by order to find next chapter correctly
  const sortedChapters = chapters && chapters.length > 0
    ? [...chapters].sort((a: Chapter, b: Chapter) => {
        const orderA = a.order_number || a.order_index || 0
        const orderB = b.order_number || b.order_index || 0
        return orderA - orderB
      })
    : [] as Chapter[]
  
  // Find next chapter: first chapter after current one in order
  // Always find the next chapter by order, regardless of completion status
  // This ensures students can always navigate forward
  let nextChapter: Chapter | null = null
  if (chapterId && sortedChapters.length > 0) {
    const currentChapterIndex = sortedChapters.findIndex((c: Chapter) => c.id === chapterId)
    if (currentChapterIndex >= 0 && currentChapterIndex < sortedChapters.length - 1) {
      // Get the next chapter in order (regardless of completion or unlock status)
      // Students should be able to navigate to next chapter even if current isn't complete
      nextChapter = sortedChapters[currentChapterIndex + 1]
    }
  } else if (sortedChapters.length > 0) {
    // If no current chapter, use first chapter
    nextChapter = sortedChapters[0]
  }

  const firstChapter = sortedChapters && sortedChapters.length > 0 ? sortedChapters[0] : null

  // For "Continue Learning" on the course overview: first chapter that isn't complete yet
  const firstIncompleteChapter = sortedChapters.find(
    (c: Chapter) => !c.is_completed && !isChapterCompleted(c.id)
  ) || firstChapter


  // Track last-viewed position so students can resume exactly where they left off
  useEffect(() => {
    if (!courseId || !chapterId) return
    setLastViewed(courseId, {
      chapterId,
      contentId: contentId || undefined,
      chapterTitle: currentChapter?.name || currentChapter?.title,
      contentTitle: currentContent?.title || undefined,
    })
    // Fire-and-forget to backend — silently ignored if endpoint not yet deployed
    studentApi.progress.saveLastViewed({ courseId, chapterId, contentId: contentId || undefined }).catch(() => {})
  }, [courseId, chapterId, contentId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update content index when contentId changes (keep in sync) — deferred to avoid cascading renders
  useEffect(() => {
    let rafId: number | undefined
    if (contents && Array.isArray(contents) && contentId) {
      const index = (contents as Content[]).findIndex((c: Content) => c.id === contentId)
      if (index >= 0 && index !== currentContentIndex) {
        rafId = requestAnimationFrame(() => {
          setCurrentContentIndex(index)
        })
      } else if (index < 0) {
      }
    } else if (contents && Array.isArray(contents) && !contentId && contents.length > 0) {
      if (currentContentIndex >= contents.length) {
        rafId = requestAnimationFrame(() => {
          setCurrentContentIndex(0)
        })
      }
    }
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [contentId, contents, currentContentIndex, chapterId, chapters])

  // Auto-navigate to first content when chapter is opened (if no contentId in URL)
  useEffect(() => {
    if (!courseId || !chapterId) return
    
    // Wait for contents to finish loading
    if (contentsLoading) return
    
    // If we have contents but no contentId, navigate to first content
    if (!contentId && contents && contents.length > 0) {
      const firstContent = (contents as Content[])[0]
      if (firstContent && firstContent.id) {
        // Only navigate if not already viewing a content item
        if (!contentId) {
          setContentId(firstContent.id)
        }
      }
    }
  }, [chapterId, contentId, contents, contentsLoading, courseId, router])

  // Server→local sync is handled by checkChapterCompletion below (reads is_completed from chapter contents API)

  // Check and update chapter completion when contents change
  useEffect(() => {
    if (!contents || !Array.isArray(contents) || !chapterId || !courseId) return

    const checkChapterCompletion = async () => {
      const contentsArray = contents as Content[];
      // Check both local store completion AND server-side completion (is_completed field)
      const allContentCompletedLocal = contentsArray.every((content: Content) => 
        isContentCompleted(content.id)
      )
      
      const allContentCompletedServer = contentsArray.every((content: Content) => 
        content.is_completed === true
      )
      
      const currentlyMarkedComplete = isChapterCompleted(chapterId)
      
      // If server shows all content complete but local store doesn't, sync local store
      if (allContentCompletedServer && !allContentCompletedLocal) {
        contentsArray.forEach((content: Content) => {
          if (content.is_completed === true && !isContentCompleted(content.id)) {
            setContentCompleted(content.id, chapterId, courseId, true)
          }
        })
      }

      // Mark chapter complete if all content is complete (either local or server)
      const allContentCompleted = allContentCompletedLocal || allContentCompletedServer

      if (allContentCompleted) {
        if (!currentlyMarkedComplete) {
          setChapterCompleted(chapterId, courseId, true, 100)
        }

        // Save chapter-level record whenever local says done but server is missing
        // content completions. This self-heals existing data where a content save
        // failed silently — the chapter-level record covers all contents via hybrid logic.
        if (!allContentCompletedServer) {
          try {
            const userId = getStoredUserId()
            if (userId) {
              const { data: sessionData } = await getSession()
              if (sessionData.session?.access_token) setAuthToken(sessionData.session.access_token)

              await studentApi.progress.simpleSave({
                studentId: userId,
                courseId,
                chapterId,
                isCompleted: true,
              })
              queryClient.invalidateQueries({ queryKey: ["studentCourses"] })
            }
          } catch {}
        }
      } else if (!allContentCompleted && currentlyMarkedComplete) {
        setChapterCompleted(chapterId, courseId, false, 0)
      }
    }

    checkChapterCompletion()
  }, [contents, chapterId, courseId, isContentCompleted, isChapterCompleted, setChapterCompleted, setContentCompleted, queryClient])

  // Auto-redirect to appropriate chapter when no chapter is selected
  useEffect(() => {
    if (!courseId || chapterId || chaptersLoading || !chapters || chapters.length === 0) return

    const sorted = [...chapters].sort((a: Chapter, b: Chapter) =>
      (a.order_number || a.order_index || 0) - (b.order_number || b.order_index || 0)
    )

    if (isResuming) {
      // ?resume=1: go to first incomplete chapter so the student continues where they left off
      const firstIncomplete = sorted.find(
        (c: Chapter) => !c.is_completed && !isChapterCompleted(c.id)
      ) || sorted[0]
      setChapterId(firstIncomplete.id); setContentId(undefined)
    } else {
      // Normal entry to course overview: only auto-redirect new students (no progress yet)
      const completedCount = chapters.filter((c: Chapter) => c.is_completed).length
      if (completedCount === 0) {
        setChapterId(sorted[0].id); setContentId(undefined)
      }
    }
  }, [chapterId, chaptersLoading, chapters, courseId, isResuming, isChapterCompleted, router])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleNext = async () => {
    if (contents && Array.isArray(contents) && currentContentIndex < contents.length - 1) {
      const nextIndex = currentContentIndex + 1
      const nextContent = contents[nextIndex]
      if (nextContent && nextContent.id) {
        setCurrentContentIndex(nextIndex)
        setContentId(nextContent.id)
      }
    } else if (nextChapter && nextChapter.id) {
      setChapterId(nextChapter.id); setContentId(undefined)
    } else if (chapterId && sortedChapters.length > 0) {
      const currentChapterIndex = sortedChapters.findIndex((c: Chapter) => c.id === chapterId)
      if (currentChapterIndex >= 0 && currentChapterIndex < sortedChapters.length - 1) {
        const fallbackNextChapter = sortedChapters[currentChapterIndex + 1]
        if (fallbackNextChapter && fallbackNextChapter.id) {
          setChapterId(fallbackNextChapter.id); setContentId(undefined)
          return
        }
      }
      if (!isCompleted) {
        await handleMarkComplete()
      }
      toast.success('Course completed! 🎉')
      setChapterId(undefined); setContentId(undefined)
    } else {
      if (!isCompleted) {
        await handleMarkComplete()
      }
      toast.success('Course completed! 🎉')
      setChapterId(undefined); setContentId(undefined)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handlePrevious = () => {
    if (currentContentIndex > 0) {
      const prevIndex = currentContentIndex - 1
      setCurrentContentIndex(prevIndex)
      const prevContent = (contents as Content[])?.[prevIndex]
      if (prevContent) {
        setContentId(prevContent.id)
      }
    }
  }

  // Touch swipe navigation — tracks horizontal swipe on content area
  const swipeTouchStartX = useRef<number | null>(null)
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    swipeTouchStartX.current = e.touches[0].clientX
  }, [])
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (swipeTouchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - swipeTouchStartX.current
    swipeTouchStartX.current = null
    if (Math.abs(dx) < 60) return // ignore small movements
    if (dx < 0) handleNext()       // swipe left → next
    else handlePrevious()           // swipe right → previous
  }, [handleNext, handlePrevious])

  const handleMarkComplete = useCallback(async () => {
    if (!currentContent || !chapterId || !courseId) return false

    const userId = getStoredUserId()
    if (!userId) {
      toast.error('Please log in to save progress')
      return false
    }

    // Optimistic update
    setContentCompleted(currentContent.id, chapterId, courseId, true)

    let allContentCompleted = false
    if (contents && Array.isArray(contents)) {
      const contentsArray = contents as Content[]
      allContentCompleted = contentsArray.every(
        (content: Content) => content.id === currentContent.id || isContentCompleted(content.id)
      )
      if (allContentCompleted) {
        setChapterCompleted(chapterId, courseId, true, 100)
      }
    }

    try {
      // Save content-level progress record
      try {
        await studentApi.progress.simpleSave({
          studentId: userId,
          courseId,
          chapterId,
          contentId: currentContent.id,
          isCompleted: true,
        })
      } catch (contentError) {
        console.error('Progress save failed:', contentError)
      }

      // When all content in the chapter is done, also write a chapter-level record
      // (no contentId). The hybrid backend algorithm counts every content item under
      // a chapter-level-completed chapter, so this guarantees 100% even if an
      // individual content save failed silently.
      if (allContentCompleted) {
        try {
          await studentApi.progress.simpleSave({
            studentId: userId,
            courseId,
            chapterId,
            isCompleted: true,
          })
        } catch {}
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["courseChapters", courseId] }),
        queryClient.invalidateQueries({ queryKey: ["studentDashboardStats"] }),
        queryClient.invalidateQueries({ queryKey: ["studentCourses"] }),
        queryClient.invalidateQueries({ queryKey: ["chapterContents", chapterId] })
      ])

      if (allContentCompleted) {
        toast.success('Chapter completed! 🎉', 3000)
      } else {
        toast.success('Progress saved!', 2000)
      }

      return true

    } catch (error) {
      const errorMessage = error instanceof Error
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? ((error as any).response?.data?.message || error.message)
        : 'Unexpected error'
      console.error('Progress save error:', error)
      toast.error(`Failed to save progress: ${errorMessage}`)
    }
  }, [currentContent, chapterId, courseId, contents, isContentCompleted, setContentCompleted, setChapterCompleted, toast, queryClient])

  const renderContentViewer = (): React.ReactNode => {
    // Show loading state while contents are loading
    if (contentsLoading) {
      return (
        <div className="text-center py-12 text-gray-500">
          <Loader2 className="h-16 w-16 mx-auto mb-4 text-gray-300 animate-spin" />
          <p>Loading content...</p>
        </div>
      )
    }

    // Show error state if there's an error
    if (contentsError) {
      return (
        <div className="text-center py-12 text-gray-500">
          <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p className="text-red-600 mb-2">Error loading content</p>
          <p className="text-sm text-gray-400">{contentsError.message}</p>
          {contentId && (
            <Button
              onClick={() => setContentId(undefined)}
              className="mt-4"
            >
              Back to Chapter
            </Button>
          )}
        </div>
      )
    }

    // Show message if no contents available
    if (!contents || contents.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p>No content available for this chapter</p>
          {chapterId && (
            <Button
              onClick={() => setContentId(undefined)}
              className="mt-4"
              variant="outline"
            >
              Back to Chapter
            </Button>
          )}
        </div>
      )
    }

    // Show message if contentId is specified but content not found
    if (contentId && !currentContent) {
      return (
        <div className="text-center py-12 text-gray-500">
          <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p className="mb-2">Content not found</p>
          <p className="text-sm text-gray-400 mb-4">
            The requested content (ID: {contentId}) could not be found in this chapter.
          </p>
          {contents.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm">Available content:</p>
              {(contents as Content[]).map((c: Content, idx: number) => (
                <Button
                  key={c.id || idx}
                  onClick={() => setContentId(c.id)}
                  variant="outline"
                  className="mr-2"
                >
                  {c.title || c.name || `Content ${idx + 1}`}
                </Button>
              ))}
            </div>
          )}
        </div>
      )
    }

    // Show message if no current content (shouldn't happen, but handle gracefully)
    if (!currentContent) {
      return (
        <div className="text-center py-12 text-gray-500">
          <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p>No content available</p>
          <p className="text-sm text-gray-400 mt-2">
            {contentId ? `Content ID: ${contentId}` : 'Please select a content item from the sidebar'}
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
            content={currentContent as { id: string; title: string; content_text?: string; content_url?: string; chapter_id?: string; course_id?: string }}
            courseId={courseId}
            chapterId={chapterId}
            onComplete={handleMarkComplete}
          />
        )
      case 'pdf':
      case 'file':
        return (
          <PDFContentViewer
            content={currentContent as { id: string; title: string; content_url?: string; chapter_id?: string; course_id?: string }}
            courseId={courseId}
            chapterId={chapterId}
            onComplete={handleMarkComplete}
          />
        )
      case 'quiz':
      case 'assignment':
        return (
          <QuizContentViewer
            content={currentContent as { id: string; title: string; content_url?: string; source?: string; content_text?: string; max_score?: number; auto_grading_enabled?: boolean }}
            courseId={courseId || ''}
            chapterId={chapterId || ''}
            onComplete={handleMarkComplete}
          />
        )
      default:
        return (
          <div className="text-center py-12 text-gray-500">
            <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p>Unsupported content type: {contentType}</p>
          </div>
        )
    }
  }

  // Enhanced error logging
  useEffect(() => {
    if (courseError || chaptersError || contentsError) {
      const error = courseError || chaptersError || contentsError
      const _errorCode = (error as ErrorWithCode)?.code
      
      // Better error serialization for logging
      const errorDetails = error instanceof Error 
        ? { message: error.message, stack: error.stack, name: error.name }
        : typeof error === 'object' 
          ? JSON.stringify(error, null, 2)
          : String(error)

      console.error('[CoursePlayer] Error:', errorDetails)
    }
  }, [courseError, chaptersError, contentsError, courseId, chapterId, contentId, retryCount])

  // Retry handler
  const handleRetry = () => {
    if (retryCount < 3) {
      setRetryCount(prev => prev + 1)
      window.location.reload()
    }
  }

  // Handle errors with specific messages based on error codes
  if (courseError || chaptersError || contentsError) {
    const error = courseError || chaptersError || contentsError
    interface SupabaseError {
      code?: string;
      message?: string;
    }
    
    const errorCode = (error as SupabaseError)?.code
    
    // Determine error message based on error code
    let errorTitle = 'Error Loading Course'
    let errorMessage = error instanceof Error ? error.message : 'Unknown error'
    let actionMessage = ''
    let canRetry = retryCount < 3 && errorCode !== 'NO_ACCESS' && errorCode !== 'ACCESS_DENIED'

    if (errorCode === 'NO_ACCESS') {
      errorTitle = 'Access Denied'
      errorMessage = 'You do not have access to this course content.'
      actionMessage = 'Please contact your administrator to enroll you in this course.'
      canRetry = false
    } else if (errorCode === 'ENROLLMENT_PENDING') {
      errorTitle = 'Enrollment Processing'
      errorMessage = 'Your enrollment is being processed.'
      actionMessage = 'Please refresh the page in a moment. If the issue persists, contact your administrator.'
      canRetry = true
    } else if (errorCode === 'ACCESS_DENIED') {
      errorTitle = 'Permission Denied'
      errorMessage = 'You do not have permission to access this content.'
      actionMessage = 'Please contact your administrator if you believe this is an error.'
      canRetry = false
    } else if (chaptersError) {
      errorTitle = 'Chapters Not Available'
      errorMessage = 'Failed to load course chapters.'
      actionMessage = 'The course may not have published chapters yet, or there may be an access issue. Please contact your administrator.'
      canRetry = true
    } else if (contentsError) {
      errorTitle = 'Content Not Available'
      errorMessage = 'Failed to load course content.'
      actionMessage = 'Please try refreshing the page. If the issue persists, contact your administrator.'
      canRetry = true
    }

    return (
      <div className="container mx-auto px-4 py-6">
        <Card className="p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-2">{errorTitle}</h2>
            <p className="text-gray-700 mb-2">{errorMessage}</p>
            {actionMessage && (
              <p className="text-sm text-gray-500 mb-4">{actionMessage}</p>
            )}
            <div className="flex gap-2 justify-center flex-wrap">
              <Button onClick={() => router.push('/lms/student/my-courses')} variant="outline">
                Back to Courses
              </Button>
              {canRetry && (
                <Button onClick={handleRetry} variant="default">
                  {retryCount > 0 ? `Retry (${retryCount}/3)` : 'Retry'}
                </Button>
              )}
              <Button onClick={() => window.location.reload()} variant="default">
                Refresh Page
              </Button>
            </div>
            {retryCount > 0 && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                Retry attempt {retryCount} of 3
              </p>
            )}
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

  // Guard against missing courseId - after all hooks are called
  if (!courseId) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center py-12">
          <p className="text-gray-500">Course ID is missing</p>
          <Button onClick={() => router.push('/lms/student/my-courses')} className="mt-4">
            Back to Courses
          </Button>
        </div>
      </div>
    )
  }

  // If course is null but chapters exist, we can still show the course
  // This handles cases where RLS blocks course query but allows chapters
  if (!course) {
    // If we have chapters, we can infer the course exists and has access
    // Create a minimal course object from the first chapter
    if (chapters && chapters.length > 0) {
      const fallbackCourse: Course = {
        id: courseId || '',
        name: 'Course',
        title: 'Course',
        course_name: 'Course',
        description: 'Course content is available',
        is_published: true,
        status: 'Published',
      }
      
      // Use fallback course but log the issue
      
      // If we have chapterId or contentId, render the content viewer (same as normal flow)
      if (chapterId) {
        // Render the main player layout with content viewer
        return (
          <ErrorBoundary>
            <div className="min-h-screen bg-gray-50 flex flex-col">
              {/* Course Header */}
              <CourseHeader
                course={fallbackCourse}
                totalChapters={totalChapters}
                completedChapters={completedChapters}
              />

              <div className="flex-1 max-w-[1600px] w-full mx-auto p-0 sm:p-4 md:p-6 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 md:gap-6 h-full">

                  {/* Left Sidebar - Navigation */}
                  <div className="lg:col-span-3 xl:col-span-3 h-full order-2 lg:order-1 px-2 sm:px-0">
                     <div className="lg:sticky lg:top-8 space-y-4">
                       <CourseSidebar
                          courseId={courseId}
                          chapters={chapters || []}
                          currentChapterId={chapterId}
                          currentContentId={currentContent?.id}
                          onChapterSelect={(id) => { setChapterId(id); setContentId(undefined) }}
                          onContentSelect={(id) => setContentId(id)}
                        />

                        {/* Progress Summary Card */}
                        <Card className="p-4 bg-white shadow-sm border-blue-100">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Course Progress</h4>
                          <div className="space-y-2">
                             <div className="flex justify-between text-xs text-gray-500">
                               <span>{completedChapters} of {totalChapters} chapters completed</span>
                               <span>{overallProgressPercent}%</span>
                             </div>
                             <Progress value={overallProgressPercent} className="h-2" />
                          </div>
                        </Card>
                     </div>
                  </div>

                  {/* Main Content Area */}
                  <div className="lg:col-span-9 xl:col-span-9 space-y-4 md:space-y-6 order-1 lg:order-2">

                    {/* Content Viewer Card */}
                    <div className="bg-white rounded-none sm:rounded-xl shadow-sm border-y sm:border border-gray-200 overflow-hidden min-h-[60vh] md:min-h-[500px] flex flex-col">
                      {/* Content Header */}
                      {currentContent && (
                        <div className="border-b px-4 py-3 md:px-6 md:py-4 bg-gray-50 flex justify-between items-center">
                          <div className="min-w-0 flex-1">
                            <h2 className="text-base md:text-xl font-bold text-gray-900 line-clamp-1">{currentContent.title}</h2>
                            <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                              {currentChapter?.name || currentChapter?.title || 'Chapter'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-2 shrink-0">
                            {isCompleted && (
                              <Badge className="bg-green-500 text-white text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">Completed</span>
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Content Viewer */}
                      <div className="flex-1 p-3 sm:p-6 overflow-y-auto" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
                        {renderContentViewer()}
                      </div>

                      {/* Navigation Footer */}
                      <div className="border-t px-4 py-3 md:px-6 md:py-4 bg-gray-50 flex justify-between items-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePrevious}
                          disabled={currentContentIndex === 0 && !(chapters || []).find((c: Chapter, idx: number) => idx > 0 && c.id === chapterId)}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1 md:mr-2" />
                          <span className="hidden sm:inline">Previous</span>
                        </Button>

                        <div className="text-xs md:text-sm text-gray-500">
                          {currentContentIndex + 1} of {contents?.length || 0}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleNext}
                        >
                          <span className="hidden sm:inline">{currentContentIndex >= (contents?.length || 0) - 1 && !nextChapter ? 'Finish Course' : 'Next'}</span>
                          {currentContentIndex >= (contents?.length || 0) - 1 && !nextChapter ? <CheckCircle className="h-4 w-4 sm:ml-2" /> : <ChevronRight className="h-4 w-4 sm:ml-2" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ErrorBoundary>
        )
      }
      
      // If no chapterId, show overview
      return (
        <div className="container mx-auto px-4 py-6">
          <CourseHeader
            course={fallbackCourse}
            totalChapters={totalChapters}
            completedChapters={completedChapters}
            overallProgress={overallProgressPercent}
            nextChapterId={firstIncompleteChapter?.id}
          />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <CourseSidebar
                courseId={courseId}
                chapters={chapters || []}
                onChapterSelect={(id) => { setChapterId(id); setContentId(undefined) }}
                onContentSelect={(id) => setContentId(id)}
              />
            </div>
            <div className="lg:col-span-3">
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4">Course Content</h2>
                <p className="text-gray-600 mb-6">Select a chapter from the sidebar to begin learning.</p>
                {totalChapters === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500 mb-2">No chapters available for this course yet.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                      <div className="p-4 border rounded-lg">
                        <h3 className="font-semibold mb-2">Total Chapters</h3>
                        <p className="text-2xl font-bold">{totalChapters}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h3 className="font-semibold mb-2">Completed</h3>
                        <p className="text-2xl font-bold text-green-600">{completedChapters}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h3 className="font-semibold mb-2">Progress</h3>
                        <p className="text-2xl font-bold">
                          {totalChapters > 0 ? ((completedChapters / totalChapters) * 100).toFixed(0) : 0}%
                        </p>
                      </div>
                    </div>
                    {firstIncompleteChapter && (
                      <div className="mt-6 text-center">
                        <Button
                          size="lg"
                          className="w-full md:w-auto"
                          onClick={() => { setChapterId(firstIncompleteChapter.id); setContentId(undefined) }}
                        >
                          <Play className="h-5 w-5 mr-2" />
                          {completedChapters > 0 ? 'Continue Learning' : 'Start Course'}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </Card>
            </div>
          </div>
        </div>
      )
    }
    
    // If no chapters either, show error
    return (
      <div className="container mx-auto px-4 py-6">
        <Card className="p-6">
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">Course not found</p>
            <p className="text-sm text-gray-400 mb-4">
              {courseError ? `Error: ${(courseError as Error | { message?: string })?.message ?? String(courseError)}` : 'The course may not exist or you may not have access to it.'}
            </p>
            <Button onClick={() => router.push('/lms/student/my-courses')} variant="outline">
              Back to Courses
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (!chapterId) {
    const lastViewedEntry = courseId ? getLastViewed(courseId) : null

    // Show course overview
    return (
      <div className="container mx-auto px-4 py-6">
        <CourseHeader
          course={course as Course}
          totalChapters={totalChapters}
          completedChapters={completedChapters}
          nextChapterId={firstIncompleteChapter?.id}
        />

        {/* Resume card — shown when student has a saved position */}
        {lastViewedEntry && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-blue-100 rounded-lg p-2 shrink-0">
                <Play className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-blue-900">Continue where you left off</p>
                <p className="text-xs text-blue-600 mt-0.5 truncate">
                  {lastViewedEntry.chapterTitle || 'Chapter'}
                  {lastViewedEntry.contentTitle ? ` · ${lastViewedEntry.contentTitle}` : ''}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
              onClick={() => {
                setChapterId(lastViewedEntry.chapterId)
                if (lastViewedEntry.contentId) setContentId(lastViewedEntry.contentId)
              }}
            >
              Resume
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <CourseSidebar
              courseId={courseId}
              chapters={chapters || []}
              onChapterSelect={(id) => { setChapterId(id); setContentId(undefined) }}
              onContentSelect={(id) => setContentId(id)}
            />
          </div>
          <div className="lg:col-span-3">
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">Course Overview</h2>
              <p className="text-gray-600 mb-6">{(course as Course).description || 'No description available.'}</p>
              
              {totalChapters === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500 mb-2">No chapters available for this course yet.</p>
                  <p className="text-xs text-gray-400">
                    {chaptersLoading 
                      ? 'Loading chapters...' 
                      : 'Chapters may need to be published or created by your instructor.'}
                  </p>
                  {!chaptersLoading && chaptersError && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm font-semibold text-red-800 mb-2">Error Loading Chapters:</p>
                      <p className="text-xs text-red-600 mb-1">
                        {chaptersError && typeof chaptersError === 'object' && 'message' in chaptersError ? (chaptersError as Error).message : 'Failed to load chapters'}
                      </p>
                      {(chaptersError as ErrorWithCode)?.code && (
                        <p className="text-xs text-red-500">Error Code: {(chaptersError as ErrorWithCode).code}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        Check browser console for detailed error information.
                      </p>
                    </div>
                  )}
                  {!chaptersLoading && !chaptersError && (
                    <p className="text-xs text-gray-500 mt-2">
                      Check browser console for debugging information.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold mb-2">Total Chapters</h3>
                      <p className="text-2xl font-bold">{totalChapters}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold mb-2">Completed</h3>
                      <p className="text-2xl font-bold text-green-600">{completedChapters}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold mb-2">Progress</h3>
                      <p className="text-2xl font-bold">
                        {totalChapters > 0 ? ((completedChapters / totalChapters) * 100).toFixed(0) : 0}%
                      </p>
                    </div>
                  </div>
                  
                  {firstIncompleteChapter && (
                    <div className="mt-6 text-center">
                      <Button
                        size="lg"
                        className="w-full md:w-auto"
                        onClick={() => { setChapterId(firstIncompleteChapter.id); setContentId(undefined) }}
                      >
                        <Play className="h-5 w-5 mr-2" />
                        {completedChapters > 0 ? 'Continue Learning' : 'Start Course'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // Render main player layout
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 flex flex-col">

        
        {/* Course Header - Simplified for player view */}
        <CourseHeader
          course={course as Course}
          totalChapters={totalChapters}
          completedChapters={completedChapters}
          overallProgress={overallProgressPercent}
        />

        <div className="flex-1 max-w-[1600px] w-full mx-auto p-0 sm:p-4 md:p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 md:gap-6 h-full">

            {/* Left Sidebar - Navigation */}
            <div className="lg:col-span-3 xl:col-span-3 h-full order-2 lg:order-1 px-2 sm:px-0">
               <div className="lg:sticky lg:top-8 space-y-4">
                 <CourseSidebar
                    courseId={courseId}
                    chapters={chapters || []}
                    currentChapterId={chapterId}
                    currentContentId={currentContent?.id}
                    onChapterSelect={(id) => { setChapterId(id); setContentId(undefined) }}
                    onContentSelect={(id) => setContentId(id)}
                  />

                  {/* Progress Summary Card */}
                  <Card className="p-4 bg-white shadow-sm border-blue-100">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Course Progress</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{completedChapters} of {totalChapters} chapters completed</span>
                        <span>{overallProgressPercent}%</span>
                      </div>
                      <Progress value={overallProgressPercent} className="h-2" />
                    </div>
                  </Card>
               </div>
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-9 xl:col-span-9 space-y-4 md:space-y-6 order-1 lg:order-2">

              {/* Content Viewer Card */}
              <div className="bg-white rounded-none sm:rounded-xl shadow-sm border-y sm:border border-gray-200 overflow-hidden min-h-[60vh] md:min-h-[500px] flex flex-col">
                {/* Content Header */}
                {currentContent && (
                  <div className="border-b px-4 py-3 md:px-6 md:py-4 bg-gray-50 flex justify-between items-center">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base md:text-xl font-bold text-gray-900 line-clamp-1">{currentContent.title}</h2>
                      <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                        {currentChapter && (currentChapter.name || currentChapter.title)}
                      </p>
                    </div>
                    {isCompleted && (
                       <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 ml-2 shrink-0 text-xs">
                         <CheckCircle className="w-3 h-3 mr-1" />
                         <span className="hidden sm:inline">Completed</span>
                       </Badge>
                    )}
                  </div>
                )}

                {/* Content Body */}
                <div className="flex-1 p-3 sm:p-6 relative" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
                  {contentsLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10">
                      <div className="text-center">
                        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">Loading lesson...</p>
                      </div>
                    </div>
                  ) : !contents || contents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-20 px-4">
                      <div className="bg-gray-100 p-4 rounded-full mb-4">
                         <FileText className="h-8 w-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Content Available</h3>
                      <p className="text-gray-500 max-w-sm">This chapter does not have any published content yet.</p>
                       {contentsError && (
                          <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded max-w-md">
                            <p className="font-semibold mb-1">Error Details:</p>
                            <p>{(contentsError as ErrorWithCode)?.message || 'Failed to load content'}</p>
                            {(contentsError as ErrorWithCode)?.code && (
                              <p className="text-xs mt-1">Code: {(contentsError as ErrorWithCode).code}</p>
                            )}
                          </div>
                       )}
                    </div>
                  ) : !currentContent ? (
                     <div className="flex flex-col items-center justify-center h-full text-center py-20 px-4">
                        <Play className="h-12 w-12 text-blue-200 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Learn?</h3>
                        <p className="text-gray-500 mb-6">Select a lesson from the sidebar to start.</p>
                        {contents[0] && (
                           <Button onClick={() => setContentId(contents[0].id)}>Start Chapter</Button>
                        )}
                     </div>
                  ) : (
                    renderContentViewer()
                  )}
                </div>

                {/* Content Footer / Navigation */}
                <div className="border-t px-4 py-3 md:px-6 md:py-4 bg-gray-50 flex justify-between items-center">
                   <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevious}
                   >
                      <ChevronLeft className="h-4 w-4 mr-1 md:mr-2" />
                      <span className="hidden sm:inline">Previous</span>
                    </Button>
                   <Button
                      size="sm"
                      onClick={handleNext}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                   >
                      <span className="hidden sm:inline">
                        {contents && currentContentIndex < contents.length - 1
                          ? 'Next Lesson'
                          : (nextChapter ? 'Next Chapter' : 'Finish Course')}
                      </span>
                      {(!nextChapter && currentContentIndex >= (contents?.length || 0) - 1)
                        ? <CheckCircle className="h-4 w-4 sm:ml-2" />
                        : <ChevronRight className="h-4 w-4 sm:ml-2" />}
                   </Button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
    </ErrorBoundary>
  )
}


