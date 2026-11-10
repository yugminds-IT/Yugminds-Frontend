'use client'

import { useState } from 'react'
import { CalendarOff, Loader2 } from 'lucide-react'
import Modal from '../portal/Modal'
import { dateInput, type Teacher } from './teacher-utils'

/** File an emergency leave on a teacher's behalf. The server enforces the date window. */
export default function EmergencyLeaveModal({
  open,
  teachers,
  initialTeacherId,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean
  teachers: Teacher[]
  initialTeacherId: string
  busy: boolean
  onClose: () => void
  onSubmit: (v: { teacher_id: string; start_date: string; end_date: string; reason: string }) => void
}) {
  const [teacherId, setTeacherId] = useState(initialTeacherId)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const ready = !!teacherId && !!start && !!end && !!reason.trim() && end >= start

  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose() }}
      title="Record emergency leave"
      subtitle="Use this when a teacher cannot ask for leave themselves."
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="sd-btn sd-btn--amber" disabled={busy || !ready} onClick={() => onSubmit({ teacher_id: teacherId, start_date: start, end_date: end, reason: reason.trim() })}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CalendarOff aria-hidden="true" />}
            Record leave
          </button>
        </>
      }
    >
      <form className="sm-form" onSubmit={(e) => { e.preventDefault(); if (ready && !busy) onSubmit({ teacher_id: teacherId, start_date: start, end_date: end, reason: reason.trim() }) }}>
        <p className="nt-summary">
          It counts as your approval. The main admin must approve it too before the days are marked as leave. It can start today or up to 2 days back.
        </p>
        <div className="sd-field-wrap">
          <label htmlFor="el-teacher">Teacher</label>
          <select id="el-teacher" className="sd-field" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">Choose a teacher</option>
            {teachers.map((t) => <option key={t.id ?? t.teacher_id} value={String(t.id ?? '')}>{t.full_name}</option>)}
          </select>
        </div>
        <div className="sm-two">
          <div className="sd-field-wrap">
            <label htmlFor="el-start">First day</label>
            <input id="el-start" type="date" className="sd-field" min={dateInput(-2)} value={start} onChange={(e) => { setStart(e.target.value); if (end && e.target.value > end) setEnd('') }} />
          </div>
          <div className="sd-field-wrap">
            <label htmlFor="el-end">Last day</label>
            <input id="el-end" type="date" className="sd-field" min={start || dateInput(-2)} value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="sd-field-wrap">
          <label htmlFor="el-reason">Reason</label>
          <textarea id="el-reason" className="sd-field" rows={3} placeholder="What happened?" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
