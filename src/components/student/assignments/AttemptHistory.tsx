/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

/** Every try at an assignment: number, date, score and status. */
export default function AttemptHistory({ attempts, note }: { attempts: any[]; note?: string }) {
  return (
    <section>
      <h2 className="as-h2">Your tries</h2>
      <div className="as-table-wrap">
        <table className="as-table">
          <thead>
            <tr><th>Try</th><th>Handed in</th><th className="r">Score</th><th className="r">Status</th></tr>
          </thead>
          <tbody>
            {attempts.map((a: any) => (
              <tr key={String(a.id)}>
                <td>#{a.attempt_number ?? '—'}</td>
                <td>{a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</td>
                <td className="r"><b>{a.score != null ? `${a.score}/${a.max_score ?? '—'}` : '—'}</b></td>
                <td className="r"><span className="as-tag" data-s={a.status === 'graded' ? 'graded' : 'submitted'}>{a.status === 'graded' ? 'Graded' : a.status === 'submitted' ? 'Handed in' : String(a.status ?? '—')}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <p className="as-fine">{note}</p>}
    </section>
  )
}
