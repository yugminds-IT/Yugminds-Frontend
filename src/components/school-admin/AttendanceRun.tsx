import Droid from '../portal/Droid'
import { BAND_LABEL, type AttendanceBand } from './teacher-utils'

const ORDER: AttendanceBand[] = ['low', 'watch', 'good', 'none']

/**
 * How many teachers fall in each attendance band, as a track. The droid sits on the band you are
 * looking at (or the biggest one). Pressing a band filters the list to it; pressing it again clears.
 */
export default function AttendanceRun({
  counts,
  selected,
  onSelect,
  average,
}: {
  counts: Record<AttendanceBand, number>
  selected: AttendanceBand | 'all'
  onSelect: (band: AttendanceBand | 'all') => void
  /** average over teachers that have attendance recorded; null when nobody does */
  average: number | null
}) {
  const biggest = ORDER.reduce((best, b, i) => (counts[b] > counts[ORDER[best]] ? i : best), 2)
  const sel = ORDER.indexOf(selected as AttendanceBand)
  const at = sel >= 0 ? sel : biggest
  const n = ORDER.length

  return (
    <div className="sd-run-card">
      <div
        className="sd-run tm-run"
        style={{ '--n': n, '--p': (at + 0.5) / n, '--spin': `${(at + 0.5) * 520}deg` } as React.CSSProperties}
      >
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Teachers by attendance over the last 30 days">
          {ORDER.map((b) => (
            <li key={b} className="sd-day" data-active={counts[b] > 0 && b !== 'low'} data-late={b === 'low' && counts[b] > 0} data-today={selected === b} data-future={counts[b] === 0}>
              <button
                type="button"
                className="tm-node"
                aria-pressed={selected === b}
                aria-label={`${BAND_LABEL[b]}: ${counts[b]} ${counts[b] === 1 ? 'teacher' : 'teachers'}`}
                onClick={() => onSelect(selected === b ? 'all' : b)}
              >
                <span className="sd-node">{counts[b]}</span>
                <span>{BAND_LABEL[b]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{average == null ? '–' : `${average}%`}<small>average attendance</small></b>
        {selected !== 'all' ? (
          <button type="button" className="sm-reset" onClick={() => onSelect('all')}>Show all teachers</button>
        ) : (
          <span>Last 30 days. Pick a band to filter</span>
        )}
      </div>
    </div>
  )
}
