import Droid from './Droid'

export interface Tick {
  /** where the tick sits, 0 to 100 */
  at: number
  label: string
}

/**
 * A 0 to 100 track with marked thresholds (badge levels, a certificate mark, a target). The droid waits at the value
 * and an amber fill follows it. Put it inside an `.an-run` card.
 */
export default function ThresholdTrack({ value, ticks }: { value: number; ticks: Tick[] }) {
  const s = Math.max(0, Math.min(100, value))
  return (
    <div className="an-inner" style={{ '--p': s / 100, '--s': `${s}%` } as React.CSSProperties}>
      <div className="an-droid"><Droid /></div>
      <div className="an-line" />
      <div className="an-fill" />
      {ticks.map((k) => (
        <div key={k.label} className="an-tick" data-on={s >= k.at} style={{ '--t': `${k.at}%` } as React.CSSProperties}>
          <span>{k.label}<small>{k.at}%</small></span>
        </div>
      ))}
    </div>
  )
}
