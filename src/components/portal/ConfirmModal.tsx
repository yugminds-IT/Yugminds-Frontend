'use client'

import { Loader2 } from 'lucide-react'
import Modal from './Modal'

/** A yes/no question in the portal's own dialog. `danger` makes the confirm button red. */
export default function ConfirmModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  confirmLabel,
  onConfirm,
  busy = false,
  danger = false,
  cancelLabel = 'Cancel',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children?: React.ReactNode
  confirmLabel: string
  onConfirm: () => void
  busy?: boolean
  danger?: boolean
  cancelLabel?: string
}) {
  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose() }}
      title={title}
      subtitle={subtitle}
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={onClose} disabled={busy}>{cancelLabel}</button>
          <button className={`sd-btn ${danger ? 'sd-btn--danger' : 'sd-btn--amber'}`} onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  )
}
