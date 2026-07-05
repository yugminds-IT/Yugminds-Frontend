'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Trash2, HelpCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

type ConfirmVariant = 'default' | 'danger'

export interface ConfirmOptions {
  /** Bold heading shown at the top of the dialog. */
  title: string
  /** Supporting message. Newlines are rendered as line breaks. */
  description?: string
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmText?: string
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelText?: string
  /** "danger" shows a red, destructive styling (use for delete / irreversible actions). */
  variant?: ConfirmVariant
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve?: (value: boolean) => void
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | null>(null)

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return context.confirm
}

// Singleton so non-hook code (and quick refactors) can call confirmDialog(...) directly.
let globalConfirm: ((options: ConfirmOptions) => Promise<boolean>) | null = null

/**
 * Promise-based replacement for window.confirm().
 * Resolves to true when the user confirms, false when they cancel/dismiss.
 *
 *   if (!(await confirmDialog({ title: 'Delete this?', variant: 'danger' }))) return
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (!globalConfirm) {
    // Provider not mounted yet — fail safe by treating as cancelled.
    return Promise.resolve(false)
  }
  return globalConfirm(options)
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState>({ open: false, title: '' })

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, open: true, resolve })
    })
  }, [])

  const handleClose = useCallback(
    (result: boolean) => {
      setState((prev) => {
        prev.resolve?.(result)
        return { ...prev, open: false, resolve: undefined }
      })
    },
    []
  )

  useEffect(() => {
    globalConfirm = confirm
    return () => {
      globalConfirm = null
    }
  }, [confirm])

  const isDanger = state.variant === 'danger'
  const Icon = isDanger ? Trash2 : HelpCircle

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <DialogPrimitive.Root
        open={state.open}
        onOpenChange={(open) => {
          if (!open) handleClose(false)
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            onEscapeKeyDown={() => handleClose(false)}
            className="fixed left-[50%] top-[50%] z-[101] w-full max-w-sm translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl duration-200 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          >
            <div className="flex flex-col items-center text-center">
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full',
                  isDanger ? 'bg-red-100' : 'bg-blue-100'
                )}
              >
                <Icon
                  className={cn('h-6 w-6', isDanger ? 'text-red-600' : 'text-blue-600')}
                  aria-hidden="true"
                />
              </div>

              <DialogPrimitive.Title className="mt-4 text-lg font-semibold text-gray-900">
                {state.title}
              </DialogPrimitive.Title>

              {state.description ? (
                <DialogPrimitive.Description className="mt-2 whitespace-pre-line text-sm text-gray-500">
                  {state.description}
                </DialogPrimitive.Description>
              ) : (
                // Radix warns when Description is missing; keep it accessible but hidden.
                <DialogPrimitive.Description className="sr-only">
                  {state.title}
                </DialogPrimitive.Description>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                {state.cancelText ?? 'Cancel'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => handleClose(true)}
                className={cn(
                  'flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
                  isDanger
                    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                )}
              >
                {state.confirmText ?? 'Confirm'}
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </ConfirmContext.Provider>
  )
}
