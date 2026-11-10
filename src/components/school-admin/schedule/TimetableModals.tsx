'use client'

import { Check, CircleCheck, Loader2, Send, TriangleAlert } from 'lucide-react'
import Modal from '../../portal/Modal'
import type { Period, Schedule, Teacher } from './types'
import { GRID_DAYS, gradeSectionLabel, subjectHue } from './utils'

/** Send each teacher their weekly timetable as a notification. */
export function PushModal({
  open,
  teachers,
  schedules,
  selected,
  setSelected,
  lastPushed,
  success,
  unassigned,
  canAutoAssign,
  autoAssigning,
  onAutoAssign,
  preview,
  busy,
  onClose,
  onPush,
}: {
  open: boolean
  /** teachers that have at least one class */
  teachers: Teacher[]
  schedules: Schedule[]
  selected: string[]
  setSelected: (fn: (prev: string[]) => string[]) => void
  lastPushed: string | null
  success: string | null
  /** classes with no teacher */
  unassigned: number
  canAutoAssign: boolean
  autoAssigning: boolean
  onAutoAssign: () => void
  preview: (teacherId: string) => string
  busy: boolean
  onClose: () => void
  onPush: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Send timetables to teachers"
      subtitle="Each teacher gets an in-app notification with their week."
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={onClose}>{success ? 'Close' : 'Cancel'}</button>
          {!success && (
            <button className="sd-btn sd-btn--amber" onClick={onPush} disabled={selected.length === 0 || busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              Send to {selected.length} {selected.length === 1 ? 'teacher' : 'teachers'}
            </button>
          )}
        </>
      }
    >
      {success ? (
        <div className="sd-empty" style={{ justifyItems: 'center', textAlign: 'center', padding: '1.5rem 0' }}>
          <CircleCheck aria-hidden="true" style={{ width: '2.5rem', height: '2.5rem' }} />
          <b>Sent</b>
          <p>{success}</p>
        </div>
      ) : (
        <div className="ts-push">
          <section aria-label="Teachers">
            <div className="ts-push-head">
              <b>Teachers</b>
              <span>
                <button className="sm-reset ts-linkbtn" onClick={() => setSelected(() => teachers.map((t) => t.id))}>All</button>
                <button className="sm-reset ts-linkbtn" onClick={() => setSelected(() => [])}>None</button>
              </span>
            </div>
            {lastPushed && <p className="as-fine" style={{ margin: 0 }}>Last sent {lastPushed}</p>}
            {teachers.length === 0 ? (
              <div className="sd-empty">
                <b>{unassigned > 0 ? `${unassigned} ${unassigned === 1 ? 'class has' : 'classes have'} no teacher` : 'No teachers have classes yet'}</b>
                <p>{unassigned > 0 ? 'Only teachers with a class are notified. Give each class a teacher, or let us match them.' : 'Add classes with a teacher, then send their timetables.'}</p>
                {unassigned > 0 && canAutoAssign && (
                  <button className="sd-btn sd-btn--amber" disabled={autoAssigning} onClick={onAutoAssign}>
                    {autoAssigning && <Loader2 className="animate-spin" aria-hidden="true" />}Match teachers automatically
                  </button>
                )}
              </div>
            ) : (
              <div className="ts-pick">
                {teachers.map((t) => {
                  const on = selected.includes(t.id)
                  const n = schedules.filter((s) => s.teacher_id === t.id && s.is_active).length
                  return (
                    <button key={t.id} type="button" aria-pressed={on} onClick={() => setSelected((prev) => (prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]))}>
                      <span><b>{t.full_name}</b><small>{t.email}</small></span>
                      <span className="sm-chip">{n} {n === 1 ? 'class' : 'classes'}</span>
                      {on && <Check className="nt-check" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            )}
          </section>
          <section aria-label="Preview">
            <b>What they will see</b>
            <pre className="ts-preview-box">
              {selected.length > 0 ? preview(selected[0]) : 'Pick a teacher to preview their message.'}
              {selected.length > 1 ? `\n\n+ ${selected.length - 1} more ${selected.length - 1 === 1 ? 'message' : 'messages'}, one per teacher` : ''}
            </pre>
          </section>
        </div>
      )}
    </Modal>
  )
}

/** The result of checking the whole timetable. */
export function ValidationModal({
  open,
  year,
  results,
  onClose,
}: {
  open: boolean
  year: string
  results: { errors: string[]; warnings: string[]; info: string[] } | null
  onClose: () => void
}) {
  const e = results?.errors ?? []
  const w = results?.warnings ?? []
  const i = results?.info ?? []
  return (
    <Modal open={open} onClose={onClose} wide title="Timetable check" subtitle={`Looked at every class for ${year}.`} footer={<button className="sd-btn sd-btn--amber" onClick={onClose}>Close</button>}>
      <div className="sm-stats" aria-label="Summary">
        <div data-bad={e.length > 0}><b>{e.length}</b><span>{e.length === 1 ? 'problem' : 'problems'}</span></div>
        <div><b>{w.length}</b><span>{w.length === 1 ? 'thing to look at' : 'things to look at'}</span></div>
        <div><b>{i.length}</b><span>{i.length === 1 ? 'note' : 'notes'}</span></div>
      </div>
      {e.length === 0 ? (
        <p className="ts-ok"><CircleCheck aria-hidden="true" />No clashes or rule breaks. Teachers and rooms are never double booked.</p>
      ) : (
        <section aria-label="Problems"><h3 className="ts-h"><TriangleAlert aria-hidden="true" />Fix these</h3><ul className="ts-issues" data-kind="error">{e.map((x, k) => <li key={k}>{x}</li>)}</ul></section>
      )}
      {w.length > 0 && <section aria-label="Things to look at"><h3 className="ts-h">Worth a look</h3><ul className="ts-issues" data-kind="warn">{w.map((x, k) => <li key={k}>{x}</li>)}</ul></section>}
      {i.length > 0 && <section aria-label="Notes"><h3 className="ts-h">Good to know</h3><ul className="ts-issues">{i.map((x, k) => <li key={k}>{x}</li>)}</ul></section>}
    </Modal>
  )
}

/** One teacher's whole week, period by period. */
export function TeacherWeekModal({
  teacher,
  periods,
  schedules,
  year,
  onClose,
}: {
  teacher: Teacher | null
  periods: Period[]
  schedules: Schedule[]
  year: string
  onClose: () => void
}) {
  const sorted = [...periods].sort((a, b) => a.period_number - b.period_number)
  return (
    <Modal open={!!teacher} onClose={onClose} wide title={teacher?.full_name ?? 'Teacher'} subtitle={`Their week, ${year}`} footer={<button className="sd-btn sd-btn--line" onClick={onClose}>Close</button>}>
      {teacher && (
        <div className="ts-week" style={{ '--cols': GRID_DAYS.length } as React.CSSProperties}>
          {GRID_DAYS.map((day) => (
            <div key={day} className="ts-week-day">
              <b>{day.slice(0, 3)}</b>
              {sorted.map((p) => {
                const s = schedules.find((x) => x.teacher_id === teacher.id && x.day_of_week === day && x.period_id === p.id && x.is_active && (!x.academic_year || x.academic_year === year))
                return s ? (
                  <div key={p.id} className="ts-wcard" data-h={subjectHue(s.subject)}>
                    <b>{s.subject}</b><span>{gradeSectionLabel(s)}</span><small>P{p.period_number}</small>
                  </div>
                ) : (
                  <div key={p.id} className="ts-wfree" aria-label={`Free, period ${p.period_number}`} />
                )
              })}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
