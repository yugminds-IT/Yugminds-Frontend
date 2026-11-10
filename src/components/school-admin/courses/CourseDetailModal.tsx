'use client'

import { Send, Users } from 'lucide-react'
import Modal from '../../portal/Modal'
import { accessLabels, shortDate, type Course } from './types'

/** Everything about one course: who it is for, how far students are, and its chapters. */
export default function CourseDetailModal({
  course,
  onClose,
  onStudents,
  onRequestUpdate,
}: {
  course: Course | null
  onClose: () => void
  onStudents: () => void
  onRequestUpdate: () => void
}) {
  const c = course
  const p = c?.student_progress
  const labels = c ? accessLabels(c) : []
  return (
    <Modal
      open={!!c}
      onClose={onClose}
      wide
      title={c?.course_name || 'Course'}
      subtitle={c ? `${c.status} · ${c.num_chapters} ${c.num_chapters === 1 ? 'chapter' : 'chapters'}` : undefined}
      footer={
        c && (
          <>
            <button className="sd-btn sd-btn--line" onClick={onClose}>Close</button>
            <button className="sd-btn sd-btn--line" onClick={onStudents}><Users aria-hidden="true" />See students</button>
            <button className="sd-btn sd-btn--amber" onClick={onRequestUpdate}><Send aria-hidden="true" />Request an update</button>
          </>
        )
      }
    >
      {c && p && (
        <div className="sm-detail">
          {c.description && <p>{c.description}</p>}
          <section aria-label="Who it is for">
            <h3>Open to</h3>
            {labels.length ? <div className="tm-chips">{labels.map((l) => <span key={l} className="sm-chip" data-class="true">{l}</span>)}</div> : <p className="sm-muted">Not assigned to any class yet.</p>}
          </section>
          <section aria-label="Student progress">
            <h3>How students are doing</h3>
            <div className="sm-stats">
              <div><b>{p.total_students}</b><span>{p.total_students === 1 ? 'student' : 'students'}</span></div>
              <div><b>{p.completed_students}</b><span>finished</span></div>
              <div><b>{p.average_progress}%</b><span>average progress</span></div>
            </div>
            <i className="tm-bar cr-bar" role="progressbar" aria-valuenow={p.average_progress} aria-valuemin={0} aria-valuemax={100} aria-label="Average progress"><u style={{ width: `${p.average_progress}%` }} /></i>
          </section>
          <section aria-label="Chapters">
            <h3>Chapters</h3>
            {c.chapters.length === 0 ? (
              <p className="sm-muted">No chapters have been added yet.</p>
            ) : (
              <ol className="cr-chapters">
                {c.chapters.map((ch, i) => (
                  <li key={ch.id || i}>
                    <div className="cr-ch-head">
                      <b>{ch.title}</b>
                      <span className="sm-chip" data-on={ch.is_published}>{ch.is_published ? 'Published' : 'Draft'}</span>
                    </div>
                    {ch.content_description && <p>{ch.content_description}</p>}
                    {ch.learning_outcomes.length > 0 && (
                      <ul aria-label="Learning outcomes">{ch.learning_outcomes.map((o, k) => <li key={k}>{o}</li>)}</ul>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
          <p className="as-fine" style={{ margin: 0 }}>Added {shortDate(c.created_at)}{c.updated_at ? `. Last changed ${shortDate(c.updated_at)}.` : '.'}</p>
        </div>
      )}
    </Modal>
  )
}
