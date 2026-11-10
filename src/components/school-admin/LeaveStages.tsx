import type { LeaveRequest } from './teacher-utils'

type Stage = 'pending' | 'approved' | 'rejected'
const WORD: Record<Stage, string> = { pending: 'Waiting', approved: 'Approved', rejected: 'Rejected' }

/**
 * Emergency leave needs two approvals in order: the school admin, then the main admin.
 * (The order is real, so the steps are numbered.) Renders nothing for ordinary leave.
 */
export default function LeaveStages({ leave }: { leave: Pick<LeaveRequest, 'is_emergency' | 'status' | 'school_admin_status' | 'admin_status'> }) {
  if (!leave.is_emergency) return null
  const rejected = (leave.status ?? '').toLowerCase() === 'rejected'
  const school: Stage = leave.school_admin_status ?? 'pending'
  // When the school admin rejects, the main admin never gets to decide.
  const admin: Stage | null = rejected && school === 'rejected' ? null : leave.admin_status ?? 'pending'
  return (
    <div className="tm-stages" role="group" aria-label="Emergency leave approvals">
      <b>Emergency leave needs two approvals, in order</b>
      <ol>
        <li data-s={school}><span>School admin</span><i>{WORD[school]}</i></li>
        <li data-s={admin ?? 'none'}><span>Main admin</span><i>{admin ? WORD[admin] : 'Not needed'}</i></li>
      </ol>
    </div>
  )
}
