'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useStudentAssignments } from '@/hooks/useStudentData'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import AssignmentRow, { type AssignmentRowData, type RowState } from '@/components/student/assignments/AssignmentRow'

type AssignmentRowRaw = {
  id: string
  title?: string
  description?: string
  course_id?: string
  course_title?: string
  status?: string
  is_locked?: boolean
  unlocks_in_days?: number | null
  retake_available?: boolean
  retake_granted?: boolean
  due_date?: string
  days_until_due?: number | null
  is_overdue?: boolean
  max_marks?: number
  submission?: { grade?: number | null; submitted_at?: string } | null
}

function rowFor(a: AssignmentRowRaw): AssignmentRowData {
  const graded = a.status === 'graded' || (a.submission?.grade !== null && a.submission?.grade !== undefined)
  const state: RowState = graded ? 'graded' : a.status === 'submitted' ? 'submitted' : a.is_overdue && !a.submission ? 'late' : 'todo'
  const submitted = a.status === 'submitted' || a.status === 'graded'
  return {
    id: a.id,
    title: a.title ?? 'Assignment',
    sub: a.description || undefined,
    href: submitted && !a.retake_available ? `/lms/student/assignments/${a.id}/view` : `/lms/student/assignments/${a.id}`,
    state,
    dueDate: a.due_date || undefined,
    daysUntilDue: a.days_until_due,
    handedIn: submitted || !!a.submission,
    marks: a.max_marks,
    score: a.submission?.grade ?? null,
    locked: a.is_locked,
    unlocksInDays: a.unlocks_in_days,
    retake: a.retake_available ? (a.retake_granted ? 'granted' : 'available') : null,
  }
}

export default function AssignmentHierarchyPage() {
  const { data: assignmentsData = [], isLoading, error } = useStudentAssignments()

  const grouped = useMemo(() => {
    const rows = (Array.isArray(assignmentsData) ? (assignmentsData as AssignmentRowRaw[]) : []) ?? []
    const byCourse = new Map<string, { course_title: string; items: AssignmentRowRaw[] }>()
    for (const a of rows) {
      const courseId = a.course_id ?? 'unknown'
      const courseTitle = a.course_title ?? 'Course'
      if (!byCourse.has(courseId)) byCourse.set(courseId, { course_title: courseTitle, items: [] })
      byCourse.get(courseId)!.items.push(a)
    }
    // sort assignments by status priority then title
    const priority = (s?: string) =>
      s === 'graded' ? 3 : s === 'submitted' ? 2 : s === 'in_progress' ? 1 : 0
    const courses = Array.from(byCourse.entries()).map(([course_id, v]) => ({
      course_id,
      course_title: v.course_title,
      items: v.items
        .slice()
        .sort((a, b) => priority(b.status) - priority(a.status) || (a.title ?? '').localeCompare(b.title ?? '')),
    }))
    courses.sort((a, b) => a.course_title.localeCompare(b.course_title))
    return courses
  }, [assignmentsData])

  if (isLoading) {
    return (
      <div className="sd-page" aria-busy="true">
        <div className="sd-skel" style={{ height: '3rem', width: '16rem' }} />
        <div className="sd-skel" style={{ height: '10rem' }} />
        <div className="sd-skel" style={{ height: '10rem' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="sd-page">
        <section className="sd-panel" role="alert">
          <div className="sd-empty">
            <AlertCircle aria-hidden="true" size={28} color="var(--sd-late)" />
            <b>Your assignments did not load</b>
            <p>{error instanceof Error ? error.message : 'Something went wrong while loading them.'}</p>
            <button className="sd-btn sd-btn--ink" onClick={() => window.location.reload()}>Try again</button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="sd-page">
      <div className="mc-head">
        <div>
          <h1>By course</h1>
          <p>{grouped.length === 0 ? 'No assignments yet' : `${grouped.length} course${grouped.length === 1 ? '' : 's'}, with every assignment inside`}</p>
        </div>
        <Link href="/lms/student/assignments" className="sd-btn sd-btn--line">
          <ArrowLeft aria-hidden="true" />All assignments
        </Link>
      </div>

      {grouped.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>No assignments yet</b>
            <p>When your teacher sets homework for a course it will show up here.</p>
          </div>
        </section>
      ) : (
        grouped.map((c) => {
          const done = c.items.filter((a) => a.status === 'graded' || a.status === 'submitted').length
          const n = Math.min(Math.max(c.items.length, 6), 12)
          const on = Math.round((done / c.items.length) * n)
          return (
            <section key={c.course_id} className="sd-panel as-list" aria-labelledby={`c-${c.course_id}`}>
              <div className="as-course-head">
                <h2 id={`c-${c.course_id}`}>{c.course_title}</h2>
                <div className="sd-seg" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={c.items.length} aria-label="Assignments handed in">
                  {Array.from({ length: n }, (_, i) => <i key={i} data-on={i < on} style={{ '--k': i } as React.CSSProperties} />)}
                </div>
                <p><span><b>{done}</b> of {c.items.length} handed in</span></p>
              </div>
              {c.items.map((a) => <AssignmentRow key={a.id} a={rowFor(a)} />)}
            </section>
          )
        })
      )}
    </div>
  )
}
