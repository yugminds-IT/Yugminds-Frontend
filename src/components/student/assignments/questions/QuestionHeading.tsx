import type { ReactNode } from 'react'

/** The question as big, friendly text. Points show quietly underneath. */
export default function QuestionHeading({
  number,
  marks,
  children,
}: {
  number?: number
  marks?: number
  className?: string
  children: ReactNode
}) {
  const pts = marks ?? 1
  return (
    <p className="qa-text">
      {number != null && <span>{number}.</span>}
      {children}
      {number != null && <span className="qa-pts">{pts} point{pts !== 1 ? 's' : ''}</span>}
    </p>
  )
}
