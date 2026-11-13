'use client'

import Link from 'next/link'
import { AlertCircle, Check, ChevronRight, Clock, Lock, RotateCcw } from 'lucide-react'

export type RowState = 'todo' | 'submitted' | 'graded' | 'late'

export interface AssignmentRowData {
  id: string
  title: string
  sub?: string
  href: string
  state: RowState
  dueDate?: string
  duePhase?: string
  daysUntilDue?: number | null
  /** true once something has been handed in, so the due chip stops nagging */
  handedIn?: boolean
  marks?: number
  score?: number | null
  locked?: boolean
  unlocksInDays?: number | null
  retake?: 'granted' | 'available' | null
}

const TAG: Record<RowState, string> = { todo: 'To do', submitted: 'Handed in', graded: 'Graded', late: 'Overdue' }
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

function DueChip({ a }: { a: Pick<AssignmentRowData, 'dueDate' | 'duePhase' | 'daysUntilDue' | 'handedIn' | 'state'> }) {
  if (!a.dueDate || a.daysUntilDue == null) return <span className="as-due">No due date</span>
  const date = new Date(a.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  if (a.handedIn) return <span className="as-due">Due {date}</span>
  if (a.duePhase === 'closed') return <span className="as-due" data-t="late">Closed</span>
  if (a.state === 'late') return <span className="as-due" data-t="late">{plural(Math.abs(a.daysUntilDue), 'day')} late</span>
  if (a.daysUntilDue === 0) return <span className="as-due" data-t="soon">Due today</span>
  if (a.daysUntilDue <= 3) return <span className="as-due" data-t="soon">Due in {plural(a.daysUntilDue, 'day')}</span>
  return <span className="as-due">Due {date}</span>
}

function Marker({ state, locked }: { state: RowState; locked?: boolean }) {
  return (
    <span className="as-mark" data-s={locked ? 'locked' : state} aria-hidden="true">
      {locked ? <Lock /> : state === 'graded' ? <Check /> : state === 'submitted' ? <Clock /> : state === 'late' ? <AlertCircle /> : null}
    </span>
  )
}

/** One assignment as a row: marker, title, due, score and status. Used by the list and by-course pages. */
export default function AssignmentRow({ a }: { a: AssignmentRowData }) {
  if (a.locked) {
    return (
      <div className="as-row" data-locked="true" title={`Opens in ${plural(a.unlocksInDays ?? 0, 'day')}`}>
        <Marker state={a.state} locked />
        <div className="as-main">
          <p className="as-title">{a.title}</p>
          {a.sub && <p className="as-sub">{a.sub}</p>}
        </div>
        <span className="as-tag" data-s="locked">Opens in {plural(a.unlocksInDays ?? 0, 'day')}</span>
      </div>
    )
  }
  const graded = a.state === 'graded' && a.score != null
  return (
    <Link href={a.href} className="as-row">
      <Marker state={a.state} />
      <div className="as-main">
        <p className="as-title">
          {a.title}
          {a.retake && (
            <span className="as-retake" title={a.retake === 'granted' ? 'Your teacher gave you another try' : 'You can try this again'}>
              <RotateCcw aria-hidden="true" />{a.retake === 'granted' ? 'Another try' : 'Try again'}
            </span>
          )}
        </p>
        {a.sub && <p className="as-sub">{a.sub}</p>}
        <p className="as-due-m"><DueChip a={a} /></p>
      </div>
      <span className="as-due-d"><DueChip a={a} /></span>
      <span className="as-score">
        {graded ? <b>{Math.round(Number(a.score))}%</b> : a.marks != null ? <>{a.marks} pts</> : null}
      </span>
      <span className="as-tag" data-s={a.state}>{TAG[a.state]}</span>
      <ChevronRight className="as-go" aria-hidden="true" />
    </Link>
  )
}
