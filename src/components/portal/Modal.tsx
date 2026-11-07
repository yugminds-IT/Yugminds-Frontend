'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/**
 * A portal dialog: title, a scrolling body and a footer. It stays inside the portal's own styles
 * (no portal to <body>), closes with Escape or a click outside, keeps Tab inside, and hands focus back.
 * `onClose` is called for every way of closing, so a caller can ask "discard your draft?" first.
 */
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  wide = false,
  footer,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  wide?: boolean
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  const card = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })

  useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    const root = card.current
    const focusables = () =>
      Array.from(root?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select, [tabindex]:not([tabindex="-1"])') ?? [])
    ;(focusables().find((el) => el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') ?? root)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); return }
      if (e.key !== 'Tab') return
      const f = focusables()
      if (f.length === 0) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); before?.focus?.() }
  }, [open])

  if (!open) return null
  return (
    <div className="cf-lb" onClick={() => onClose()}>
      <div
        ref={card}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sd-modal sd-player"
        data-wide={wide}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sd-modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="pl-ico" onClick={() => onClose()} aria-label="Close"><X /></button>
        </div>
        <div className="sd-modal-body">{children}</div>
        {footer && <div className="sd-modal-foot">{footer}</div>}
      </div>
    </div>
  )
}
