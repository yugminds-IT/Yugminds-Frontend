'use client'

import { useState } from 'react'
import { Copy, Eye, EyeOff, KeyRound, Loader2, RefreshCw } from 'lucide-react'
import Modal from '../portal/Modal'
import PasswordCoach, { passwordMeetsRules } from '../portal/PasswordCoach'
import { generatePassword } from './student-utils'

/** Set a new password for a student who is locked out. */
export default function StudentPasswordModal({
  open,
  name,
  busy,
  onClose,
  onSubmit,
  onCopied,
}: {
  open: boolean
  name: string
  busy: boolean
  onClose: () => void
  onSubmit: (password: string) => void
  /** called after the password is copied, or with an error message if it could not be */
  onCopied: (error?: string) => void
}) {
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pw)
      onCopied()
    } catch {
      onCopied('Could not copy. Select the password and copy it by hand.')
    }
  }

  const close = () => { setPw(''); setShow(false); onClose() }

  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) close() }}
      title="Reset password"
      subtitle={`Choose a new password for ${name}. Share it with them yourself.`}
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={close} disabled={busy}>Cancel</button>
          <button
            className="sd-btn sd-btn--amber"
            disabled={busy || !passwordMeetsRules(pw)}
            onClick={() => onSubmit(pw)}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
            Set new password
          </button>
        </>
      }
    >
      <form className="sm-form" onSubmit={(e) => { e.preventDefault(); if (passwordMeetsRules(pw) && !busy) onSubmit(pw) }}>
        <div className="sd-field-wrap">
          <label htmlFor="rp-pw">New password</label>
          <div className="st-input">
            <input id="rp-pw" type={show ? 'text' : 'password'} className="sd-field" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            <span className="st-input-r">
              <button type="button" className="st-eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
            </span>
          </div>
        </div>
        <div className="sm-pwacts">
          <button type="button" className="sd-btn sd-btn--line" onClick={() => { setPw(generatePassword()); setShow(true) }}>
            <RefreshCw aria-hidden="true" />Generate one
          </button>
          <button type="button" className="sd-btn sd-btn--line" onClick={copy} disabled={!pw}>
            <Copy aria-hidden="true" />Copy
          </button>
        </div>
        <PasswordCoach password={pw} />
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
