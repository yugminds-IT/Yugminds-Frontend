'use client'

import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Schedule } from './types'
import { DAYS_OF_WEEK, formatTime, gradeSectionLabel, subjectHue } from './utils'

/** Every class, grouped by day and in time order. */
export default function ScheduleList({
  schedules,
  year,
  onEdit,
  onDelete,
  onAdd,
}: {
  schedules: Schedule[]
  year: string
  onEdit: (s: Schedule) => void
  onDelete: (id: string) => void
  onAdd: () => void
}) {
  if (schedules.length === 0) {
    return (
      <section className="sd-panel">
        <div className="sd-empty">
          <b>No classes found</b>
          <p>Add a class from the week grid, or use the button below.</p>
          <button className="sd-btn sd-btn--amber" onClick={onAdd}><Plus aria-hidden="true" />Add class</button>
        </div>
      </section>
    )
  }
  const sorted = [...schedules].sort((a, b) => {
    const d = DAYS_OF_WEEK.indexOf(a.day_of_week) - DAYS_OF_WEEK.indexOf(b.day_of_week)
    return d !== 0 ? d : a.start_time.localeCompare(b.start_time)
  })
  const groups = DAYS_OF_WEEK.map((day) => ({ day, items: sorted.filter((s) => s.day_of_week === day) })).filter((g) => g.items.length > 0)
  return (
    <section className="sd-panel as-list mc-swap" aria-label={`All classes for ${year}`}>
      {groups.map((g) => (
        <div key={g.day}>
          <p className="as-group">{g.day}<span>{g.items.length}</span></p>
          {g.items.map((s) => (
            <article key={s.id} className="ts-row" data-h={subjectHue(s.subject)}>
              <span className="ts-time">{formatTime(s.start_time)}<small>to {formatTime(s.end_time)}</small></span>
              <span className="ts-subject"><i aria-hidden="true" /><b>{s.subject}</b></span>
              <span className="sm-chip" data-class="true">{gradeSectionLabel(s)}</span>
              <span className="ts-who">{s.teacher?.full_name || <span className="sm-warn">Needs a teacher</span>}</span>
              <span className="ts-where">{s.room?.room_number || <span className="sm-muted">No room</span>}</span>
              <span className="sm-acts">
                <button className="pl-ico" onClick={() => onEdit(s)} aria-label={`Edit ${s.subject}, ${gradeSectionLabel(s)} on ${s.day_of_week}`} title="Edit"><Pencil /></button>
                <button className="pl-ico nt-del" onClick={() => onDelete(s.id)} aria-label={`Delete ${s.subject}, ${gradeSectionLabel(s)} on ${s.day_of_week}`} title="Delete"><Trash2 /></button>
              </span>
            </article>
          ))}
        </div>
      ))}
    </section>
  )
}
