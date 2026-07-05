'use client'

import { cn } from '@/lib/utils'

interface CircularProgressProps {
  /** 0–100 */
  value: number
  /** outer diameter in px */
  size?: number
  /** ring thickness in px */
  stroke?: number
  className?: string
  trackClassName?: string
  /** tailwind text color class for the arc, e.g. "text-blue-600" */
  arcClassName?: string
  /** content rendered centered inside the ring (defaults to "NN%") */
  children?: React.ReactNode
  showLabel?: boolean
}

/**
 * Lightweight SVG progress ring (Coursera/Udemy-style thumbnail badge).
 * Pure presentational — no state, safe to render in lists.
 */
export default function CircularProgress({
  value,
  size = 56,
  stroke = 5,
  className,
  trackClassName,
  arcClassName,
  children,
  showLabel = true,
}: CircularProgressProps) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference
  const complete = clamped >= 100

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={cn('text-gray-200', trackClassName)}
          stroke="currentColor"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={cn(
            complete ? 'text-green-500' : 'text-blue-600',
            arcClassName,
            'transition-[stroke-dashoffset] duration-500',
          )}
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children ?? (showLabel && (
          <span className="text-[11px] font-bold text-gray-700 tabular-nums">
            {Math.round(clamped)}%
          </span>
        ))}
      </div>
    </div>
  )
}
