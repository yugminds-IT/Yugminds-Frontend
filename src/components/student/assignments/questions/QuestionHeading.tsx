import type { ReactNode } from 'react'

/** Question text with an optional inline "Q5." number and points on the same line. */
export default function QuestionHeading({
  number,
  marks,
  className = 'leading-relaxed',
  children,
}: {
  number?: number
  marks?: number
  className?: string
  children: ReactNode
}) {
  const pts = marks ?? 1
  return (
    <div className="flex items-start gap-4 mb-5">
      <p className={`flex-1 min-w-0 text-base text-gray-900 ${className}`}>
        {number != null && <span className="font-semibold text-gray-500 mr-2">Q{number}.</span>}
        {children}
      </p>
      {number != null && (
        <span className="flex-shrink-0 mt-1 text-xs text-gray-400 whitespace-nowrap">
          {pts} pt{pts !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}
