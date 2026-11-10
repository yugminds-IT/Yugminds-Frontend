'use client'

import { ArrowRight, ClipboardCopy, Copy, Loader2 } from 'lucide-react'
import Modal from '../../portal/Modal'
import { ChipGroup } from '../../portal/notifications'
import type { Schedule } from './types'
import { DAYS_OF_WEEK, DAY_NAME_TO_NUMBER, getNextOperatingDay } from './utils'

/** Copy one class to another day, at the same period. */
export function CopyClassModal({
  schedule,
  targetDay,
  setTargetDay,
  operatingDays,
  busy,
  onClose,
  onCopy,
}: {
  schedule: Schedule | null
  targetDay: string
  setTargetDay: (d: string) => void
  operatingDays: number[]
  busy: boolean
  onClose: () => void
  onCopy: () => void
}) {
  const days = DAYS_OF_WEEK.filter((d) => d !== schedule?.day_of_week && operatingDays.includes(DAY_NAME_TO_NUMBER[d]))
  return (
    <Modal
      open={!!schedule}
      onClose={onClose}
      title="Copy to another day"
      subtitle={schedule ? `${schedule.subject} on ${schedule.day_of_week}` : undefined}
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={onClose}>Cancel</button>
          <button className="sd-btn sd-btn--amber" onClick={onCopy} disabled={!targetDay || busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {targetDay ? `Copy to ${targetDay}` : 'Copy'}
          </button>
        </>
      }
    >
      <div className="sd-field-wrap">
        <label>Which day?</label>
        <ChipGroup label="Target day" value={targetDay} options={days.map((d) => [d, d] as const)} onChange={setTargetDay} />
      </div>
      <p className="nt-summary">It makes a new class at the same period. If the teacher or room is busy then, it will not copy.</p>
    </Modal>
  )
}

/** Copy every class on one day to one or more other days. Slots that are already taken are skipped. */
export function CopyDayModal({
  source,
  count,
  targets,
  setTargets,
  operatingDays,
  results,
  clearResults,
  busy,
  onClose,
  onCopy,
}: {
  source: string | null
  /** classes on the source day */
  count: number
  targets: string[]
  setTargets: (fn: (prev: string[]) => string[]) => void
  operatingDays: number[]
  results: { success: number; skipped: number; errors: string[] } | null
  clearResults: () => void
  busy: boolean
  onClose: () => void
  onCopy: () => void
}) {
  const days = DAYS_OF_WEEK.filter((d) => d !== source && operatingDays.includes(DAY_NAME_TO_NUMBER[d]))
  const next = source ? getNextOperatingDay(source, operatingDays) : null
  return (
    <Modal
      open={!!source}
      onClose={onClose}
      title={`Copy ${source ?? ''}`}
      subtitle={`${count} ${count === 1 ? 'class' : 'classes'} will be copied to the days you pick.`}
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={onClose}>Cancel</button>
          <button className="sd-btn sd-btn--amber" onClick={onCopy} disabled={targets.length === 0 || busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ClipboardCopy aria-hidden="true" />}
            {results ? 'Copy again' : targets.length === 1 ? `Copy to ${targets[0]}` : `Copy to ${targets.length || 'the'} days`}
          </button>
        </>
      }
    >
      {next && next !== source && (
        <button className="sd-btn sd-btn--line" style={{ justifySelf: 'start' }} onClick={() => setTargets(() => [next])}>
          <ArrowRight aria-hidden="true" />Just {next}
        </button>
      )}
      <div className="sd-field-wrap">
        <label>Copy to</label>
        <div className="as-chips" role="group" aria-label="Days to copy to">
          {days.map((d) => {
            const on = targets.includes(d)
            return <button key={d} type="button" className="as-chip" aria-pressed={on} onClick={() => setTargets((prev) => (on ? prev.filter((x) => x !== d) : [...prev, d]))}>{d}</button>
          })}
        </div>
      </div>
      {results ? (
        <section className="sm-result" aria-live="polite" aria-label="Copy result">
          <div className="sm-stats" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <div><b>{results.success}</b><span>copied</span></div>
            <div data-bad={results.skipped > 0}><b>{results.skipped}</b><span>skipped, already taken</span></div>
          </div>
          {results.errors.length > 0 && (
            <ul className="sm-errs" aria-label="Problems">{results.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          )}
          <button className="sd-btn sd-btn--line" style={{ justifySelf: 'start' }} onClick={clearResults}>Dismiss</button>
        </section>
      ) : (
        <p className="nt-summary">Slots that already have a class are skipped, so nothing is overwritten.</p>
      )}
    </Modal>
  )
}
