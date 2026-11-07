/** A score as a ring that fills when it appears. */
export default function ScoreRing({ value, size = 96 }: { value: number; size?: number }) {
  const v = Math.max(0, Math.min(100, value))
  const r = 42
  const c = 2 * Math.PI * r
  return (
    <span className="ls-ring" style={{ width: size, height: size, '--c': c, '--o': c * (1 - v / 100) } as React.CSSProperties} role="img" aria-label={`${Math.round(v)} percent`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} />
        <circle cx="50" cy="50" r={r} className="ls-ring-fill" />
      </svg>
      <b>{Math.round(v)}%</b>
    </span>
  )
}

export function scoreWords(v: number) {
  return v >= 70 ? 'Great job!' : v >= 50 ? 'Good try!' : 'Keep practising!'
}
