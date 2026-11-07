'use client'

import { useEffect, useMemo, useState } from 'react'
import ProgressRail from '../../portal/ProgressRail'
import Link from 'next/link'
import {
  ArrowLeft,
  Award,
  Check,
  ChevronDown,
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
  unlocks_in_days?: number | null
  lock_reason?: 'time' | 'sequential' | null
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
  const loadingResources = tab === 'resources' && materials === null && chapters.length > 0
  useEffect(() => {
    if (tab !== 'resources' || materials !== null || !courseId || chapters.length === 0) return
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
  }, [tab, materials, courseId, chapters])

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Info className="h-4 w-4" /> },
    { id: 'curriculum', label: 'Curriculum', icon: <ListChecks className="h-4 w-4" /> },
    { id: 'notes', label: 'Notes', icon: <StickyNote className="h-4 w-4" /> },
    { id: 'resources', label: 'Resources', icon: <FolderDown className="h-4 w-4" /> },
  ]

  return (
    <div className="co sd-player">
      <div className="co-inner">
        <section className="sd-hero mc-band" aria-labelledby="co-title">
          <div className="sd-hero-copy">
            <button className="co-back" onClick={onExit}><ArrowLeft aria-hidden="true" />My courses</button>
            <h1 id="co-title" className="mc-hero-title">{courseName}</h1>
            <p className="mc-facts">
              <span><PlayCircle aria-hidden="true" />{lessonCount} lessons</span>
              <span><Layers aria-hidden="true" />{totalChapters} modules</span>
              {duration && <span><Clock aria-hidden="true" />{duration}</span>}
              {course?.level && <span><Award aria-hidden="true" />{course.level}</span>}
              {course?.instructor_name && <span>By {course.instructor_name}</span>}
              {lastUpdated && <span>Updated {lastUpdated}</span>}
            </p>
            {description && <p className="co-desc">{description}</p>}
            {resumeChapter && (
              <div className="sd-hero-actions">
                <button className="sd-btn sd-btn--amber" onClick={() => onStart(resumeChapter.id)}>
                  {isComplete ? <Trophy aria-hidden="true" /> : <PlayCircle aria-hidden="true" />}
                  {ctaLabel}
                </button>
              </div>
            )}
          </div>
          <div className="sd-run-card">
            {totalChapters > 0 ? (
              <ProgressRail total={totalChapters} completed={completedChapters} />
            ) : (
              <div className="sd-meter"><i style={{ '--p': `${overallProgressPercent}%` } as React.CSSProperties} /></div>
            )}
            <div className="sd-run-foot">
              <b>{completedChapters} of {totalChapters}<small>modules done</small></b>
              <span>{overallProgressPercent}% complete • {completedContentItems} of {totalContentItems} items</span>
            </div>
          </div>
        </section>

        <div className="mc-tabs co-tabs" role="tablist" aria-label="Course sections">
          {tabs.map(t => (
            <button key={t.id} role="tab" className="mc-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="co-grid mc-swap">
            <div className="sd-ledger" data-cols="3">
              <div><span className="sd-l">Modules</span><b className="sd-n">{completedChapters}/{totalChapters}</b><small>completed</small></div>
              <div><span className="sd-l">Learning items</span><b className="sd-n">{completedContentItems}/{totalContentItems}</b><small>completed</small></div>
              <div><span className="sd-l">Status</span><b className="sd-n" style={{ fontSize: 'clamp(1.5rem, 2.2vw, 2rem)', alignSelf: 'center' }}>{isComplete ? 'Completed' : overallProgressPercent > 0 ? 'In progress' : 'Not started'}</b><small>&nbsp;</small></div>
            </div>

            <section className="sd-panel co-cert" aria-labelledby="co-cert-h">
              <span className="co-cert-ico"><Award aria-hidden="true" /></span>
              <div>
                <b id="co-cert-h">{certEligible ? 'Certificate unlocked' : `You are ${certGap}% away from your certificate`}</b>
                <p>{certEligible ? 'You have finished enough of this course to earn your certificate.' : `Reach ${CERT_THRESHOLD}% to earn your certificate of completion.`}</p>
              </div>
              {certEligible && <Link href="/lms/student/certificates" className="sd-btn sd-btn--ink">View certificate</Link>}
              <div className="co-gate">
                <div className="co-gate-tick" style={{ '--t': `${CERT_THRESHOLD}%` } as React.CSSProperties} />
                <div className="sd-meter" style={{ marginTop: '0.45rem' }}><i style={{ '--p': `${Math.min(100, overallProgressPercent)}%` } as React.CSSProperties} /></div>
                <p className="co-gate-cap"><span>{overallProgressPercent}% complete</span><span>Certificate at {CERT_THRESHOLD}%</span></p>
              </div>
            </section>

            {outcomes.length > 0 && (
              <section className="sd-panel">
                <div className="sd-panel-head"><h2>What you will learn</h2></div>
                <ul className="co-outcomes">
                  {outcomes.map((o, i) => (
                    <li key={i}><i><Check aria-hidden="true" /></i><span>{o}</span></li>
                  ))}
                </ul>
              </section>
            )}

            {description && (
              <section className="sd-panel">
                <div className="sd-panel-head"><h2>About this course</h2></div>
                <p className="co-prose">{description}</p>
              </section>
            )}

            {course?.instructor_name && (
              <section className="sd-panel">
                <div className="sd-panel-head"><h2>Instructor</h2></div>
                <div className="co-person">
                  <span className="sd-avatar" aria-hidden="true">{course.instructor_name.charAt(0).toUpperCase()}</span>
                  <b>{course.instructor_name}</b>
                </div>
              </section>
            )}
          </div>
        )}

        {tab === 'curriculum' && (
          <div className="co-mods mc-swap">
            {chapters.map((chapter, idx) => (
              <CurriculumModule key={chapter.id} courseId={courseId} chapter={chapter} index={idx} onStart={onStart} />
            ))}
            {chapters.length === 0 && (
              <section className="sd-panel">
                <div className="sd-empty"><b>No modules yet</b><p>Your teacher has not added content to this course.</p></div>
              </section>
            )}
          </div>
        )}

        {tab === 'notes' && (
          <div className="mc-swap"><NoteTakingPanel courseId={courseId} chapterId="__course__" contentId="__course_notes__" isOpen /></div>
        )}

        {tab === 'resources' && (
          <div className="mc-swap">
            {loadingResources ? (
              <div className="sd-skel" />
            ) : (
              <ResourcesPanel courseId={courseId} materials={materials ?? []} isOpen />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Curriculum module (loads its lessons on expand) ──────────────────────────
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
  const days = chapter.unlocks_in_days ?? 0
  const state = done ? 'done' : completed > 0 ? 'start' : 'todo'

  return (
    <div className="co-mod" data-state={state} data-open={open && !locked} data-locked={locked}>
      <button className="co-mod-btn" disabled={locked} aria-expanded={open && !locked} onClick={() => setOpen(o => !o)}>
        <span className="cs-num" aria-hidden="true">{locked ? <Lock /> : done ? <Check /> : moduleNum}</span>
        <span className="co-mod-text">
          <b>{chapter.name || chapter.title || `Chapter ${moduleNum}`}</b>
          {total > 0 && (
            <span className="co-mod-meter">
              <span className="sd-meter"><i style={{ '--p': `${(completed / total) * 100}%` } as React.CSSProperties} /></span>
              {completed} of {total} items
            </span>
          )}
        </span>
        {locked ? (
          <span className={`co-lock ${chapter.lock_reason === 'time' ? 'cs-warn' : ''}`}>
            {chapter.lock_reason === 'time'
              ? `Unlocks in ${days} day${days === 1 ? '' : 's'}`
              : chapter.lock_reason === 'sequential'
              ? 'Finish the previous module'
              : 'Locked'}
          </span>
        ) : (
          <ChevronDown className="cs-chev" aria-hidden="true" />
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

  if (isLoading) return <div className="co-lessons"><p className="cs-note">Loading lessons</p></div>
  if (contents.length === 0) return <div className="co-lessons"><p className="cs-note">No items in this module yet.</p></div>

  return (
    <div className="co-lessons">
      {contents.map((c, idx) => {
        const Icon = contentIcon(c.content_type)
        const gate = gating[idx]
        const completed = gate?.completed ?? (c.is_completed || isContentCompleted(c.id))
        const locked = gate ? !gate.unlocked : false
        const dur = formatDuration(c.duration_minutes)
        return (
          <button key={c.id} className="co-lesson" data-done={!!completed} disabled={locked} onClick={() => !locked && onStart(chapterId, c.id)}>
            <span className="cs-dot" aria-hidden="true">{completed ? <Check /> : locked ? <Lock /> : null}</span>
            <Icon aria-hidden="true" />
            <span>{c.title}</span>
            {dur && <small>{dur}</small>}
          </button>
        )
      })}
    </div>
  )
}
