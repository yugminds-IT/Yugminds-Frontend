'use client'

import { useEffect, useState } from 'react'
import { Check, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { authApi } from '../../lib/api/auth.api'
import { getStoredSession, setStoredSession, waitForSession } from '../../lib/session-utils'
import PasswordCoach, { passwordMeetsRules } from './PasswordCoach'

/**
 * Shown when someone signs in with a password they were given. It blocks the portal until they choose.
 * With `allowSkip` (students) they can keep the password they have; without it they must set a new one.
 */
export default function PasswordPrompt({ allowSkip = false }: { allowSkip?: boolean }) {
  const [show, setShow] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [seeNew, setSeeNew] = useState(false)
  const [seeConfirm, setSeeConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    // After a reload the session is restored asynchronously via refresh.
    void waitForSession().then((res) => {
      if (!cancelled && res?.session?.user?.mustChangePassword) setShow(true)
    })
    return () => { cancelled = true }
  }, [])

  if (!show) return null

  const clearFlag = () => {
    const session = getStoredSession()
    if (session?.user) setStoredSession({ ...session, user: { ...session.user, mustChangePassword: false } })
  }

  const keep = async () => {
    setError('')
    setSkipping(true)
    try {
      await authApi.keepPassword()
      clearFlag()
      setShow(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setSkipping(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!passwordMeetsRules(pw)) { setError('Your password needs 8 or more letters, a capital letter, a small letter and a number.'); return }
    if (pw !== pw2) { setError('The two passwords are different.'); return }
    setLoading(true)
    try {
      await authApi.updatePassword({ new_password: pw })
      clearFlag()
      setDone(true)
      setTimeout(() => setShow(false), 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your password was not changed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cf-lb sd sd-player" style={{ zIndex: 9999 }}>
      <div className="sd-modal" role="dialog" aria-modal="true" aria-labelledby="spp-t" data-wide="false">
        <div className="sd-modal-head">
          <div>
            <h2 id="spp-t">{allowSkip ? 'Choose your own password?' : 'Set a new password'}</h2>
            <p>
              {allowSkip
                ? 'You signed in with the password you were given. You can pick a new one now, or keep this one.'
                : 'You signed in with a temporary password. Choose a new one before you carry on.'}
            </p>
          </div>
        </div>
        {done ? (
          <div className="sd-modal-body">
            <div className="sd-empty" style={{ justifyItems: 'center', textAlign: 'center', padding: '1.5rem 0' }}>
              <span className="ls-card-ico"><Check aria-hidden="true" /></span>
              <b>Your new password is set</b>
              <p>Taking you to your dashboard.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'contents' }}>
            <div className="sd-modal-body">
              <div className="sd-field-wrap">
                <label htmlFor="spp-new">New password</label>
                <div className="st-input">
                  <input id="spp-new" className="sd-field" type={seeNew ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Type a new password" autoComplete="new-password" autoFocus />
                  <div className="st-input-r">
                    <button type="button" className="st-eye" onClick={() => setSeeNew((v) => !v)} aria-label={seeNew ? 'Hide password' : 'Show password'}>{seeNew ? <EyeOff /> : <Eye />}</button>
                  </div>
                </div>
              </div>
              <PasswordCoach password={pw} />
              <div className="sd-field-wrap">
                <label htmlFor="spp-confirm">Type it again</label>
                <div className="st-input">
                  <input id="spp-confirm" className="sd-field" type={seeConfirm ? 'text' : 'password'} value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Type the same password" autoComplete="new-password" />
                  <div className="st-input-r">
                    <button type="button" className="st-eye" onClick={() => setSeeConfirm((v) => !v)} aria-label={seeConfirm ? 'Hide password' : 'Show password'}>{seeConfirm ? <EyeOff /> : <Eye />}</button>
                  </div>
                </div>
                {pw2 && pw !== pw2 && <p className="st-hint" data-t="bad">The two passwords are different.</p>}
              </div>
              {error && <div className="ls-note" data-t="late" role="alert"><p>{error}</p></div>}
            </div>
            <div className="sd-modal-foot">
              {allowSkip && (
                <button type="button" className="sd-btn sd-btn--line" onClick={keep} disabled={loading || skipping}>
                  {skipping ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}Keep my password
                </button>
              )}
              <button type="submit" className="sd-btn sd-btn--amber" disabled={loading || skipping}>
                {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}Set new password
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
