'use client'

import { ClipboardCopy, Copy, Lock, Pencil, Plus, Repeat, Trash2, Clock } from 'lucide-react'
import RowMenu from '../../portal/RowMenu'
import type { Period, Schedule } from './types'
import { DAY_NAME_TO_NUMBER, GRID_DAYS, formatTime, gradeSectionLabel, subjectHue } from './utils'

/** The weekly timetable: periods down the side, days across. Pick a day to see only that one. */
export default function ScheduleGrid({
  periods,
  schedules,
  operatingDays,
  focus,
  busy,
  onAdd,
  locked,
  onEdit,
  onCopyClass,
  onRepeat,
  onDelete,
  onCopyDay,
  onSetupPeriods,
}: {
  periods: Period[]
  /** already filtered by grade, section and search */
  schedules: Schedule[]
  operatingDays: number[]
  focus: string
  busy: boolean
  onAdd: (day: string, periodId: string) => void
  /** A reason when no teacher can take this day+period (the cell is locked), else null. */
  locked: (day: string, periodId: string) => string | null
  onEdit: (s: Schedule) => void
  onCopyClass: (s: Schedule) => void
  onRepeat: (s: Schedule) => void
  onDelete: (id: string) => void
  onCopyDay: (day: string) => void
  onSetupPeriods: () => void
}) {
  const sorted = [...periods].sort((a, b) => a.period_number - b.period_number)
  const days = focus === 'all' ? GRID_DAYS : GRID_DAYS.filter((d) => d === focus)
  const isOpen = (d: string) => operatingDays.includes(DAY_NAME_TO_NUMBER[d])

  if (sorted.length === 0) {
    return (
      <section className="sd-panel">
        <div className="sd-empty">
          <b>No periods yet</b>
          <p>Periods are the time slots of your school day. Add them to start building the timetable.</p>
          <button className="sd-btn sd-btn--amber" onClick={onSetupPeriods}><Clock aria-hidden="true" />Set up periods</button>
        </div>
      </section>
    )
  }

  return (
    <section className="sd-panel ts-gridwrap" aria-label="Weekly timetable">
      <div className="ts-scroll">
        <table data-no-stack className="ts-grid" style={{ '--cols': days.length } as React.CSSProperties}>
          <thead>
            <tr>
              <th scope="col" className="ts-corner">Period</th>
              {days.map((day) => {
                const open = isOpen(day)
                const count = schedules.filter((s) => s.day_of_week === day).length
                return (
                  <th key={day} scope="col" data-closed={!open}>
                    <span className="ts-dayname">{day}</span>
                    {!open ? (
                      <small>Closed</small>
                    ) : (
                      <small>
                        {count} {count === 1 ? 'class' : 'classes'}
                        {count > 0 && (
                          <button type="button" className="ts-copyday" onClick={() => onCopyDay(day)} disabled={busy} title="Copy every class on this day to other days">
                            <ClipboardCopy aria-hidden="true" />Copy day
                          </button>
                        )}
                      </small>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((period) => (
              <tr key={period.id}>
                <th scope="row" className="ts-period">
                  <b>P{period.period_number}</b>
                  <small>{formatTime(period.start_time)} – {formatTime(period.end_time)}</small>
                </th>
                {days.map((day) => {
                  const open = isOpen(day)
                  const cell = schedules.filter((s) => s.day_of_week === day && s.period_id === period.id)
                  const lockedWhy = open ? locked(day, period.id) : null
                  return (
                    <td key={day} data-closed={!open}>
                      {!open ? (
                        <span className="ts-closed" aria-label="Closed">–</span>
                      ) : (
                        <div className="ts-cell">
                          {cell.map((s) => (
                            <div key={s.id} className="ts-card" data-h={subjectHue(s.subject)} data-flag={!!lockedWhy} title={lockedWhy ? `Outside the teacher's hours — ${lockedWhy}. Move or delete it.` : undefined}>
                              <button type="button" className="ts-card-main" onClick={() => onEdit(s)} aria-label={`Edit ${s.subject || 'class'}, ${gradeSectionLabel(s)}`}>
                                <b>{s.subject || 'Class'}</b>
                                <span>{gradeSectionLabel(s)}</span>
                                {s.teacher?.full_name ? (
                                  <small>{s.teacher.full_name}{s.room?.room_number ? ` · ${s.room.room_number}` : ''}</small>
                                ) : (
                                  <small className="ts-nobody">Needs a teacher</small>
                                )}
                              </button>
                              <span className="ts-card-menu" onClick={(e) => e.stopPropagation()}>
                                <RowMenu
                                  label={`More actions for ${s.subject || 'class'}`}
                                  items={[
                                    { label: 'Copy to another day', icon: Copy, onClick: () => onCopyClass(s) },
                                    { label: 'Repeat across the week', icon: Repeat, onClick: () => onRepeat(s) },
                                    { label: 'Edit', icon: Pencil, onClick: () => onEdit(s) },
                                    { label: 'Delete', icon: Trash2, danger: true, separatorBefore: true, onClick: () => onDelete(s.id) },
                                  ]}
                                />
                              </span>
                            </div>
                          ))}
                          {lockedWhy ? (
                            <span className="ts-locked" data-empty={cell.length === 0} title={lockedWhy} role="note" aria-label={`Locked, no teacher available on ${day}, period ${period.period_number}: ${lockedWhy}`}>
                              <Lock aria-hidden="true" />
                              {cell.length === 0 && <><span>Locked</span><small>{lockedWhy}</small></>}
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="ts-add"
                              data-empty={cell.length === 0}
                              onClick={() => onAdd(day, period.id)}
                              aria-label={`Add a class on ${day}, period ${period.period_number}`}
                            >
                              <Plus aria-hidden="true" />
                              {cell.length === 0 && <span>Add</span>}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
