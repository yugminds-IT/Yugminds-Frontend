'use client'

import { KeyRound, Pencil, Power, Trash2 } from 'lucide-react'
import Modal from '../portal/Modal'
import { displayStudentName, formatGradeBadge, formatSectionLabel, type Student } from './student-utils'

const dateOf = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not recorded')

/** Everything we know about one student, with the actions you can take on them. */
export default function StudentDetailModal({
  student,
  onClose,
  onEdit,
  onResetPassword,
  onToggle,
  onDelete,
}: {
  student: Student | null
  onClose: () => void
  onEdit: () => void
  onResetPassword: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const s = student
  const name = s ? displayStudentName(s) : ''
  const className = s ? [formatGradeBadge(s.grade), formatSectionLabel(s.section)].filter(Boolean).join(' · ') : ''
  return (
    <Modal
      open={!!s}
      onClose={onClose}
      wide
      title={name || 'Student'}
      subtitle={s?.profile?.email || 'No email on file'}
      footer={
        s && (
          <>
            <button className="sd-btn sd-btn--line sm-del" onClick={onDelete}><Trash2 aria-hidden="true" />Delete</button>
            <button className="sd-btn sd-btn--line" onClick={onToggle}><Power aria-hidden="true" />{s.is_active ? 'Deactivate' : 'Activate'}</button>
            <button className="sd-btn sd-btn--line" onClick={onResetPassword}><KeyRound aria-hidden="true" />Reset password</button>
            <button className="sd-btn sd-btn--amber" onClick={onEdit}><Pencil aria-hidden="true" />Edit</button>
          </>
        )
      }
    >
      {s && (
        <div className="sm-detail">
          <dl>
            <div><dt>Class</dt><dd>{className || <span className="sm-warn">No class assigned</span>}</dd></div>
            <div><dt>Status</dt><dd><span className="sm-chip" data-on={s.is_active}>{s.is_active ? 'Active' : 'Inactive'}</span></dd></div>
            <div>
              <dt>How they joined</dt>
              <dd>{s.joining_code ? <>Joined with code <code>{s.joining_code}</code></> : 'Added by an admin'}</dd>
            </div>
            <div><dt>Enrolled</dt><dd>{dateOf(s.enrolled_at)}</dd></div>
            <div><dt>Account created</dt><dd>{dateOf(s.profile?.created_at)}</dd></div>
            <div><dt>Student ID</dt><dd><code>{s.id}</code></dd></div>
          </dl>
          <section aria-label="Parent or guardian">
            <h3>Parent or guardian</h3>
            {s.profile?.parent_name || s.profile?.parent_phone ? (
              <dl>
                <div><dt>Name</dt><dd>{s.profile.parent_name || <span className="sm-muted">Not provided</span>}</dd></div>
                <div>
                  <dt>Phone</dt>
                  <dd>{s.profile.parent_phone ? <a className="sd-link" href={`tel:${s.profile.parent_phone}`}>{s.profile.parent_phone}</a> : <span className="sm-muted">Not provided</span>}</dd>
                </div>
              </dl>
            ) : (
              <p className="sm-muted">No parent details yet. Add them from Edit.</p>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}
