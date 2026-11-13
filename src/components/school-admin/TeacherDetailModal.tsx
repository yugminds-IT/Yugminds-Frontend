'use client'

import { CalendarOff } from 'lucide-react'
import Modal from '../portal/Modal'
import { formatWorkingSchedule } from '@/lib/weekday-utils'
import { attendanceBand, classGroups, classLabel, teacherSubjects, type Teacher } from './teacher-utils'

const BAND_TONE = { low: 'low', watch: 'watch', good: 'good', none: 'none' } as const

/** Everything we hold on one teacher. School admins can look but not edit; only the main admin does. */
export default function TeacherDetailModal({
  teacher,
  onClose,
  onRecordLeave,
}: {
  teacher: Teacher | null
  onClose: () => void
  onRecordLeave: () => void
}) {
  const t = teacher
  const groups = t ? classGroups(t) : []
  const subjects = t ? teacherSubjects(t) : []
  const band = t ? attendanceBand(t) : 'none'
  const pct = t?.attendance_percentage ?? 0
  return (
    <Modal
      open={!!t}
      onClose={onClose}
      wide
      title={t?.full_name || 'Teacher'}
      subtitle={t?.email || 'No email on file'}
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={onClose}>Close</button>
          <button className="sd-btn sd-btn--amber" onClick={onRecordLeave}><CalendarOff aria-hidden="true" />Record emergency leave</button>
        </>
      }
    >
      {t && (
        <div className="sm-detail">
          <dl>
            <div><dt>Status</dt><dd><span className="sm-chip" data-on={t.status.toLowerCase() === 'active'}>{t.status || 'Active'}</span></dd></div>
            <div>
              <dt>Attendance, this month</dt>
              <dd>
                {band === 'none' ? <span className="sm-muted">Nothing recorded yet</span> : (
                  <span className="tm-att" data-band={BAND_TONE[band]}>
                    <b>{pct}%</b>
                    <i className="tm-bar"><u style={{ width: `${Math.min(100, pct)}%` }} /></i>
                  </span>
                )}
              </dd>
            </div>
            <div><dt>Leave taken</dt><dd>{t.leaves_taken ?? 0} {(t.leaves_taken ?? 0) === 1 ? 'day' : 'days'}</dd></div>
            <div><dt>Phone</dt><dd>{t.phone ? <a className="sd-link" href={`tel:${t.phone}`}>{t.phone}</a> : <span className="sm-muted">Not provided</span>}</dd></div>
            <div><dt>Qualification</dt><dd>{t.qualification || <span className="sm-muted">Not provided</span>}</dd></div>
            <div><dt>Specialization</dt><dd>{t.specialization || <span className="sm-muted">Not provided</span>}</dd></div>
            <div><dt>Experience</dt><dd>{t.experience_years ? `${t.experience_years} ${t.experience_years === 1 ? 'year' : 'years'}` : <span className="sm-muted">Not provided</span>}</dd></div>
          </dl>
          <section aria-label="Classes">
            <h3>Classes</h3>
            {groups.length ? (
              <div className="tm-chips">{groups.map((g) => <span key={g.grade} className="sm-chip" data-class="true">{classLabel(g)}</span>)}</div>
            ) : (
              <p className="sm-muted">No classes assigned yet. The main admin assigns them.</p>
            )}
          </section>
          {t?.teacher_schools?.[0]?.working_days && (
            <section aria-label="Working days">
              <h3>Days at your school</h3>
              <p className="sm-muted">{formatWorkingSchedule(t.teacher_schools[0].working_days, t.teacher_schools[0].day_slots)}</p>
            </section>
          )}
          <section aria-label="Subjects">
            <h3>Subjects</h3>
            {subjects.length ? (
              <div className="tm-chips">{subjects.map((s) => <span key={s} className="sm-chip">{s}</span>)}</div>
            ) : (
              <p className="sm-muted">No subjects assigned yet.</p>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}
