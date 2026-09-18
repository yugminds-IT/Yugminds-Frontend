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

export type ChoiceResult = 'primary' | 'secondary' | 'cancel'

export interface ChoiceOptions {
  title: string
  description?: string
  /** Main action (e.g. "Update existing copy"). */
  primaryText: string
  /** Secondary action (e.g. "Leave unchanged"). */
  secondaryText: string
  cancelText?: string
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve?: (value: boolean) => void
}

interface ChoiceState extends ChoiceOptions {
  open: boolean
  resolve?: (value: ChoiceResult) => void
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  choice: (options: ChoiceOptions) => Promise<ChoiceResult>
}

const ConfirmContext = createContext<ConfirmContextType | null>(null)

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return context.confirm
}

// Singleton so non-hook code can call confirmDialog / choiceDialog directly.
let globalConfirm: ((options: ConfirmOptions) => Promise<boolean>) | null = null
let globalChoice: ((options: ChoiceOptions) => Promise<ChoiceResult>) | null = null

/**
 * Promise-based replacement for window.confirm().
 * Resolves to true when the user confirms, false when they cancel/dismiss.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (!globalConfirm) {
    return Promise.resolve(false)
  }
  return globalConfirm(options)
}

/**
 * Three-way choice dialog. Resolves to 'primary' | 'secondary' | 'cancel'.
 */
export function choiceDialog(options: ChoiceOptions): Promise<ChoiceResult> {
  if (!globalChoice) {
    return Promise.resolve('cancel')
  }
  return globalChoice(options)
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState>({ open: false, title: '' })
  const [choiceState, setChoiceState] = useState<ChoiceState>({
    open: false,
    title: '',
    primaryText: '',
    secondaryText: '',
  })

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, open: true, resolve })
    })
  }, [])

  const choice = useCallback((options: ChoiceOptions) => {
    return new Promise<ChoiceResult>((resolve) => {
      setChoiceState({ ...options, open: true, resolve })
    })
  }, [])

  const handleClose = useCallback((result: boolean) => {
    setState((prev) => {
      prev.resolve?.(result)
      return { ...prev, open: false, resolve: undefined }
    })
  }, [])

  const handleChoiceClose = useCallback((result: ChoiceResult) => {
    setChoiceState((prev) => {
      prev.resolve?.(result)
      return { ...prev, open: false, resolve: undefined }
    })
  }, [])

  useEffect(() => {
    globalConfirm = confirm
    globalChoice = choice
    return () => {
      globalConfirm = null
      globalChoice = null
    }
  }, [confirm, choice])

  const isDanger = state.variant === 'danger'
  const Icon = isDanger ? Trash2 : HelpCircle

  return (
    <ConfirmContext.Provider value={{ confirm, choice }}>
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

      <DialogPrimitive.Root
        open={choiceState.open}
        onOpenChange={(open) => {
          if (!open) handleChoiceClose('cancel')
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            onEscapeKeyDown={() => handleChoiceClose('cancel')}
            className="fixed left-[50%] top-[50%] z-[101] w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl duration-200 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          >
            <div className="flex flex-col text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <HelpCircle className="h-5 w-5 text-blue-600" aria-hidden="true" />
              </div>
              <DialogPrimitive.Title className="mt-3 text-lg font-semibold text-gray-900">
                {choiceState.title}
              </DialogPrimitive.Title>
              {choiceState.description ? (
                <DialogPrimitive.Description className="mt-2 whitespace-pre-line text-sm text-gray-500">
                  {choiceState.description}
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">
                  {choiceState.title}
                </DialogPrimitive.Description>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => handleChoiceClose('primary')}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {choiceState.primaryText}
              </button>
              <button
                type="button"
                onClick={() => handleChoiceClose('secondary')}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                {choiceState.secondaryText}
              </button>
              <button
                type="button"
                onClick={() => handleChoiceClose('cancel')}
                className="w-full rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                {choiceState.cancelText ?? 'Cancel'}
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </ConfirmContext.Provider>
  )
}
