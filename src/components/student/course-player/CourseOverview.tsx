'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  FileText,
  FolderDown,
  Info,
  Layers,
  ListChecks,
  Lock,
  PlayCircle,
  StickyNote,
  Trophy,
  Video,
} from 'lucide-react'
import { Button } from '../../ui/button'
import { useChapterContents } from '../../../hooks/useStudentData'
import { useCourseProgressStore } from '../../../store/course-progress-store'
import { makeIsCompleted, computeItemGating } from '../../../lib/course-gating'
import { studentApi } from '../../../lib/api'
import NoteTakingPanel from './NoteTakingPanel'
import ResourcesPanel from './ResourcesPanel'

interface Chapter {
  id: string
  name?: string
  title?: string
  order_number?: number
  order_index?: number
  is_completed?: boolean
  is_unlocked?: boolean
  content_count?: number
  completed_count?: number
}

interface Course {
  id: string
  name?: string
  title?: string
  description?: string
  thumbnail_url?: string
  // Computed metadata from /student/courses (optional — rendered when present).
  total_lessons?: number
  estimated_minutes?: number
  last_updated?: string
  instructor_name?: string
  level?: string
  learning_outcomes?: string[]
}

interface Content {
  id: string
  title: string
  content_type?: string
  content_url?: string
  duration_minutes?: number | null
  is_completed?: boolean
}

interface CourseOverviewProps {
  courseId: string
  course?: Course
  chapters: Chapter[]
  courseName: string
  overallProgressPercent: number
  completedContentItems: number
  totalContentItems: number
  onStart: (chapterId: string, contentId?: string) => void
  onExit: () => void
}

const RESOURCE_TYPES = ['pdf', 'file', 'image', 'link', 'audio', 'doc']

function formatDuration(min?: number | null): string | null {
  if (!min || min <= 0) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

function contentIcon(t?: string) {
  const x = (t || '').toLowerCase()
  if (x === 'video' || x === 'video_link') return Video
  if (x === 'quiz' || x === 'assignment') return ClipboardList
  if (x === 'pdf' || x === 'file') return FileText
  return FileText
}

type Tab = 'overview' | 'curriculum' | 'notes' | 'resources'

export default function CourseOverview({
  courseId,
  course,
  chapters,
  courseName,
  overallProgressPercent,
  completedContentItems,
  totalContentItems,
  onStart,
  onExit,
}: CourseOverviewProps) {
  const [tab, setTab] = useState<Tab>('overview')
  const completedChapters = chapters.filter(c => c.is_completed).length
  const totalChapters = chapters.length
  const isComplete = totalContentItems > 0 && completedContentItems >= totalContentItems

  const resumeChapter = useMemo(
    () => chapters.find(c => !c.is_completed && c.is_unlocked !== false) || chapters[0],
    [chapters]
  )

  const ctaLabel =
    overallProgressPercent === 0 ? 'Start course' : isComplete ? 'Review course' : 'Continue learning'

  const description = course?.description?.trim()
  const duration = formatDuration(course?.estimated_minutes)
  const lessonCount = course?.total_lessons ?? totalContentItems
  const lastUpdated = course?.last_updated
    ? new Date(course.last_updated).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null
  const outcomes = course?.learning_outcomes?.filter(Boolean) ?? []

  // Certificate progress (mirrors the 80% eligibility rule).
  const CERT_THRESHOLD = 80
  const certEligible = overallProgressPercent >= CERT_THRESHOLD
  const certGap = Math.max(0, CERT_THRESHOLD - overallProgressPercent)

  // Resources tab: lazy-aggregate downloadable content across all chapters.
  const [materials, setMaterials] = useState<{ id: string; title: string; file_url: string; file_type?: string; chapter_id: string }[] | null>(null)
  const [loadingResources, setLoadingResources] = useState(false)
  useEffect(() => {
    if (tab !== 'resources' || materials !== null || !courseId || chapters.length === 0) return
    setLoadingResources(true)
    Promise.all(
      chapters.map(ch =>
        studentApi.courses
          .getChapterContents(courseId, ch.id)
          .then(r => ((r.data as { contents?: Content[] })?.contents ?? []))
          .catch(() => [] as Content[])
      )
    )
      .then(lists => {
        const mats = lists
          .flat()
          .filter(c => RESOURCE_TYPES.includes((c.content_type || '').toLowerCase()) && !!c.content_url)
          .map(c => ({
            id: c.id,
            title: c.title,
            file_url: c.content_url as string,
            file_type: c.content_type,
            chapter_id: '',
          }))
        setMaterials(mats)
      })
      .finally(() => setLoadingResources(false))
  }, [tab, materials, courseId, chapters])

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Info className="h-4 w-4" /> },
    { id: 'curriculum', label: 'Curriculum', icon: <ListChecks className="h-4 w-4" /> },
    { id: 'notes', label: 'Notes', icon: <StickyNote className="h-4 w-4" /> },
    { id: 'resources', label: 'Resources', icon: <FolderDown className="h-4 w-4" /> },
  ]

  return (
    <div className="min-h-screen bg-gray-50 overflow-y-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-700 to-indigo-800 text-white">
        <div className="max-w-5xl mx-auto px-6 pt-6 pb-10">
          <button
            onClick={onExit}
            className="inline-flex items-center gap-1.5 text-sm text-blue-100 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            My Courses
          </button>

          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="relative h-28 w-28 rounded-2xl overflow-hidden bg-white/10 flex-shrink-0 ring-1 ring-white/20">
              {course?.thumbnail_url ? (
                <Image src={course.thumbnail_url} alt={courseName} fill sizes="112px" unoptimized className="object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <BookOpen className="h-10 w-10 text-white/70" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{courseName}</h1>

              {/* Meta row */}
              <div className="mt-2 flex items-center gap-x-4 gap-y-1 flex-wrap text-sm text-blue-100/90">
                <span className="flex items-center gap-1.5"><PlayCircle className="h-4 w-4" />{lessonCount} lessons</span>
                <span className="flex items-center gap-1.5"><Layers className="h-4 w-4" />{totalChapters} modules</span>
                {duration && <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{duration}</span>}
                {course?.level && <span className="flex items-center gap-1.5"><Award className="h-4 w-4" />{course.level}</span>}
                {course?.instructor_name && <span>By {course.instructor_name}</span>}
                {lastUpdated && <span className="text-blue-200/80">Updated {lastUpdated}</span>}
              </div>

              {description && (
                <p className="mt-2 text-sm text-blue-100 leading-relaxed max-w-2xl line-clamp-2">{description}</p>
              )}

              {/* Progress */}
              <div className="mt-4 max-w-md">
                <div className="flex items-center justify-between text-xs text-blue-100 mb-1.5">
                  <span>{overallProgressPercent}% complete</span>
                  <span>{completedContentItems}/{totalContentItems} items</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${overallProgressPercent}%` }} />
                </div>
              </div>

              <div className="mt-4">
                {resumeChapter && (
                  <Button
                    onClick={() => onStart(resumeChapter.id)}
                    className="bg-white text-blue-700 hover:bg-blue-50 font-semibold rounded-lg px-5 py-2.5 flex items-center gap-2"
                  >
                    {isComplete ? <Trophy className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                    {ctaLabel}
                    {!isComplete && <ArrowRight className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.id ? 'text-blue-700' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.icon}
              {t.label}
              {tab === t.id && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t" />}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="Modules" value={`${completedChapters}/${totalChapters}`} hint="completed" />
              <StatCard label="Learning items" value={`${completedContentItems}/${totalContentItems}`} hint="completed" />
              <StatCard
                label="Status"
                value={isComplete ? 'Completed' : overallProgressPercent > 0 ? 'In progress' : 'Not started'}
                hint=""
                accent={isComplete ? 'green' : 'blue'}
              />
            </div>

            {/* Certificate nudge */}
            <div className={`rounded-xl border p-4 flex items-center gap-4 ${certEligible ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className={`h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 ${certEligible ? 'bg-green-100' : 'bg-amber-100'}`}>
                <Award className={`h-6 w-6 ${certEligible ? 'text-green-600' : 'text-amber-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${certEligible ? 'text-green-800' : 'text-amber-800'}`}>
                  {certEligible ? 'Certificate unlocked!' : `You're ${certGap}% away from your certificate`}
                </p>
                <p className={`text-xs ${certEligible ? 'text-green-600' : 'text-amber-700'}`}>
                  {certEligible
                    ? 'You’ve completed enough of this course to earn a certificate.'
                    : `Reach ${CERT_THRESHOLD}% completion to earn your certificate of completion.`}
                </p>
              </div>
              {certEligible && (
                <Link href="/lms/student/certificates">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">View</Button>
                </Link>
              )}
            </div>

            {/* What you'll learn (only when data exists) */}
            {outcomes.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-3">What you&apos;ll learn</h2>
                <div className="grid sm:grid-cols-2 gap-2">
                  {outcomes.map((o, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{o}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* About */}
            {description && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-2">About this course</h2>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{description}</p>
              </div>
            )}

            {/* Instructor (only when data exists) */}
            {course?.instructor_name && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-3">Instructor</h2>
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold">
                    {course.instructor_name.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-sm font-medium text-gray-800">{course.instructor_name}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Curriculum ── */}
        {tab === 'curriculum' && (
          <div className="space-y-2.5">
            {chapters.map((chapter, idx) => (
              <CurriculumModule
                key={chapter.id}
                courseId={courseId}
                chapter={chapter}
                index={idx}
                onStart={onStart}
              />
            ))}
            {chapters.length === 0 && (
              <div className="bg-white border border-dashed border-gray-200 rounded-xl py-12 text-center text-gray-400">
                <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No content has been added to this course yet.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Notes (course-level) ── */}
        {tab === 'notes' && (
          <NoteTakingPanel courseId={courseId} chapterId="__course__" contentId="__course_notes__" isOpen />
        )}

        {/* ── Resources (aggregate) ── */}
        {tab === 'resources' && (
          loadingResources ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading resources…</div>
          ) : (
            <ResourcesPanel courseId={courseId} materials={materials ?? []} isOpen />
          )
        )}
      </div>
    </div>
  )
}

// ── Curriculum module (lazy-loads its lessons on expand) ─────────────────────
function CurriculumModule({
  courseId,
  chapter,
  index,
  onStart,
}: {
  courseId: string
  chapter: Chapter
  index: number
  onStart: (chapterId: string, contentId?: string) => void
}) {
  const [open, setOpen] = useState(false)
  const moduleNum = chapter.order_number || chapter.order_index || index + 1
  const locked = chapter.is_unlocked === false
  const done = !!chapter.is_completed
  const total = chapter.content_count || 0
  const completed = chapter.completed_count || 0

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all ${locked ? 'border-gray-100 opacity-80' : 'border-gray-200'}`}>
      <button
        disabled={locked}
        onClick={() => setOpen(o => !o)}
        className={`w-full text-left p-4 flex items-center gap-4 ${locked ? 'cursor-not-allowed' : 'hover:bg-gray-50'}`}
      >
        <div className="flex-shrink-0">
          {locked ? (
            <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center"><Lock className="h-4 w-4 text-gray-400" /></div>
          ) : done ? (
            <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-green-600" /></div>
          ) : (
            <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center"><PlayCircle className="h-5 w-5 text-blue-600" /></div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Module {moduleNum}</p>
          <p className="text-sm font-semibold text-gray-900 truncate">{chapter.name || chapter.title || `Chapter ${moduleNum}`}</p>
          {total > 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 w-28 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }} />
              </div>
              <span className="text-[11px] text-gray-400">{completed}/{total} items</span>
            </div>
          )}
        </div>
        {locked ? (
          <span className="text-[11px] text-gray-400 flex-shrink-0">Locked</span>
        ) : open ? (
          <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {open && !locked && <ModuleLessons courseId={courseId} chapterId={chapter.id} onStart={onStart} />}
    </div>
  )
}

function ModuleLessons({
  courseId,
  chapterId,
  onStart,
}: {
  courseId: string
  chapterId: string
  onStart: (chapterId: string, contentId?: string) => void
}) {
  const { data: contentsRaw, isLoading } = useChapterContents(chapterId, courseId)
  const contents = (contentsRaw as Content[] | undefined) || []
  const { isContentCompleted } = useCourseProgressStore()
  const isDone = makeIsCompleted(isContentCompleted)
  const gating = contents.length ? computeItemGating(contents, isDone) : []

  if (isLoading) {
    return <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">Loading lessons…</div>
  }
  if (contents.length === 0) {
    return <div className="px-4 py-3 text-xs text-gray-400 italic border-t border-gray-100">No content in this module.</div>
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50/40">
      {contents.map((c, idx) => {
        const Icon = contentIcon(c.content_type)
        const gate = gating[idx]
        const completed = gate?.completed ?? (c.is_completed || isContentCompleted(c.id))
        const locked = gate ? !gate.unlocked : false
        const dur = formatDuration(c.duration_minutes)
        return (
          <button
            key={c.id}
            disabled={locked}
            onClick={() => !locked && onStart(chapterId, c.id)}
            className={`w-full px-4 py-2.5 flex items-center gap-3 text-left border-b border-gray-100 last:border-0 transition-colors ${
              locked ? 'cursor-not-allowed opacity-60' : 'hover:bg-white'
            }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${
              completed ? 'bg-green-500 border-green-500' : locked ? 'border-gray-200' : 'border-gray-300'
            }`}>
              {completed && <CheckCircle2 className="h-3 w-3 text-white" />}
              {!completed && locked && <Lock className="h-2.5 w-2.5 text-gray-400" />}
            </div>
            <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className={`flex-1 text-sm truncate ${completed ? 'text-gray-500' : locked ? 'text-gray-400' : 'text-gray-800'}`}>
              {c.title}
            </span>
            {dur && <span className="text-[11px] text-gray-400 flex-shrink-0">{dur}</span>}
          </button>
        )
      })}
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  accent = 'gray',
}: {
  label: string
  value: string
  hint: string
  accent?: 'gray' | 'blue' | 'green'
}) {
  const valueColor =
    accent === 'green' ? 'text-green-600' : accent === 'blue' ? 'text-blue-700' : 'text-gray-900'
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${valueColor}`}>{value}</p>
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  )
}
