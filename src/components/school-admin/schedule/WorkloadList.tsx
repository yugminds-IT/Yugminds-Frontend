'use client'

import { ChevronRight } from 'lucide-react'
import { initialsOf } from '../../portal/notifications'
import type { Teacher } from './types'
import { subjectHue } from './utils'
import { formatWorkingSchedule } from '@/lib/weekday-utils'

export interface WorkloadRow {
  teacher: Teacher
  classes: number
  hours: number
  subjects: string[]
  grades: string[]
}

const OVER = 30
const HIGH = 24

/** How full each teacher's week is. Over 30 hours is "over", over 24 is "high". */
export default function WorkloadList({ rows, year, onOpen }: { rows: WorkloadRow[]; year: string; onOpen: (t: Teacher) => void }) {
  if (rows.length === 0) {
    return (
      <section className="sd-panel">
        <div className="sd-empty">
          <b>No teachers found</b>
          <p>Teachers are added to your school by the main admin. They will show up here with their weekly load.</p>
        </div>
      </section>
    )
  }
  return (
    <section className="sd-panel as-list mc-swap" aria-label={`Teacher workload for ${year}`}>
      <div className="ts-wl-head">
        <span /><span>Teacher</span><span>Subjects and classes</span><span>Classes</span><span>Weekly load</span><span />
      </div>
      {rows.map(({ teacher: t, classes, hours, subjects, grades }) => {
        const level = hours > OVER ? 'over' : hours > HIGH ? 'high' : 'ok'
        return (
          <article key={t.id} className="ts-wl">
            <span className="sd-avatar" aria-hidden="true">{initialsOf(t.full_name)}</span>
            <button className="sm-who" onClick={() => onOpen(t)} aria-label={`See ${t.full_name}'s week`}>
              <b>{t.full_name}</b>
              <small>{t.email}</small>
              {t.teacher_schools?.[0]?.day_slots && Object.keys(t.teacher_schools[0].day_slots).length > 0 && (
                <small title="Half-day hours set by the main admin">
                  {formatWorkingSchedule(t.teacher_schools[0].working_days, t.teacher_schools[0].day_slots)}
                </small>
              )}
            </button>
            <div className="tm-chips">
              {subjects.slice(0, 3).map((s) => <span key={s} className="ts-tag" data-h={subjectHue(s)}>{s}</span>)}
              {grades.slice(0, 3).map((g) => <span key={g} className="sm-chip">{g}</span>)}
              {grades.length > 3 && <span className="sm-chip">+{grades.length - 3}</span>}
              {subjects.length === 0 && grades.length === 0 && <span className="sm-muted">Nothing scheduled yet</span>}
            </div>
            <b className="ts-count">{classes}</b>
            <div className="ts-load" data-level={level}>
              <b>{hours.toFixed(1)}h</b>
              <i className="tm-bar"><u style={{ width: `${Math.min(100, (hours / OVER) * 100)}%` }} /></i>
              <small>{level === 'over' ? 'Over the limit' : level === 'high' ? 'Heavy' : 'Fine'}</small>
            </div>
            <button className="pl-ico" onClick={() => onOpen(t)} aria-label={`Open ${t.full_name}'s week`} title="See their week"><ChevronRight /></button>
          </article>
        )
      })}
    </section>
  )
}
