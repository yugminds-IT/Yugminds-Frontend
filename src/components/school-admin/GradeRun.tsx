import Droid from '../portal/Droid'
import { gradeShort } from './student-utils'

export interface GradeStrength {
  name: string
  /** undefined while the count is loading */
  count: number | undefined
}

/**
 * Class strength as a track: one node per grade with its student count, the droid on the grade you
 * are looking at. Pressing a node filters the list to that grade; pressing it again clears it.
 */
export default function GradeRun({
  grades,
  selected,
  onSelect,
  total,
  matching,
}: {
  grades: GradeStrength[]
  /** the selected grade name, or "all" */
  selected: string
  onSelect: (grade: string) => void
  total: number | undefined
  matching: number | undefined
}) {
  if (grades.length === 0) {
    return (
      <div className="sd-run-card sm-run-empty">
        <b>No grades set up yet</b>
        <span>Once your school has grades, you will see how many students are in each one here.</span>
      </div>
    )
  }
  const n = grades.length
  const sel = grades.findIndex((g) => g.name === selected)
  const at = sel >= 0 ? sel : 0
  const lastWithStudents = grades.reduce((acc, g, i) => ((g.count ?? 0) > 0 ? i : acc), -1)

  return (
    <div className="sd-run-card">
      <div
        className="sd-run sm-run"
        data-dense={n > 8}
        style={{ '--n': n, '--p': (at + 0.5) / n, '--spin': `${(at + 0.5) * 520}deg` } as React.CSSProperties}
      >
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        {lastWithStudents > 0 && <div className="sd-run-fill" style={{ '--f': lastWithStudents / Math.max(1, n - 1) } as React.CSSProperties} />}
        <ol className="sd-days" aria-label="Students in each grade">
          {grades.map((g) => (
            <li key={g.name} className="sd-day" data-active={(g.count ?? 0) > 0} data-today={g.name === selected} data-future={g.count === 0}>
              <button
                type="button"
                className="sm-node"
                aria-pressed={g.name === selected}
                aria-label={`${g.name}, ${g.count == null ? 'loading' : `${g.count} ${g.count === 1 ? 'student' : 'students'}`}`}
                onClick={() => onSelect(g.name === selected ? 'all' : g.name)}
              >
                <span className="sd-node">{gradeShort(g.name)}</span>
                <span>{g.count ?? '–'}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{matching ?? total ?? '–'}<small>{matching === 1 ? 'student' : 'students'}{selected !== 'all' ? ` in ${selected}` : ''}</small></b>
        {selected !== 'all' ? (
          <button type="button" className="sm-reset" onClick={() => onSelect('all')}>Show all grades</button>
        ) : (
          <span>Pick a grade to filter</span>
        )}
      </div>
    </div>
  )
}
