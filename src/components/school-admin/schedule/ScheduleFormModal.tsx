'use client'

import { Check, TriangleAlert } from 'lucide-react'
import Modal from '../../portal/Modal'
import { ChipGroup } from '../../portal/notifications'
import type { Period, Room, ScheduleForm, Teacher } from './types'
import { DAYS_OF_WEEK, DAY_NAME_TO_NUMBER, formatTime } from './utils'

/** Add a class, or edit one. Day and period are fixed when you started from a grid cell. */
export default function ScheduleFormModal({
  open,
  editing,
  form,
  onChange,
  locked,
  operatingDays,
  periods,
  rooms,
  grades,
  sections,
  subjects,
  teachers,
  teacherCount,
  matchCount,
  isMatch,
  loadOf,
  roomFree,
  suggested,
  conflict,
  onClose,
  onSubmit,
}: {
  open: boolean
  editing: boolean
  form: ScheduleForm
  onChange: (next: ScheduleForm) => void
  locked: { day_of_week?: boolean; period_id?: boolean }
  operatingDays: number[]
  periods: Period[]
  rooms: Room[]
  grades: string[]
  sections: string[]
  subjects: string[]
  /** teachers to offer in the list */
  teachers: Teacher[]
  teacherCount: number
  /** teachers that match this grade and section */
  matchCount: number
  isMatch: (t: Teacher) => boolean
  loadOf: (teacherId: string) => number
  roomFree: (roomId: string) => boolean
  suggested: Teacher | null
  conflict: string | null
  onClose: () => void
  onSubmit: () => void
}) {
  const set = (patch: Partial<ScheduleForm>) => onChange({ ...form, ...patch })
  const sortedPeriods = [...periods].sort((a, b) => a.period_number - b.period_number)
  const period = periods.find((p) => p.id === form.period_id)
  const days = DAYS_OF_WEEK.filter((d) => operatingDays.includes(DAY_NAME_TO_NUMBER[d]))
  const dayClosed = !operatingDays.includes(DAY_NAME_TO_NUMBER[form.day_of_week])
  const lastPeriod = sortedPeriods[sortedPeriods.length - 1]
  const keepsGoing = !editing && !!form.period_id && period?.id !== lastPeriod?.id

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={editing ? 'Edit class' : 'Add a class'}
      subtitle={editing ? 'Change the details and save.' : 'Pick when it runs, what it is, and who teaches it.'}
      footer={
        <>
          {keepsGoing && <span className="sd-modal-note">After you add it, the next period is selected so you can keep going.</span>}
          <button className="sd-btn sd-btn--line" onClick={onClose}>Cancel</button>
          <button className="sd-btn sd-btn--amber" onClick={onSubmit} disabled={!!conflict}>
            <Check aria-hidden="true" />{editing ? 'Save changes' : 'Add class'}
          </button>
        </>
      }
    >
      <form className="sm-form" onSubmit={(e) => { e.preventDefault(); if (!conflict) onSubmit() }}>
        <fieldset className="sm-group">
          <legend>When</legend>
          {locked.day_of_week && locked.period_id ? (
            <p className="nt-summary">
              <b>{form.day_of_week}</b>, {period ? `period ${period.period_number} (${formatTime(period.start_time)} – ${formatTime(period.end_time)})` : ''}
            </p>
          ) : (
            <>
              <div className="sd-field-wrap">
                <label>Day</label>
                {locked.day_of_week ? <p className="nt-summary"><b>{form.day_of_week}</b></p> : (
                  <ChipGroup label="Day" value={form.day_of_week} options={days.map((d) => [d, d] as const)} onChange={(d) => set({ day_of_week: d })} />
                )}
                {dayClosed && <p className="sm-warn">Your school is closed on {form.day_of_week}s.</p>}
              </div>
              <div className="sd-field-wrap">
                <label>Period</label>
                {locked.period_id ? <p className="nt-summary"><b>{period ? `Period ${period.period_number}` : ''}</b></p> : sortedPeriods.length === 0 ? (
                  <p className="as-fine" style={{ margin: 0 }}>No periods yet. Add them from the Periods button first.</p>
                ) : (
                  <ChipGroup
                    label="Period"
                    value={form.period_id}
                    options={sortedPeriods.map((p) => [p.id, `P${p.period_number} · ${formatTime(p.start_time)}`] as const)}
                    onChange={(id) => {
                      const p = periods.find((x) => x.id === id)
                      set({ period_id: id, start_time: p?.start_time ?? '', end_time: p?.end_time ?? '' })
                    }}
                  />
                )}
              </div>
            </>
          )}
        </fieldset>

        <fieldset className="sm-group">
          <legend>What</legend>
          <div className="sd-field-wrap">
            <label htmlFor="sc-subject">Subject</label>
            <input id="sc-subject" className="sd-field" list="sc-subjects" autoComplete="off" placeholder="For example, Robotics" value={form.subject} onChange={(e) => set({ subject: e.target.value })} />
            <datalist id="sc-subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <div className="sd-field-wrap">
            <label>Grade</label>
            <ChipGroup label="Grade" value={form.grade} options={grades.map((g) => [g, g] as const)} onChange={(g) => set({ grade: g, section: '', class_id: '' })} />
          </div>
          {form.grade && sections.length > 0 && (
            <div className="sd-field-wrap">
              <label>Section</label>
              <ChipGroup label="Section" value={form.section} options={sections.map((s) => [s, s] as const)} onChange={(s) => set({ section: s })} />
            </div>
          )}
        </fieldset>

        <fieldset className="sm-group">
          <legend>Who and where</legend>
          <div className="sm-two">
            <div className="sd-field-wrap">
              <label htmlFor="sc-teacher">Teacher</label>
              <select id="sc-teacher" className="sd-field" value={form.teacher_id} onChange={(e) => set({ teacher_id: e.target.value })}>
                <option value="">Choose a teacher</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} · {loadOf(t.id).toFixed(1)}h a week{form.grade && !isMatch(t) ? ' · not assigned to this class' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="sd-field-wrap">
              <label htmlFor="sc-room">Room <small className="sm-opt">optional</small></label>
              <select id="sc-room" className="sd-field" value={form.room_id} onChange={(e) => set({ room_id: e.target.value })}>
                <option value="">No room</option>
                {rooms.map((r) => {
                  const free = roomFree(r.id)
                  return (
                    <option key={r.id} value={r.id} disabled={!free}>
                      {r.room_number}{r.room_name ? ` – ${r.room_name}` : ''}{r.capacity ? ` (${r.capacity} seats)` : ''}{free ? '' : ' · taken'}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>
          <p className="as-fine" style={{ margin: 0 }}>
            {teacherCount === 0
              ? 'No teachers found for your school yet. The main admin adds and assigns them.'
              : !form.grade
                ? 'Pick a grade to see which teachers are assigned to it.'
                : matchCount === 0
                ? `No teacher is assigned to this class yet, so all ${teacherCount} are listed.`
                : `${matchCount} ${matchCount === 1 ? 'teacher is' : 'teachers are'} assigned to this class.`}
          </p>
          {suggested && form.teacher_id !== suggested.id && (
            <div className="ts-suggest">
              <span>Least busy and free then: <b>{suggested.full_name}</b></span>
              <button type="button" className="sd-btn sd-btn--line" onClick={() => set({ teacher_id: suggested.id })}>Use {suggested.full_name.split(' ')[0]}</button>
            </div>
          )}
        </fieldset>

        <div className="sd-field-wrap">
          <label htmlFor="sc-notes">Notes <small className="sm-opt">optional</small></label>
          <input id="sc-notes" className="sd-field" placeholder="Anything the teacher should know" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </div>

        {conflict && (
          <div className="ts-conflict" role="alert">
            <TriangleAlert aria-hidden="true" />
            <div><b>This clashes with another class</b><p>{conflict}</p></div>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
