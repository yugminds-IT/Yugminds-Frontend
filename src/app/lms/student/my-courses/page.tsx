'use client'

import { useStudentCourses } from '@/hooks/useStudentData'
import { studentApi } from '@/lib/api/student.api'
import ProgressRail from '@/components/portal/ProgressRail'
import MonthCalendar, { type ActivityDay } from '@/components/portal/MonthCalendar'
import ErrorBoundary from '@/components/student/course-player/ErrorBoundary'
import { useCourseProgressStore, type LastViewedEntry } from '@/store/course-progress-store'
import { getStoredUserId } from '@/lib/session-utils'
import { AlertCircle, ArrowRight, BookOpen, Check, Clock, LayoutGrid, Layers, List, Play, PlayCircle, Search, User } from 'lucide-react'
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

function formatRelative(iso: string | undefined, nowMs: number | null): string {
  if (!iso || !nowMs) return ''
  const t = new Date(iso).getTime()
  if (isNaN(t)) return ''
  const diff = nowMs - t
  const day = 86_400_000
  if (diff < day) return 'today'
  if (diff < 2 * day) return 'yesterday'
  const days = Math.floor(diff / day)
  if (days < 7) return `${days} days ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
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

const isDone = (c: CourseItem) => c.progress_percentage >= 100 || c.status === 'completed'
const isFresh = (c: CourseItem) => c.status === 'not_started' && c.progress_percentage === 0
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/** Lessons, modules, duration, tutor and last visit, as plain text with a small icon. */
function Meta({ course, nowMs }: { course: CourseItem; nowMs: number | null }) {
  const duration = formatDuration(course.estimated_minutes)
  const accessed = formatRelative(course.last_accessed, nowMs)
  return (
    <p className="mc-meta">
      {course.total_lessons > 0 && <span><PlayCircle aria-hidden="true" />{plural(course.total_lessons, 'lesson')}</span>}
      {duration && <span><Clock aria-hidden="true" />{duration}</span>}
      {course.instructor_name && <span><User aria-hidden="true" />{course.instructor_name}</span>}
      {accessed && course.status !== 'not_started' && <span>Opened {accessed}</span>}
    </p>
  )
}

/** One bar of chapter segments. Falls back to the percentage when the course has no chapters yet. */
function Segments({ course }: { course: CourseItem }) {
  const total = course.total_chapters
  const n = Math.min(Math.max(total, 10), 12)
  const on = total > 0
    ? Math.round((Math.min(course.completed_chapters, total) / total) * n)
    : Math.round((course.progress_percentage / 100) * n)
  return (
    <div className="sd-seg" data-done={isDone(course)} role="progressbar" aria-valuenow={Math.round(course.progress_percentage)} aria-valuemin={0} aria-valuemax={100} aria-label={`${course.title} progress`}>
      {Array.from({ length: n }, (_, i) => <i key={i} data-on={i < on} style={{ '--k': i } as React.CSSProperties} />)}
    </div>
  )
}

function CourseCard({ course, nowMs, lv, view, onOpen }: { course: CourseItem; nowMs: number | null; lv?: LastViewedEntry | null; view: ViewMode; onOpen: () => void }) {
  const done = isDone(course)
  const fresh = isFresh(course)
  const next = !done && !fresh ? lv?.contentTitle || lv?.chapterTitle : null
  const pct = Math.round(course.progress_percentage)
  return (
    <article className="mc-card" data-view={view}>
      <div className="mc-cover">
        {course.thumbnail_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={course.thumbnail_url} alt="" />
          : <BookOpen aria-hidden="true" />}
        {course.grade && <span className="sd-tag">{course.grade}</span>}
        {done && <span className="mc-done"><Check aria-hidden="true" />Completed</span>}
      </div>
      <div className="mc-body">
        <div className="mc-info">
          {course.subject && <p className="mc-subject">{course.subject}</p>}
          <h3 className="mc-title">{course.title}</h3>
          {next && <p className="mc-next"><Play aria-hidden="true" /><span>Next: {next}</span></p>}
          <Segments course={course} />
          <p className="mc-count">
            <span>{course.total_chapters > 0 ? <><b>{course.completed_chapters}</b> of {plural(course.total_chapters, 'chapter')}</> : fresh ? 'Not started' : 'In progress'}</span>
            <b>{pct}%</b>
          </p>
          <Meta course={course} nowMs={nowMs} />
        </div>
        <div className="mc-cta">
          <button className={`sd-btn ${done ? 'sd-btn--line' : 'sd-btn--ink'}`} onClick={onOpen}>
            {done ? 'Review' : fresh ? 'Start' : 'Resume'}
            {!done && <ArrowRight aria-hidden="true" />}
          </button>
        </div>
      </div>
    </article>
  )
}

export default function MyCoursesPage() {
  const router = useRouter()
  const { data: coursesData, isLoading, error } = useStudentCourses()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [sortBy, setSortBy] = useState<SortKey>('recent')
  const [view, setView] = useState<ViewMode>('grid')
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
    // `d.date` is a bare "YYYY-MM-DD" key built from LOCAL date parts above —
    // `new Date("YYYY-MM-DD")` parses date-only strings as UTC midnight, which
    // can shift the moment by several hours relative to `nowMs` (local epoch)
    // for non-UTC users, occasionally dropping/keeping a day across the 28-day
    // boundary incorrectly. Parse the same key back into local date parts
    // instead, so both sides of the comparison agree on what "today" means.
    const activeDays = nowMs
      ? activityDays.filter(d => {
          const [y, m, day] = d.date.split('-').map(Number)
          return new Date(y, m - 1, day).getTime() >= cutoffMs
        }).length
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
    { id: 'all' as Tab, label: 'All courses', count: courses.length },
    { id: 'in_progress' as Tab, label: 'In progress', count: courses.filter(c => c.status !== 'completed' && c.progress_percentage > 0 && c.progress_percentage < 100).length },
    { id: 'completed' as Tab, label: 'Completed', count: courses.filter(c => c.status === 'completed' || c.progress_percentage >= 100).length },
  ], [courses])

  const filtered = useMemo(() => {
    let list = courses
    if (activeTab === 'in_progress') list = list.filter(c => c.status !== 'completed' && c.progress_percentage > 0 && c.progress_percentage < 100)
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
      <div className="sd-page">
        <div className="sd-skel" style={{ height: '3rem', width: '14rem' }} />
        <div className="sd-skel" style={{ height: '14rem' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="sd-page">
        <section className="sd-panel" role="alert">
          <div className="sd-empty">
            <AlertCircle aria-hidden="true" size={28} color="var(--sd-late)" />
            <b>Your courses did not load</b>
            <p>{error instanceof Error ? error.message : 'Something went wrong while loading your courses.'}</p>
            <button className="sd-btn sd-btn--ink" onClick={() => window.location.reload()}>Try again</button>
          </div>
        </section>
      </div>
    )
  }

  const empty = (() => {
    if (searchQuery) return { title: 'No courses match your search', text: 'Try a different word.' }
    if (activeTab === 'completed') return { title: 'No finished courses yet', text: 'Finish every chapter of a course and it will show up here with its certificate.' }
    if (activeTab === 'in_progress') return { title: 'Nothing in progress', text: 'Pick a course from All courses to start your first chapter.' }
    return { title: 'No courses yet', text: 'Courses your school assigns will show up here.' }
  })()

  const hero = resumeTarget && !searchQuery ? resumeTarget : null
  const heroTime = hero ? formatDuration(hero.course.estimated_minutes) : null
  const heroNext = hero?.lv?.contentTitle || hero?.lv?.chapterTitle

  return (
    <ErrorBoundary>
      <div className="sd-page">
        <div className="mc-head">
          <div>
            <h1>My courses</h1>
            <p>{courses.length === 0 ? 'No courses yet' : `${plural(courses.length, 'course')} from your school`}</p>
          </div>
          <label className="sd-search">
            <Search aria-hidden="true" />
            <input type="search" placeholder="Search courses" aria-label="Search courses" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </label>
        </div>

        {hero && (
          <section className="sd-hero mc-band" aria-labelledby="mc-hero-t">
            <div className="sd-hero-copy">
              <h2 id="mc-hero-t" className="mc-hero-title">{hero.course.title}</h2>
              <p className="sd-status">{heroNext ? <>Up next: <strong>{heroNext}</strong></> : 'Pick up where you left off.'}</p>
              <p className="mc-facts">
                <span><Layers aria-hidden="true" />{plural(hero.course.total_chapters, 'chapter')}</span>
                {hero.course.total_lessons > 0 && <span><PlayCircle aria-hidden="true" />{plural(hero.course.total_lessons, 'lesson')}</span>}
                {heroTime && <span><Clock aria-hidden="true" />{heroTime}</span>}
              </p>
              <div className="sd-hero-actions">
                <button className="sd-btn sd-btn--amber" onClick={() => goToCourse(hero.course)}><Play aria-hidden="true" />Resume course</button>
              </div>
            </div>
            {hero.course.total_chapters > 0 ? (
              <div className="sd-run-card">
                <ProgressRail total={hero.course.total_chapters} completed={hero.course.completed_chapters} />
                <div className="sd-run-foot">
                  <b>{hero.course.completed_chapters} of {hero.course.total_chapters}<small>chapters done</small></b>
                  <span>{Math.round(hero.course.progress_percentage)}% complete</span>
                </div>
              </div>
            ) : (
              <div className="sd-run-card">
                <div className="sd-meter"><i style={{ '--p': `${hero.course.progress_percentage}%` } as React.CSSProperties} /></div>
                <div className="sd-run-foot"><b>{Math.round(hero.course.progress_percentage)}%<small>complete</small></b></div>
              </div>
            )}
          </section>
        )}

        <div className="mc-cols">
          <div className="mc-main">
            <div className="mc-bar">
              <div className="mc-tabs" role="tablist" aria-label="Course filter">
                {tabs.map(tab => (
                  <button key={tab.id} role="tab" className="mc-tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
                    {tab.label}
                    {tab.count > 0 && <b>{tab.count}</b>}
                  </button>
                ))}
              </div>
              <div className="mc-tools">
                <select className="mc-select" value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} aria-label="Sort courses">
                  <option value="recent">Recently opened</option>
                  <option value="progress">Most progress</option>
                  <option value="az">A to Z</option>
                </select>
                <div className="mc-view" role="group" aria-label="Layout">
                  <button aria-pressed={view === 'grid'} onClick={() => setView('grid')} aria-label="Cards" title="Cards"><LayoutGrid /></button>
                  <button aria-pressed={view === 'list'} onClick={() => setView('list')} aria-label="List" title="List"><List /></button>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="mc-grid"><div className="sd-skel" style={{ height: '15rem' }} /><div className="sd-skel" style={{ height: '15rem' }} /></div>
            ) : sorted.length > 0 ? (
              <div key={`${activeTab}-${view}`} className={`${view === 'grid' ? 'mc-grid' : 'mc-list'} mc-swap`}>
                {sorted.map(course => (
                  <CourseCard key={course.id} course={course} nowMs={nowMs} lv={lastViewedMap[course.id]} view={view} onOpen={() => goToCourse(course)} />
                ))}
              </div>
            ) : (
              <section className="sd-panel">
                <div className="sd-empty">
                  <b>{empty.title}</b>
                  <p>{empty.text}</p>
                  {searchQuery ? (
                    <button className="sd-btn sd-btn--line" onClick={() => setSearchQuery('')}>Clear search</button>
                  ) : activeTab !== 'all' ? (
                    <button className="sd-btn sd-btn--line" onClick={() => setActiveTab('all')}>See all courses</button>
                  ) : null}
                </div>
              </section>
            )}
          </div>

          <aside className="mc-aside">
            <MonthCalendar days={activityDays} stats={calendarStats} />
          </aside>
        </div>
      </div>
    </ErrorBoundary>
  )
}
