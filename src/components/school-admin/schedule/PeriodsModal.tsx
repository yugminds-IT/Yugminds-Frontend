'use client'

import { useState } from 'react'
import { Coffee, Pencil, Plus, Trash2 } from 'lucide-react'
import Modal from '../../portal/Modal'
import type { Period, PeriodForm } from './types'
import { breakLabelForGap, formatTime, type DayPreviewItem, type TemplateBreak, type TemplateBreakType } from './utils'

const QUICK_BREAKS = [10, 15, 30, 40]

export interface PeriodsModalProps {
  open: boolean
  periods: Period[]
  form: PeriodForm
  setForm: (f: PeriodForm) => void
  editing: Period | null
  error: string | null
  onClose: () => void
  onTemplate: (t: 'standard' | 'extended' | 'halfday') => void
  showCustom: boolean
  setShowCustom: (v: boolean) => void
  customStart: string
  setCustomStart: (v: string) => void
  customCount: number
  setCustomCount: (v: number) => void
  customDuration: number
  setCustomDuration: (v: number) => void
  customBreaks: TemplateBreak[]
  setCustomBreaks: (fn: (prev: TemplateBreak[]) => TemplateBreak[]) => void
  addCustomBreak: (type: TemplateBreakType) => void
  preview: DayPreviewItem[]
  onApplyCustom: () => void
  onInsertBreak: (periodId: string, minutes: number) => void
  onEdit: (p: Period) => void
  onDelete: (id: string) => void
  onCreate: () => void
  onUpdate: () => void
  onResetForm: () => void
}

/** The school day: pick a template or build the periods by hand, with breaks between them. */
export default function PeriodsModal(p: PeriodsModalProps) {
  const [breakFor, setBreakFor] = useState<string | null>(null)
  const [custom, setCustom] = useState('')
  const sorted = [...p.periods].sort((a, b) => a.period_number - b.period_number)
  const chained = p.periods.length > 0 && !p.editing

  const insert = (id: string, min: number) => {
    if (!min || min <= 0) return
    p.onInsertBreak(id, min)
    setBreakFor(null)
    setCustom('')
  }

  return (
    <Modal
      open={p.open}
      onClose={p.onClose}
      wide
      title="Periods and breaks"
      subtitle="The time slots of your school day. Classes are placed into these."
      footer={<button className="sd-btn sd-btn--amber" onClick={p.onClose}>Done</button>}
    >
      <div className="sm-form">
        <section className="sm-group" aria-label="Quick start">
          <h3 className="ts-h">Quick start</h3>
          <p className="as-fine" style={{ margin: 0 }}>A template replaces all your current periods.</p>
          <div className="as-chips">
            <button className="as-chip" onClick={() => p.onTemplate('standard')}>8 periods of 45 min</button>
            <button className="as-chip" onClick={() => p.onTemplate('extended')}>6 periods of 60 min</button>
            <button className="as-chip" onClick={() => p.onTemplate('halfday')}>5 periods of 40 min</button>
            <button className="as-chip" aria-pressed={p.showCustom} onClick={() => p.setShowCustom(!p.showCustom)}>Build my own</button>
          </div>
        </section>

        {p.showCustom && (
          <section className="ts-custom" aria-label="Build your own day">
            <div className="sm-two" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              <div className="sd-field-wrap">
                <label htmlFor="pc-start">Day starts</label>
                <input id="pc-start" type="time" className="sd-field" value={p.customStart} onChange={(e) => p.setCustomStart(e.target.value)} />
              </div>
              <div className="sd-field-wrap">
                <label htmlFor="pc-count">Periods</label>
                <input id="pc-count" type="number" min={1} max={12} className="sd-field" value={p.customCount} onChange={(e) => p.setCustomCount(Math.min(12, Math.max(1, parseInt(e.target.value, 10) || 1)))} />
              </div>
              <div className="sd-field-wrap">
                <label htmlFor="pc-dur">Minutes each</label>
                <input id="pc-dur" type="number" min={20} max={90} className="sd-field" value={p.customDuration} onChange={(e) => p.setCustomDuration(Math.min(90, Math.max(20, parseInt(e.target.value, 10) || 20)))} />
              </div>
            </div>

            <div className="ts-breaks">
              <div className="ts-breaks-head">
                <b>Breaks</b>
                <div className="as-chips">
                  <button className="as-chip" disabled={p.customCount < 2} onClick={() => p.addCustomBreak('short')}><Plus aria-hidden="true" />Short break</button>
                  <button className="as-chip" disabled={p.customCount < 2} onClick={() => p.addCustomBreak('lunch')}><Plus aria-hidden="true" />Lunch</button>
                </div>
              </div>
              {p.customBreaks.length === 0 ? (
                <p className="as-fine" style={{ margin: 0 }}>Optional. Breaks become gaps between periods, not columns in the timetable.</p>
              ) : p.customBreaks.map((b) => (
                <div key={b.id} className="ts-break">
                  <label>
                    <span>Type</span>
                    <select className="sd-field" value={b.type} onChange={(e) => {
                      const v = e.target.value as TemplateBreakType
                      p.setCustomBreaks((prev) => prev.map((x) => x.id === b.id ? { ...x, type: v, durationMin: v === 'lunch' && x.durationMin < 25 ? 30 : v === 'short' && x.durationMin >= 25 ? 10 : x.durationMin } : x))
                    }}>
                      <option value="short">Short break</option>
                      <option value="lunch">Lunch</option>
                    </select>
                  </label>
                  <label>
                    <span>After period</span>
                    <select className="sd-field" value={b.afterPeriod} onChange={(e) => p.setCustomBreaks((prev) => prev.map((x) => x.id === b.id ? { ...x, afterPeriod: parseInt(e.target.value, 10) } : x))}>
                      {Array.from({ length: Math.max(0, p.customCount - 1) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Minutes</span>
                    <input type="number" min={5} max={120} className="sd-field" value={b.durationMin} onChange={(e) => p.setCustomBreaks((prev) => prev.map((x) => x.id === b.id ? { ...x, durationMin: Math.min(120, Math.max(5, parseInt(e.target.value, 10) || 5)) } : x))} />
                  </label>
                  <button className="pl-ico nt-del" aria-label="Remove this break" onClick={() => p.setCustomBreaks((prev) => prev.filter((x) => x.id !== b.id))}><Trash2 /></button>
                </div>
              ))}
            </div>

            <div className="ts-preview" aria-label="Your day">
              <b>Your day</b>
              {p.preview.map((item, i) => (
                <div key={i} data-break={item.kind === 'break'}>
                  <span>{item.kind === 'break' && <Coffee aria-hidden="true" />}{item.label}</span>
                  <time>{item.range.split(' – ').map(formatTime).join(' – ')}</time>
                </div>
              ))}
            </div>
            <button className="sd-btn sd-btn--amber" onClick={p.onApplyCustom}>Use this day</button>
          </section>
        )}

        <section className="sm-group" aria-label="Current periods">
          <h3 className="ts-h">Current periods</h3>
          {sorted.length === 0 ? (
            <div className="sd-empty"><b>No periods yet</b><p>Pick a template above, or add a period below.</p></div>
          ) : (
            <div className="ts-plist">
              {sorted.map((per, i) => {
                const prev = sorted[i - 1]
                const gap = prev ? (new Date(`2000-01-01T${per.start_time}`).getTime() - new Date(`2000-01-01T${prev.end_time}`).getTime()) / 60000 : 0
                const isLast = i === sorted.length - 1
                return (
                  <div key={per.id}>
                    {gap > 0 && (
                      <div className="ts-gap"><span><Coffee aria-hidden="true" />{breakLabelForGap(gap)}</span><time>{formatTime(prev.end_time)} – {formatTime(per.start_time)}</time></div>
                    )}
                    <div className="ts-prow">
                      <span className="ts-pnum">{per.period_number}</span>
                      <time>{formatTime(per.start_time)} – {formatTime(per.end_time)}</time>
                      <span className="sm-chip" data-on={per.is_active}>{per.is_active ? 'Active' : 'Inactive'}</span>
                      <span className="sm-acts">
                        {!isLast && <button className="sd-btn sd-btn--line" onClick={() => setBreakFor(breakFor === per.id ? null : per.id)} aria-expanded={breakFor === per.id}><Coffee aria-hidden="true" />Add break</button>}
                        <button className="pl-ico" onClick={() => p.onEdit(per)} aria-label={`Edit period ${per.period_number}`} title="Edit"><Pencil /></button>
                        <button className="pl-ico nt-del" onClick={() => p.onDelete(per.id)} aria-label={`Delete period ${per.period_number}`} title="Delete"><Trash2 /></button>
                      </span>
                    </div>
                    {breakFor === per.id && (
                      <div className="ts-addbreak">
                        <span>Break after period {per.period_number}, in minutes. Later periods move down.</span>
                        <div className="as-chips">
                          {QUICK_BREAKS.map((m) => <button key={m} className="as-chip" onClick={() => insert(per.id, m)}>{m}</button>)}
                          <input type="number" min={1} className="sd-field" placeholder="Other" aria-label="Other length in minutes" value={custom} onChange={(e) => setCustom(e.target.value)} />
                          <button className="sd-btn sd-btn--amber" disabled={!custom || parseInt(custom, 10) <= 0} onClick={() => insert(per.id, parseInt(custom, 10))}>Add</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="sm-group" aria-label={p.editing ? 'Edit period' : 'Add a period'}>
          <h3 className="ts-h">{p.editing ? `Edit period ${p.editing.period_number}` : 'Add a period'}</h3>
          <div className="sm-two" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <div className="sd-field-wrap">
              <label htmlFor="pf-num">Number</label>
              <input id="pf-num" type="number" className="sd-field" value={p.form.period_number} disabled={chained} onChange={(e) => p.setForm({ ...p.form, period_number: parseInt(e.target.value) || 1 })} />
              {chained && <small className="as-fine">Set automatically</small>}
            </div>
            <div className="sd-field-wrap">
              <label htmlFor="pf-start">Starts</label>
              <input id="pf-start" type="time" className="sd-field" value={p.form.start_time} disabled={chained} onChange={(e) => p.setForm({ ...p.form, start_time: e.target.value })} />
              {chained && <small className="as-fine">After the last period</small>}
            </div>
            <div className="sd-field-wrap">
              <label htmlFor="pf-end">Ends</label>
              <input id="pf-end" type="time" className="sd-field" value={p.form.end_time} onChange={(e) => p.setForm({ ...p.form, end_time: e.target.value })} />
            </div>
          </div>
          {p.error && p.form.end_time && <p className="sm-warn" role="alert">{p.error}</p>}
          <div className="sd-hero-actions" style={{ marginTop: 0 }}>
            {p.editing && <button className="sd-btn sd-btn--line" onClick={p.onResetForm}>Cancel</button>}
            <button className="sd-btn sd-btn--amber" onClick={p.editing ? p.onUpdate : p.onCreate} disabled={!!p.error}>
              {p.editing ? 'Save changes' : 'Add period'}
            </button>
          </div>
        </section>
      </div>
    </Modal>
  )
}
