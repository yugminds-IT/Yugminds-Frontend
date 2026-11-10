import Droid from '../../portal/Droid'
import type { CourseStatus } from './types'

const ORDER: CourseStatus[] = ['Draft', 'Published', 'Archived']

/**
 * A course's life as a track: Draft, then Published, then Archived, with how many courses sit at each.
 * The droid waits at the stage you filtered to, or at Published. Pressing a stage filters the list.
 */
export default function StatusRun({
  counts,
  selected,
  onSelect,
  average,
}: {
  counts: Record<CourseStatus, number>
  selected: CourseStatus | 'all'
  onSelect: (s: CourseStatus | 'all') => void
  /** average progress over courses that have students, or null */
  average: number | null
}) {
  const sel = ORDER.indexOf(selected as CourseStatus)
  const at = sel >= 0 ? sel : 1
  const n = ORDER.length
  return (
    <div className="sd-run-card">
      <div className="sd-run cr-run" style={{ '--n': n, '--p': (at + 0.5) / n, '--spin': `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Courses by stage">
          {ORDER.map((s) => (
            <li key={s} className="sd-day" data-active={counts[s] > 0} data-today={selected === s} data-future={counts[s] === 0}>
              <button
                type="button"
                className="cr-node"
                aria-pressed={selected === s}
                aria-label={`${s}: ${counts[s]} ${counts[s] === 1 ? 'course' : 'courses'}`}
                onClick={() => onSelect(selected === s ? 'all' : s)}
              >
                <span className="sd-node">{counts[s]}</span>
                <span>{s}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{average == null ? '–' : `${average}%`}<small>average progress</small></b>
        {selected !== 'all' ? (
          <button type="button" className="sm-reset" onClick={() => onSelect('all')}>Show all courses</button>
        ) : (
          <span>Pick a stage to filter</span>
        )}
      </div>
    </div>
  )
}
