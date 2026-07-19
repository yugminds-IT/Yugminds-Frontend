'use client'

import { useStudentCourses } from '@/hooks/useStudentData'
import { studentApi } from '@/lib/api/student.api'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ActivityCalendar, { type ActivityDay } from '@/components/student/ActivityCalendar'
import CircularProgress from '@/components/student/CircularProgress'
import ErrorBoundary from '@/components/student/course-player/ErrorBoundary'
import { useCourseProgressStore, type LastViewedEntry } from '@/store/course-progress-store'
import { getStoredUserId } from '@/lib/session-utils'
import {
  BookOpen,
  Search,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Clock,
  PlayCircle,
  Layers,
  LayoutGrid,
  List,
  ArrowRight,
  User,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useMemo, useEffect } from 'react'

interface CourseItem {
  id: string
  name: string
  title: string
  description: string
  grade: string
  subject: string
  thumbnail_url?: string
  progress_percentage: number
  last_accessed: string
  last_updated?: string
  total_chapters: number
  completed_chapters: number
  total_assignments: number
  completed_assignments: number
  total_lessons: number
  estimated_minutes: number
  instructor_name?: string
  average_grade?: number
  status: 'active' | 'completed' | 'not_started'
}

const SUBJECT_GRADIENTS: Record<string, string> = {
  math:    'from-blue-500 to-blue-700',
  science: 'from-emerald-500 to-teal-600',
  english: 'from-purple-500 to-violet-600',
  history: 'from-amber-500 to-orange-600',
  art:     'from-pink-500 to-rose-600',
  default: 'from-indigo-500 to-blue-600',
}

function subjectGradient(subject: string): string {
  const lower = (subject || '').toLowerCase()
  if (lower.includes('math')) return SUBJECT_GRADIENTS.math
  if (lower.includes('science') || lower.includes('bio') || lower.includes('chem') || lower.includes('phys')) return SUBJECT_GRADIENTS.science
  if (lower.includes('english') || lower.includes('lang')) return SUBJECT_GRADIENTS.english
  if (lower.includes('history') || lower.includes('social')) return SUBJECT_GRADIENTS.history
  if (lower.includes('art') || lower.includes('music') || lower.includes('draw')) return SUBJECT_GRADIENTS.art
  return SUBJECT_GRADIENTS.default
}

function formatRelative(iso: string | undefined, nowMs: number | null): string {
  if (!iso || !nowMs) return ''
  const t = new Date(iso).getTime()
  if (isNaN(t)) return ''
  const diff = nowMs - t
  const day = 86_400_000
  if (diff < day) return 'Today'
  if (diff < 2 * day) return 'Yesterday'
  const days = Math.floor(diff / day)
  if (days < 7) return `${days} days ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  return new Date(iso).toLocaleDateString()
}

function formatDuration(min?: number): string | null {
  if (!min || min <= 0) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

type Tab = 'in_progress' | 'completed' | 'all'
type SortKey = 'recent' | 'progress' | 'az'
type ViewMode = 'list' | 'grid'

// ── Thumbnail (shared by row + card) ────────────────────────────────────────
function CourseThumb({ course, size = 'sm' }: { course: CourseItem; size?: 'sm' | 'lg' }) {
  const dim = size === 'lg' ? 'w-full h-32' : 'w-16 h-16'
  if (course.thumbnail_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={course.thumbnail_url} alt={course.title} className={`${dim} ${size === 'lg' ? 'rounded-t-xl' : 'rounded-xl'} object-cover shrink-0`} />
  }
  return (
    <div className={`${dim} ${size === 'lg' ? 'rounded-t-xl' : 'rounded-xl'} bg-gradient-to-br ${subjectGradient(course.subject)} flex items-center justify-center shrink-0 shadow-sm`}>
      <BookOpen className={size === 'lg' ? 'h-9 w-9 text-white/90' : 'h-7 w-7 text-white'} />
    </div>
  )
}

// ── Meta chips (lessons · duration · last accessed) ─────────────────────────
function MetaChips({ course, nowMs }: { course: CourseItem; nowMs: number | null }) {
  const duration = formatDuration(course.estimated_minutes)
  const accessed = formatRelative(course.last_accessed, nowMs)
  return (
    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px] text-gray-400">
      {course.total_lessons > 0 && (
        <span className="flex items-center gap-1"><PlayCircle className="h-3 w-3" />{course.total_lessons} lesson{course.total_lessons !== 1 ? 's' : ''}</span>
      )}
      {course.total_chapters > 0 && (
        <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{course.total_chapters} module{course.total_chapters !== 1 ? 's' : ''}</span>
      )}
      {duration && (
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{duration}</span>
      )}
      {course.instructor_name && (
        <span className="flex items-center gap-1"><User className="h-3 w-3" />{course.instructor_name}</span>
      )}
      {accessed && course.status !== 'not_started' && (
        <span className="text-gray-400">Last accessed {accessed}</span>
      )}
    </div>
  )
}

// ── Continue-learning hero ──────────────────────────────────────────────────
function ContinueHero({
  course,
  lastViewed,
  onResume,
}: {
  course: CourseItem
  lastViewed?: LastViewedEntry | null
  onResume: () => void
}) {
  const nextLesson = lastViewed?.contentTitle || lastViewed?.chapterTitle
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-700 to-indigo-800 text-white shadow-lg">
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 90% 10%, white 0, transparent 40%)' }} />
      <div className="relative p-5 sm:p-6 flex items-center gap-5">
        <div className="hidden sm:block relative h-20 w-20 rounded-xl overflow-hidden ring-1 ring-white/20 bg-white/10 shrink-0">
          {course.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={course.thumbnail_url} alt={course.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center"><BookOpen className="h-8 w-8 text-white/70" /></div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-200">Continue learning</p>
          <h2 className="text-lg sm:text-xl font-bold leading-tight truncate mt-0.5">{course.title}</h2>
          <p className="text-sm text-blue-100/90 mt-1 truncate">
            {nextLesson ? <>Up next: <span className="font-medium text-white">{nextLesson}</span></> : 'Pick up where you left off'}
          </p>
          <div className="mt-3 max-w-md">
            <div className="flex items-center justify-between text-[11px] text-blue-100 mb-1">
              <span>{Math.round(course.progress_percentage)}% complete</span>
              <span>{course.completed_chapters}/{course.total_chapters} modules</span>
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${course.progress_percentage}%` }} />
            </div>
          </div>
        </div>

        <Button
          onClick={onResume}
          className="bg-white text-blue-700 hover:bg-blue-50 font-semibold rounded-lg px-5 py-2.5 shrink-0 hidden sm:flex items-center gap-2"
        >
          Resume
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      {/* Mobile resume button */}
      <div className="relative px-5 pb-5 sm:hidden">
        <Button onClick={onResume} className="w-full bg-white text-blue-700 hover:bg-blue-50 font-semibold rounded-lg flex items-center justify-center gap-2">
          Resume <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ── Next-lesson line (shared by row + card) ─────────────────────────────────
function NextLesson({ lv }: { lv?: LastViewedEntry | null }) {
  const label = lv?.contentTitle || lv?.chapterTitle
  if (!label) return null
  return (
    <p className="flex items-center gap-1 text-xs text-blue-600 mt-0.5 min-w-0">
      <PlayCircle className="h-3 w-3 shrink-0" />
      <span className="truncate">Next: {label}</span>
    </p>
  )
}

// ── List row ────────────────────────────────────────────────────────────────
function CourseRow({ course, nowMs, lv, onResume }: { course: CourseItem; nowMs: number | null; lv?: LastViewedEntry | null; onResume: () => void }) {
  const isCompleted = course.progress_percentage >= 100 || course.status === 'completed'
  const isNotStarted = course.status === 'not_started' && course.progress_percentage === 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex gap-4 hover:shadow-md hover:border-gray-300 transition-all group">
      <div className="relative shrink-0">
        <CourseThumb course={course} />
        {!isNotStarted && (
          <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-0.5 shadow-sm">
            <CircularProgress value={course.progress_percentage} size={28} stroke={3} showLabel={false} />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {course.grade && (
            <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{course.grade}</span>
          )}
          {course.subject && <span className="text-[11px] text-gray-400">{course.subject}</span>}
        </div>
        <h3 className="font-semibold text-gray-900 text-[15px] line-clamp-1 group-hover:text-blue-700 transition-colors">
          {course.title}
        </h3>
        <p className="text-xs text-gray-500 mt-0.5 mb-1.5">
          {Math.round(course.progress_percentage)}% complete
          {course.total_chapters > 0 && ` · ${course.completed_chapters} of ${course.total_chapters} chapters`}
        </p>
        {!isCompleted && !isNotStarted && <NextLesson lv={lv} />}
        <MetaChips course={course} nowMs={nowMs} />
        <Progress
          value={course.progress_percentage}
          className={`h-1.5 mt-2 bg-gray-100 ${isCompleted ? '[&>div]:bg-green-500' : '[&>div]:bg-blue-600'}`}
        />
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {isCompleted && (
          <div className="hidden lg:flex items-center gap-1.5 text-green-600 text-xs font-medium">
            <CheckCircle className="h-4 w-4" />
            Completed
          </div>
        )}
        <Button
          size="sm"
          className={`${isCompleted ? 'bg-gray-800 hover:bg-gray-900' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
          onClick={onResume}
        >
          {isCompleted ? 'Review' : isNotStarted ? 'Start' : 'Resume'}
          <ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  )
}

// ── Grid card ────────────────────────────────────────────────────────────────
function CourseCard({ course, nowMs, lv, onResume }: { course: CourseItem; nowMs: number | null; lv?: LastViewedEntry | null; onResume: () => void }) {
  const isCompleted = course.progress_percentage >= 100 || course.status === 'completed'
  const isNotStarted = course.status === 'not_started' && course.progress_percentage === 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-gray-300 transition-all group flex flex-col">
      <div className="relative">
        <CourseThumb course={course} size="lg" />
        {!isNotStarted && (
          <div className="absolute bottom-2 right-2 bg-white/95 rounded-full p-0.5 shadow">
            <CircularProgress value={course.progress_percentage} size={36} stroke={4} />
          </div>
        )}
        {course.grade && (
          <span className="absolute top-2 left-2 text-[11px] bg-black/45 text-white px-2 py-0.5 rounded-full font-medium backdrop-blur-sm">
            {course.grade}
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        {course.subject && <p className="text-[11px] text-gray-400 mb-0.5">{course.subject}</p>}
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 group-hover:text-blue-700 transition-colors min-h-[2.5rem]">
          {course.title}
        </h3>
        {!isCompleted && !isNotStarted && <NextLesson lv={lv} />}
        <div className="mt-2 mb-3"><MetaChips course={course} nowMs={nowMs} /></div>
        <div className="mt-auto">
          <Progress
            value={course.progress_percentage}
            className={`h-1.5 mb-3 bg-gray-100 ${isCompleted ? '[&>div]:bg-green-500' : '[&>div]:bg-blue-600'}`}
          />
          <Button
            size="sm"
            className={`w-full ${isCompleted ? 'bg-gray-800 hover:bg-gray-900' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
            onClick={onResume}
          >
            {isCompleted ? 'Review' : isNotStarted ? 'Start' : 'Resume'}
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function MyCoursesPage() {
  const router = useRouter()
  const { data: coursesData, isLoading, error } = useStudentCourses()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('in_progress')
  const [sortBy, setSortBy] = useState<SortKey>('recent')
  const [view, setView] = useState<ViewMode>('list')
  const [mounted, setMounted] = useState(false)
  // "Now" captured once on mount (reading the clock during render is impure).
  const [nowMs, setNowMs] = useState<number | null>(null)

  // Per-user resume cache (persisted client-side) for the Continue hero.
  const lastViewedMap = useCourseProgressStore((s) => s.lastViewed)
  const ensureOwner = useCourseProgressStore((s) => s.ensureOwner)

  useEffect(() => {
    ensureOwner(getStoredUserId())
  }, [ensureOwner])

  useEffect(() => {
    const t = setTimeout(() => {
      setMounted(true)
      setNowMs(Date.now())
      // Deep-link support: /my-courses?tab=completed (e.g. from dashboard stat card)
      const tab = new URLSearchParams(window.location.search).get('tab')
      if (tab === 'completed' || tab === 'all' || tab === 'in_progress') setActiveTab(tab as Tab)
    }, 0)
    return () => clearTimeout(t)
  }, [])

  const courses: CourseItem[] = useMemo(() => {
    interface CourseData {
      id: string
      name?: string
      title?: string
      description?: string
      grade?: string
      subject?: string
      thumbnail_url?: string
      progress_percentage?: number
      last_accessed?: string
      last_updated?: string
      total_chapters?: number
      completed_chapters?: number
      total_assignments?: number
      completed_assignments?: number
      total_lessons?: number
      estimated_minutes?: number
      instructor_name?: string
      average_grade?: number
      status?: string
    }

    return ((coursesData as CourseData[] | undefined) || []).map(c => ({
      id: c.id,
      name: c.name || c.title || '',
      title: c.title || c.name || '',
      description: c.description || '',
      grade: c.grade || '',
      subject: c.subject || '',
      thumbnail_url: c.thumbnail_url,
      progress_percentage: c.progress_percentage || 0,
      last_accessed: c.last_accessed || new Date().toISOString(),
      last_updated: c.last_updated,
      total_chapters: c.total_chapters || 0,
      completed_chapters: c.completed_chapters || 0,
      total_assignments: c.total_assignments || 0,
      completed_assignments: c.completed_assignments || 0,
      total_lessons: c.total_lessons || 0,
      estimated_minutes: c.estimated_minutes || 0,
      instructor_name: c.instructor_name || undefined,
      average_grade: c.average_grade,
      status: (['active', 'completed', 'not_started'].includes(c.status || '') ? c.status : 'active') as CourseItem['status'],
    }))
  }, [coursesData])

  const goToCourse = (course: CourseItem) => {
    const url = course.progress_percentage > 0 && course.status !== 'completed'
      ? `/lms/student/my-courses/${course.id}?resume=1`
      : `/lms/student/my-courses/${course.id}`
    router.push(url)
  }

  // Continue-learning: most recently active in-progress course (prefer client
  // resume timestamp, else server last_accessed).
  const resumeTarget = useMemo(() => {
    const inProgress = courses.filter(c => c.status !== 'completed' && c.progress_percentage > 0 && c.progress_percentage < 100)
    if (inProgress.length === 0) return null
    const ranked = inProgress
      .map(c => {
        const lv = lastViewedMap[c.id]
        const t = lv?.savedAt ? new Date(lv.savedAt).getTime() : new Date(c.last_accessed).getTime()
        return { course: c, lv: lv ?? null, t: isNaN(t) ? 0 : t }
      })
      .sort((a, b) => b.t - a.t)
    return ranked[0]
  }, [courses, lastViewedMap])

  // ── Real activity calendar data from CourseProgress.completedAt ─────────────
  const [serverActivityDays, setServerActivityDays] = useState<ActivityDay[]>([])

  useEffect(() => {
    if (!mounted) return
    studentApi.progress.simple().then(({ data }) => {
      type PR = { completed_at?: string | null; content_id?: string | null; chapter_id?: string | null }
      const items: PR[] = (data as { progress?: PR[] }).progress ?? []

      const keyOf = (iso: string) => {
        const d = new Date(iso)
        if (isNaN(d.getTime())) return null
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }
      const isChapterRow = (item: PR) =>
        !item.content_id || ['', 'null', 'undefined'].includes(String(item.content_id))

      const map = new Map<string, ActivityDay>()
      items.forEach(item => {
        if (!item.completed_at) return
        const key = keyOf(item.completed_at)
        if (!key) return
        const existing = map.get(key) ?? { date: key }
        if (isChapterRow(item)) {
          if (item.chapter_id) {
            existing.hasAssignment = true
            existing.hasLearning = true
          }
        } else {
          existing.hasLearning = true
        }
        map.set(key, existing)
      })
      setServerActivityDays(Array.from(map.values()))
    }).catch(() => {
      // Silent fallback — calendar just shows less data
    })
  }, [mounted])

  const activityDays: ActivityDay[] = useMemo(() => {
    if (serverActivityDays.length > 0) return serverActivityDays
    const map = new Map<string, ActivityDay>()
    courses.forEach(c => {
      if (!c.last_accessed) return
      const d = new Date(c.last_accessed)
      if (isNaN(d.getTime())) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      map.set(key, { date: key, hasLearning: true })
    })
    return Array.from(map.values())
  }, [serverActivityDays, courses])

  const calendarStats = useMemo(() => {
    const cutoffMs = (nowMs ?? 0) - 28 * 24 * 60 * 60 * 1000
    const activeDays = nowMs
      ? activityDays.filter(d => new Date(d.date).getTime() >= cutoffMs).length
      : 0
    const chaptersCompleted = courses.reduce((s, c) => s + c.completed_chapters, 0)
    const inProgress = courses.filter(c => c.status === 'active').length
    return [
      { label: 'Active days', value: activeDays },
      { label: 'Chapters done', value: chaptersCompleted },
      { label: 'In progress', value: inProgress },
    ]
  }, [activityDays, courses, nowMs])

  const tabs = useMemo(() => [
    { id: 'in_progress' as Tab, label: 'In Progress', count: courses.filter(c => c.status !== 'completed' && c.progress_percentage < 100).length },
    { id: 'completed' as Tab, label: 'Completed', count: courses.filter(c => c.status === 'completed' || c.progress_percentage >= 100).length },
    { id: 'all' as Tab, label: 'All Courses', count: courses.length },
  ], [courses])

  const filtered = useMemo(() => {
    let list = courses
    if (activeTab === 'in_progress') list = list.filter(c => c.status !== 'completed' && c.progress_percentage < 100)
    else if (activeTab === 'completed') list = list.filter(c => c.status === 'completed' || c.progress_percentage >= 100)

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q)
      )
    }
    return list
  }, [courses, activeTab, searchQuery])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    if (sortBy === 'recent') arr.sort((a, b) => new Date(b.last_accessed).getTime() - new Date(a.last_accessed).getTime())
    else if (sortBy === 'progress') arr.sort((a, b) => b.progress_percentage - a.progress_percentage)
    else if (sortBy === 'az') arr.sort((a, b) => a.title.localeCompare(b.title))
    return arr
  }, [filtered, sortBy])

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center max-w-md mx-auto">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <p className="font-semibold text-red-800 mb-3">
            {error instanceof Error ? error.message : 'Failed to load courses'}
          </p>
          <Button onClick={() => window.location.reload()} variant="outline" size="sm">Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 p-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Learning</h1>
            <p className="text-sm text-gray-500 mt-0.5">{courses.length} course{courses.length !== 1 ? 's' : ''} enrolled</p>
          </div>
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search courses..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
        </div>

        {/* Continue learning hero */}
        {resumeTarget && !searchQuery && (
          <div className="mb-6">
            <ContinueHero
              course={resumeTarget.course}
              lastViewed={resumeTarget.lv}
              onResume={() => goToCourse(resumeTarget.course)}
            />
          </div>
        )}

        {/* Two-column layout */}
        <div className="flex gap-6 items-start">
          {/* Left: course list */}
          <div className="flex-1 min-w-0">
            {/* Toolbar: tabs + sort + view toggle */}
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 mb-4 bg-white rounded-t-xl px-1 shadow-sm">
              <div className="flex">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3 text-sm font-medium relative transition-colors ${
                      activeTab === tab.id ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                        activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t" />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 pr-2">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortKey)}
                  className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400"
                  aria-label="Sort courses"
                >
                  <option value="recent">Recently accessed</option>
                  <option value="progress">Progress</option>
                  <option value="az">A–Z</option>
                </select>
                <div className="hidden sm:flex items-center bg-gray-50 border border-gray-200 rounded-md p-0.5">
                  <button
                    onClick={() => setView('list')}
                    className={`p-1.5 rounded ${view === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                    aria-label="List view"
                    title="List view"
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setView('grid')}
                    className={`p-1.5 rounded ${view === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                    aria-label="Grid view"
                    title="Grid view"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Course rows / cards */}
            {isLoading ? (
              <div className={view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-3'}>
                {[1, 2, 3].map(i => (
                  <div key={i} className={`${view === 'grid' ? 'h-64' : 'h-24'} bg-white rounded-xl animate-pulse border border-gray-100`} />
                ))}
              </div>
            ) : sorted.length > 0 ? (
              view === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {sorted.map(course => (
                    <CourseCard key={course.id} course={course} nowMs={nowMs} lv={lastViewedMap[course.id]} onResume={() => goToCourse(course)} />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {sorted.map(course => (
                    <CourseRow key={course.id} course={course} nowMs={nowMs} lv={lastViewedMap[course.id]} onResume={() => goToCourse(course)} />
                  ))}
                </div>
              )
            ) : (
              <div className="bg-white rounded-xl border border-dashed border-gray-200 py-16 text-center shadow-sm">
                <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-gray-50 flex items-center justify-center">
                  <BookOpen className="h-7 w-7 text-gray-300" />
                </div>
                <p className="font-medium text-gray-600">
                  {searchQuery
                    ? 'No courses match your search'
                    : activeTab === 'completed'
                    ? 'No completed courses yet'
                    : activeTab === 'in_progress'
                    ? 'No courses in progress'
                    : 'No courses yet'}
                </p>
                <p className="text-sm text-gray-400 mt-1 max-w-xs mx-auto">
                  {searchQuery
                    ? 'Try a different search term.'
                    : activeTab === 'completed'
                    ? 'Complete a course to see it here.'
                    : 'Your enrolled courses will appear here.'}
                </p>
                {activeTab !== 'all' && !searchQuery && (
                  <Button variant="link" onClick={() => setActiveTab('all')} className="mt-2 text-blue-600 text-sm">
                    View all courses
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Right: calendar sidebar */}
          <div className="w-72 shrink-0 space-y-4">
            <ActivityCalendar
              activityDays={activityDays}
              stats={calendarStats}
              legendLabels={{ dot: 'Lesson completed', line: 'All lessons done' }}
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
