import { Check } from 'lucide-react'
import Droid from '../../portal/Droid'

export interface ReportDay {
  key: string
  /** "Tue 4" */
  label: string
  /** reports still waiting on a decision */
  pending: number
  /** all reports that day */
  total: number
}

/**
 * The last seven days as a track. Each node shows how many reports from that day are waiting for a
 * decision, or a tick once the day is fully reviewed. The droid waits at the oldest day with a
 * backlog. Pressing a day focuses the list on it; again to clear.
 */
export default function ReportsRun({
  days,
  focus,
  onFocus,
  waiting,
  older,
}: {
  days: ReportDay[]
  focus: string | null
  onFocus: (key: string | null) => void
  /** all reports waiting, any day */
  waiting: number
  /** waiting reports older than the track */
  older: number
}) {
  const n = days.length
  const focused = days.findIndex((d) => d.key === focus)
  const oldest = days.findIndex((d) => d.pending > 0)
  const at = focused >= 0 ? focused : oldest >= 0 ? oldest : n - 1
  return (
    <div className="sd-run-card">
      <div className="sd-run rp-run" style={{ '--n': n, '--p': (at + 0.5) / n, '--spin': `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Reports waiting, day by day, over the last week">
          {days.map((d) => (
            <li key={d.key} className="sd-day" data-active={d.pending > 0} data-today={d.key === focus} data-future={d.total === 0}>
              <button
                type="button"
                className="rp-node"
                aria-pressed={d.key === focus}
                aria-label={`${d.label}: ${d.total === 0 ? 'no reports' : d.pending > 0 ? `${d.pending} waiting for review` : 'all reviewed'}`}
                onClick={() => onFocus(d.key === focus ? null : d.key)}
              >
                <span className="sd-node">{d.total === 0 ? '–' : d.pending > 0 ? d.pending : <Check aria-hidden="true" />}</span>
                <span>{d.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{waiting}<small>{waiting === 1 ? 'report to review' : 'reports to review'}</small></b>
        {focus ? (
          <button type="button" className="sm-reset" onClick={() => onFocus(null)}>Show all days</button>
        ) : older > 0 ? (
          <span>{older} older than a week</span>
        ) : (
          <span>Pick a day to focus</span>
        )}
      </div>
    </div>
  )
}
