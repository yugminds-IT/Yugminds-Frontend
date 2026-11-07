import Droid from './Droid'

export interface DueNode {
  label: string
  count: number
  late?: boolean
  today?: boolean
}

/** The next seven days as a runway. The droid waits on today; each node counts what is due that day. */
export default function DueRun({ nodes }: { nodes: DueNode[] }) {
  const todayIdx = Math.max(0, nodes.findIndex((n) => n.today))
  return (
    <div className="sd-run" style={{ '--n': nodes.length, '--p': (todayIdx + 0.5) / nodes.length, '--spin': `${(todayIdx + 0.5) * 520}deg` } as React.CSSProperties}>
      <div className="sd-droid"><Droid /></div>
      <div className="sd-run-line" />
      <ol className="sd-days" aria-label="Assignments due each day">
        {nodes.map((n, i) => (
          <li key={i} className="sd-day" data-active={n.count > 0 && !n.late} data-late={n.late && n.count > 0} data-today={n.today}>
            <span className="sd-node" aria-label={`${n.count} due ${n.label}`}>{n.count > 0 ? (n.count > 9 ? '9+' : n.count) : null}</span>
            <span>{n.label}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
