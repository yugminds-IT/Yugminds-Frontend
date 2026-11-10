'use client'

import { useState } from 'react'
import { Eye, EyeOff, Loader2, RefreshCw, UserPlus, Check } from 'lucide-react'
import Modal from '../portal/Modal'
import PasswordCoach from '../portal/PasswordCoach'
import { ChipGroup } from '../portal/notifications'
import { generatePassword, type StudentForm } from './student-utils'

/** Add a student, or edit one. The login section only shows when adding. */
export default function StudentFormModal({
  open,
  mode,
  form,
  onChange,
  grades,
  sections,
  busy,
  canSubmit,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: 'add' | 'edit'
  form: StudentForm
  onChange: (next: StudentForm) => void
  grades: string[]
  /** sections that exist for the chosen grade */
  sections: string[]
  busy: boolean
  canSubmit: boolean
  onClose: () => void
  onSubmit: () => void
}) {
  const [showPw, setShowPw] = useState(false)
  const set = (patch: Partial<StudentForm>) => onChange({ ...form, ...patch })
  const adding = mode === 'add'

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={adding ? 'Add a student' : 'Edit student'}
      subtitle={adding ? 'They can log in with this email and password as soon as you save.' : 'Update their details and class.'}
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="sd-btn sd-btn--amber" onClick={onSubmit} disabled={busy || !canSubmit}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : adding ? <UserPlus aria-hidden="true" /> : <Check aria-hidden="true" />}
            {adding ? 'Add student' : 'Save changes'}
          </button>
        </>
      }
    >
      <form className="sm-form" onSubmit={(e) => { e.preventDefault(); if (canSubmit && !busy) onSubmit() }}>
        <fieldset className="sm-group">
          <legend>Student</legend>
          <div className="sd-field-wrap">
            <label htmlFor="sf-name">Full name</label>
            <input id="sf-name" className="sd-field" autoComplete="off" value={form.full_name} onChange={(e) => set({ full_name: e.target.value })} />
          </div>
          <div className="sd-field-wrap">
            <label htmlFor="sf-email">Email</label>
            <input id="sf-email" type="email" className="sd-field" autoComplete="off" value={form.email} onChange={(e) => set({ email: e.target.value })} />
          </div>
        </fieldset>

        <fieldset className="sm-group">
          <legend>Class</legend>
          <div className="sd-field-wrap">
            <label>Grade</label>
            {grades.length === 0 ? (
              <p className="as-fine" style={{ margin: 0 }}>No grades are set up for your school yet.</p>
            ) : (
              <ChipGroup label="Grade" value={form.grade} options={grades.map((g) => [g, g] as const)} onChange={(g) => set({ grade: g })} />
            )}
          </div>
          <div className="sd-field-wrap">
            <label>Section</label>
            {sections.length === 0 ? (
              <p className="as-fine" style={{ margin: 0 }}>No sections are set up for this grade.</p>
            ) : (
              <ChipGroup label="Section" value={form.section} options={sections.map((s) => [s, s] as const)} onChange={(s) => set({ section: s })} />
            )}
          </div>
          {!adding && (
            <div className="sd-field-wrap">
              <label htmlFor="sf-code">Joining code <small className="sm-opt">optional</small></label>
              <input id="sf-code" className="sd-field" value={form.joining_code} onChange={(e) => set({ joining_code: e.target.value })} />
            </div>
          )}
        </fieldset>

        <fieldset className="sm-group">
          <legend>Parent or guardian</legend>
          <div className="sm-two">
            <div className="sd-field-wrap">
              <label htmlFor="sf-pname">Name</label>
              <input id="sf-pname" className="sd-field" value={form.parent_name} onChange={(e) => set({ parent_name: e.target.value })} />
            </div>
            <div className="sd-field-wrap">
              <label htmlFor="sf-pphone">Phone number</label>
              <input id="sf-pphone" type="tel" className="sd-field" value={form.parent_phone} onChange={(e) => set({ parent_phone: e.target.value })} />
            </div>
          </div>
        </fieldset>

        {adding && (
          <fieldset className="sm-group">
            <legend>Login</legend>
            <div className="sd-field-wrap">
              <label htmlFor="sf-pw">Password</label>
              <div className="sm-pwrow">
                <div className="st-input">
                  <input
                    id="sf-pw"
                    type={showPw ? 'text' : 'password'}
                    className="sd-field"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => set({ password: e.target.value })}
                  />
                  <span className="st-input-r">
                    <button type="button" className="st-eye" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                  </span>
                </div>
                <button type="button" className="sd-btn sd-btn--line" onClick={() => { set({ password: generatePassword() }); setShowPw(true) }}>
                  <RefreshCw aria-hidden="true" />Generate
                </button>
              </div>
            </div>
            <PasswordCoach password={form.password} />
          </fieldset>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
