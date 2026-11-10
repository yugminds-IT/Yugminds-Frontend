'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, TriangleAlert } from 'lucide-react'
import Modal from '../../portal/Modal'
import { initialsOf } from '../../portal/notifications'
import type { Course, CourseStudentsData, StudentProgress } from './types'

type Filter = 'all' | 'progress' | 'done'

/** Every student in a course, most advanced first, with their chapter-by-chapter progress. */
export default function CourseStudentsModal({
  course,
  data,
  onClose,
}: {
  course: Course | null
  /** null while loading */
  data: CourseStudentsData | null
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<string | null>(null)

  const students = useMemo(() => [...(data?.students ?? [])].sort((a, b) => (b.overall_progress || 0) - (a.overall_progress || 0)), [data])
  const done = students.filter((s) => s.completed).length
  const avg = students.length ? Math.round(students.reduce((n, s) => n + (s.overall_progress || 0), 0) / students.length) : 0
  const shown = students.filter((s) => {
    const hay = `${s.full_name ?? ''} ${s.email ?? ''}`.toLowerCase()
    return hay.includes(q.trim().toLowerCase()) && (filter === 'all' || (filter === 'done' ? s.completed : !s.completed))
  })

  return (
    <Modal
      open={!!course}
      onClose={onClose}
      wide
      title={course ? `Students in ${course.course_name}` : 'Students'}
      subtitle="Most advanced first. Open a student to see each chapter."
      footer={<button className="sd-btn sd-btn--line" onClick={onClose}>Close</button>}
    >
      {!data ? (
        <><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></>
      ) : data.error ? (
        <div className="sd-empty"><TriangleAlert aria-hidden="true" style={{ width: '1.5rem', height: '1.5rem' }} /><b>The students did not load</b><p>{data.error}</p></div>
      ) : students.length === 0 ? (
        <div className="sd-empty"><b>No students yet</b><p>Students show up here once they are in a class this course is open to.</p></div>
      ) : (
        <>
          <div className="sm-stats">
            <div><b>{students.length}</b><span>{students.length === 1 ? 'student' : 'students'}</span></div>
            <div><b>{done}</b><span>finished</span></div>
            <div><b>{avg}%</b><span>average progress</span></div>
          </div>
          <div className="cr-sbar">
            <input type="search" className="sd-field" placeholder="Search by name or email" aria-label="Search students" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="as-chips" role="group" aria-label="Show">
              {([['all', 'Everyone'], ['progress', 'In progress'], ['done', 'Finished']] as const).map(([id, label]) => (
                <button key={id} type="button" className="as-chip" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
              ))}
            </div>
          </div>
          {shown.length === 0 ? (
            <div className="sd-empty"><b>No one matches</b><p>Try a different name, or show everyone.</p></div>
          ) : (
            <div className="cr-slist">
              {shown.map((s: StudentProgress, i) => {
                const key = String(s.id ?? i)
                const isOpen = open === key
                const pct = Math.round(s.overall_progress || 0)
                const chapters = [...(s.chapters ?? [])].sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0))
                return (
                  <article key={key} className="cr-student" data-open={isOpen}>
                    <span className="sd-avatar" aria-hidden="true">{initialsOf(s.full_name || s.email)}</span>
                    <div className="cr-sname"><b>{s.full_name || 'Unnamed student'}</b><small>{s.email || 'No email'}</small></div>
                    <span className="sm-chip cr-class" data-class="true">{[s.grade, s.section].filter(Boolean).join(' ') || 'No class'}</span>
                    <div className="cr-sprog">
                      <b>{pct}%</b>
                      <i className="tm-bar" aria-hidden="true"><u style={{ width: `${pct}%` }} /></i>
                    </div>
                    <span className="sm-chip cr-state" data-tone={s.completed ? 'done' : undefined}>{s.completed ? 'Finished' : 'In progress'}</span>
                    <button className="pl-ico" onClick={() => setOpen(isOpen ? null : key)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'Show'} chapters for ${s.full_name || 'this student'}`}>
                      <ChevronDown style={{ transition: 'rotate 0.2s ease', rotate: isOpen ? '180deg' : '0deg' }} />
                    </button>
                    {isOpen && (
                      <ol className="cr-sch">
                        {chapters.length === 0 ? <li className="sm-muted">No chapter data</li> : chapters.map((ch) => (
                          <li key={ch.id}>
                            <span>{ch.chapter_number ? `${ch.chapter_number}. ` : ''}{ch.title || 'Untitled'}</span>
                            <i className="tm-bar" aria-hidden="true"><u style={{ width: `${Math.round(ch.progress || 0)}%` }} /></i>
                            <b>{Math.round(ch.progress || 0)}%</b>
                          </li>
                        ))}
                      </ol>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
