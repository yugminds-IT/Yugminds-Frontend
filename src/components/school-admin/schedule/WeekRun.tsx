import Droid from '../../portal/Droid'

export interface RunDay {
  name: string
  count: number
  open: boolean
  today: boolean
}

/**
 * The school week as a track: one node per weekday with its class count, the droid on the day you
 * are looking at (today by default). Pressing a day focuses the timetable on it; again to clear.
 */
export default function WeekRun({
  days,
  focus,
  onFocus,
  total,
}: {
  days: RunDay[]
  /** a weekday name, or "all" */
  focus: string
  onFocus: (day: string) => void
  total: number
}) {
  const n = Math.max(1, days.length)
  const focused = days.findIndex((d) => d.name === focus)
  const todayIdx = days.findIndex((d) => d.today)
  const at = focused >= 0 ? focused : todayIdx >= 0 ? todayIdx : 0
  return (
    <div className="sd-run-card">
      <div className="sd-run ts-run" style={{ '--n': n, '--p': (at + 0.5) / n, '--spin': `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Classes on each day of the week">
          {days.map((d) => (
            <li key={d.name} className="sd-day" data-active={d.open && d.count > 0} data-today={d.name === focus || (focus === 'all' && d.today)} data-future={!d.open}>
              <button
                type="button"
                className="ts-node"
                aria-pressed={d.name === focus}
                disabled={!d.open}
                aria-label={`${d.name}: ${d.open ? `${d.count} ${d.count === 1 ? 'class' : 'classes'}` : 'closed'}`}
                onClick={() => onFocus(d.name === focus ? 'all' : d.name)}
              >
                <span className="sd-node">{d.open ? d.count : '–'}</span>
                <span>{d.name.slice(0, 3)}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{total}<small>{total === 1 ? 'class a week' : 'classes a week'}</small></b>
        {focus !== 'all' ? (
          <button type="button" className="sm-reset" onClick={() => onFocus('all')}>Show the whole week</button>
        ) : (
          <span>Pick a day to focus</span>
        )}
      </div>
    </div>
  )
}
