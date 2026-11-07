'use client'

import { useCallback, useEffect, useState } from 'react'
import { Laptop, Loader2, LogOut, Smartphone, Tablet } from 'lucide-react'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import type { DeviceSession, SessionsApi } from '@/components/settings/DevicesAndSessions'

const ICONS = { mobile: Smartphone, tablet: Tablet } as const

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 2) return 'Active now'
  if (mins < 60) return `${mins} minutes ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/**
 * Where the account is signed in, with log out per device and everywhere. API-agnostic like the older
 * DevicesAndSessions. `onSignedOut` runs after "log out everywhere" (which also ends this device).
 */
export default function DevicesList({ api, onSignedOut }: { api: SessionsApi; onSignedOut: () => void }) {
  const confirm = useConfirm()
  const toast = useToast()
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setSessions(await api.list())
      setError('')
    } catch {
      setError('We could not load your devices. Try again.')
    }
  }, [api])

  useEffect(() => { void load() }, [load])

  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key)
    try {
      await fn()
      toast.success(done)
      await load()
    } catch {
      toast.error('Something went wrong. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const logOut = async (s: DeviceSession) => {
    const ok = await confirm({ title: 'Log out this device?', description: `${s.browser} on ${s.os} will be signed out.`, confirmText: 'Log out', variant: 'danger' })
    if (ok) await run(s.id, () => api.revoke(s.id), 'That device was logged out')
  }
  const logOutOthers = async () => {
    const ok = await confirm({ title: 'Log out all other devices?', description: 'You will stay signed in here.', confirmText: 'Log out others', variant: 'danger' })
    if (ok) await run('others', api.revokeOthers, 'Your other devices were logged out')
  }
  const logOutAll = async () => {
    const ok = await confirm({ title: 'Log out of all devices?', description: 'Every device, including this one, will be signed out.', confirmText: 'Log out everywhere', variant: 'danger' })
    if (!ok) return
    setBusy('all')
    try {
      await api.revokeAll()
      onSignedOut()
    } catch {
      setBusy(null)
      toast.error('Something went wrong. Try again.')
    }
  }

  const others = sessions?.filter((s) => !s.current).length ?? 0

  return (
    <div>
      {error && <div className="ls-note" data-t="late" role="alert"><p>{error}</p></div>}
      {!sessions && !error && <div className="sd-skel" />}
      {sessions && sessions.length === 0 && <p className="st-hint">No signed-in devices to show.</p>}
      {sessions?.map((s) => {
        const Icon = ICONS[s.deviceType as keyof typeof ICONS] ?? Laptop
        return (
          <div key={s.id} className="st-dev" data-here={s.current}>
            <span className="st-dev-ico" aria-hidden="true"><Icon /></span>
            <div className="st-dev-main">
              <b>{s.browser} on {s.os}{s.current && <span className="st-here">This device</span>}</b>
              <small>{s.location}{s.ip ? ` • ${s.ip}` : ''} • {ago(s.lastSeenAt)}</small>
            </div>
            {!s.current && (
              <button className="sd-btn sd-btn--line" style={{ minHeight: '2.4rem', padding: '0.3rem 1rem' }} disabled={busy !== null} onClick={() => logOut(s)}>
                {busy === s.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : 'Log out'}
              </button>
            )}
          </div>
        )
      })}
      {sessions && (
        <div className="st-dev-acts">
          {others > 0 && <button className="sd-btn sd-btn--line" disabled={busy !== null} onClick={logOutOthers}>Log out my other devices</button>}
          <button className="sd-btn sd-btn--danger" disabled={busy !== null} onClick={logOutAll}>
            {busy === 'all' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}Log out everywhere
          </button>
        </div>
      )}
    </div>
  )
}
