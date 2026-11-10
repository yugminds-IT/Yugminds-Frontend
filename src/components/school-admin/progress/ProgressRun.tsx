import Droid from '../../portal/Droid'

export type Stage = 'none' | 'started' | 'half' | 'done'
export const STAGES: Stage[] = ['none', 'started', 'half', 'done']
export const STAGE_LABEL: Record<Stage, string> = {
  none: 'Not started',
  started: 'Under half',
  half: 'Over half',
  done: 'Finished',
}

/** 0 is "not started", 1 to 49 "under half", 50 to 99 "over half", 100 "finished". */
export function stageOf(progress: number): Stage {
  return progress >= 100 ? 'done' : progress >= 50 ? 'half' : progress > 0 ? 'started' : 'none'
}

/**
 * How far along students are, as a track from "not started" to "finished" with a count at each stage.
 * The droid waits at the biggest group, or at the stage you filtered to. Pressing a stage filters.
 */
export default function ProgressRun({
  counts,
  selected,
  onSelect,
  average,
  averageLabel = 'school average',
}: {
  counts: Record<Stage, number>
  selected: Stage | 'all'
  onSelect: (s: Stage | 'all') => void
  average: number | null
  averageLabel?: string
}) {
  const biggest = STAGES.reduce((best, s, i) => (counts[s] > counts[STAGES[best]] ? i : best), 0)
  const sel = STAGES.indexOf(selected as Stage)
  const at = sel >= 0 ? sel : biggest
  const n = STAGES.length
  return (
    <div className="sd-run-card">
      <div className="sd-run sp-run" style={{ '--n': n, '--p': (at + 0.5) / n, '--spin': `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Students by how far they have got">
          {STAGES.map((s) => (
            <li key={s} className="sd-day" data-active={counts[s] > 0} data-today={selected === s} data-future={counts[s] === 0}>
              <button
                type="button"
                className="sp-node"
                aria-pressed={selected === s}
                aria-label={`${STAGE_LABEL[s]}: ${counts[s]} ${counts[s] === 1 ? 'student' : 'students'}`}
                onClick={() => onSelect(selected === s ? 'all' : s)}
              >
                <span className="sd-node">{counts[s]}</span>
                <span>{STAGE_LABEL[s]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{average == null ? '–' : `${average}%`}<small>{averageLabel}</small></b>
        {selected !== 'all' ? (
          <button type="button" className="sm-reset" onClick={() => onSelect('all')}>Show every student</button>
        ) : (
          <span>Pick a stage to filter</span>
        )}
      </div>
    </div>
  )
}
