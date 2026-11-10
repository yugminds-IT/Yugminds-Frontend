'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'

export interface RowMenuItem {
  label: string
  icon?: LucideIcon
  onClick: () => void
  danger?: boolean
  separatorBefore?: boolean
}

/**
 * A "more actions" menu for a list row. It is drawn on the page body and positioned against the viewport,
 * so a row inside a clipped or animated list still shows the whole menu (a transformed ancestor would
 * otherwise trap a fixed menu). Closes on Escape, outside click or when the page scrolls.
 */
export default function RowMenu({
  label,
  items,
  button,
  buttonClassName = 'pl-ico',
  align = 'end',
}: {
  label: string
  items: RowMenuItem[]
  /** a visible label for the trigger; leave out for the round "more" icon button */
  button?: React.ReactNode
  buttonClassName?: string
  align?: 'start' | 'end'
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  const close = () => { setPos(null); btn.current?.focus() }

  useEffect(() => {
    if (!pos) return
    const first = menu.current?.querySelector<HTMLElement>('button')
    first?.focus()
    const away = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setPos(null)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close() }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const all = Array.from(menu.current?.querySelectorAll<HTMLElement>('button') ?? [])
        const i = all.indexOf(document.activeElement as HTMLElement)
        all[(i + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length]?.focus()
      }
    }
    const hide = () => setPos(null)
    const hideOnScroll = (e: Event) => { if (!menu.current?.contains(e.target as Node)) setPos(null) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key, true)
    window.addEventListener('resize', hide)
    window.addEventListener('scroll', hideOnScroll, true)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', key, true)
      window.removeEventListener('resize', hide)
      window.removeEventListener('scroll', hideOnScroll, true)
    }
  }, [pos])

  const toggle = () => {
    if (pos) return setPos(null)
    const r = btn.current!.getBoundingClientRect()
    const width = 208
    const height = items.length * 44 + 16
    const top = r.bottom + height > window.innerHeight - 8 ? Math.max(8, r.top - height - 4) : r.bottom + 4
    const left = align === 'end' ? r.right - width : r.left
    setPos({ top, left: Math.max(8, Math.min(left, window.innerWidth - width - 8)) })
  }

  return (
    <>
      <button ref={btn} type="button" className={buttonClassName} aria-label={label} aria-haspopup="menu" aria-expanded={!!pos} onClick={toggle}>
        {button ?? <MoreHorizontal />}
      </button>
      {pos && createPortal(
        <div ref={menu} role="menu" aria-label={label} className="sd-menu" style={{ top: pos.top, left: pos.left }}>
          {items.map((it) => (
            <div key={it.label}>
              {it.separatorBefore && <hr />}
              <button
                role="menuitem"
                type="button"
                data-danger={it.danger}
                onClick={() => { setPos(null); it.onClick() }}
              >
                {it.icon && <it.icon aria-hidden="true" />}
                {it.label}
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
