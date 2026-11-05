import { Badge } from "@/components/ui/badge";

type Stage = "pending" | "approved" | "rejected";

export interface EmergencyStageLeave {
  is_emergency?: boolean;
  status?: string;
  school_admin_status?: Stage;
  admin_status?: Stage;
}

const STYLE: Record<Stage, string> = {
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
};

/**
 * Emergency leave needs two sequential approvals (school admin, then admin).
 * Shows both so everyone — the teacher especially — sees who has approved and
 * who is still pending, and can contact them. Renders nothing for regular leave.
 */
export function EmergencyApprovalStages({
  leave,
  showHint = false,
}: {
  leave: EmergencyStageLeave;
  /** Teacher view: tell them who to contact. */
  showHint?: boolean;
}) {
  if (!leave.is_emergency) return null;
  const overallStatus = (leave.status ?? "").toLowerCase();
  const overallRejected = overallStatus === "rejected";
  const cancelled = overallStatus === "cancelled";
  const school = leave.school_admin_status ?? "pending";
  // If the leave was rejected at stage 1, stage 2 never got a decision.
  const admin = leave.admin_status ?? "pending";
  const hint =
    overallRejected || cancelled || (school === "approved" && admin === "approved")
      ? null
      : school !== "approved" && admin === "approved"
        ? "Approved by the Admin. Waiting for your School Admin — please contact them to request approval."
        : school !== "approved"
          ? "Waiting for your School Admin. Please contact them to request approval."
          : "Approved by your School Admin. Waiting for the Admin — please contact them to request approval.";
  return (
    <div className="mt-2 space-y-1 rounded-md border border-red-100 bg-red-50/60 p-2 text-xs">
      <div className="flex items-center gap-2">
        <Badge className="bg-red-600 text-white">Emergency</Badge>
        <span className="text-gray-600">Needs 2 approvals, in order</span>
      </div>
      <div className="flex items-center justify-between">
        <span>1. School Admin</span>
        <Badge className={STYLE[school]}>{school === "pending" ? "Pending" : school === "approved" ? "Approved" : "Rejected"}</Badge>
      </div>
      <div className="flex items-center justify-between">
        <span>2. Admin</span>
        <Badge className={STYLE[overallRejected && school === "rejected" ? "pending" : admin]}>
          {overallRejected && school === "rejected" ? "—" : admin === "pending" ? "Pending" : admin === "approved" ? "Approved" : "Rejected"}
        </Badge>
      </div>
      {showHint && hint && <p className="pt-1 text-red-700">{hint}</p>}
    </div>
  );
}
