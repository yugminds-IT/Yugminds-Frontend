"use client";

import { Check, CalendarOff, X } from "lucide-react";
import { ChipGroup, initialsOf } from "../../portal/notifications";
import LeaveStages from "../../school-admin/LeaveStages";
import { plural, shortDate } from "./utils";

export interface AdminLeave {
  id: string;
  leave_type?: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason?: string;
  status: "Pending" | "Approved" | "Rejected" | "Cancelled";
  approved_at?: string;
  rejected_at?: string;
  reviewer?: { full_name?: string } | null;
  substitute_required?: boolean;
  is_emergency?: boolean;
  school_admin_status?: "pending" | "approved" | "rejected";
  admin_status?: "pending" | "approved" | "rejected";
  admin_remarks?: string;
  profiles?: { full_name?: string; email?: string };
  schools?: { name?: string };
}

export type LeaveFilter = "all" | "Pending" | "Approved" | "Rejected";

const dates = (l: AdminLeave) => `${shortDate(l.start_date)}${l.end_date && l.end_date !== l.start_date ? ` to ${shortDate(l.end_date)}` : ""}`;

export default function LeavesTab({
  leaves,
  counts,
  filter,
  onFilter,
  busyId,
  onApprove,
  onReject,
  onRecord,
}: {
  leaves: AdminLeave[];
  counts: { all: number; Pending: number; Approved: number; Rejected: number };
  filter: LeaveFilter;
  onFilter: (f: LeaveFilter) => void;
  busyId: string | null;
  onApprove: (l: AdminLeave) => void;
  onReject: (l: AdminLeave) => void;
  onRecord: () => void;
}) {
  return (
    <>
      <div className="at-bar">
        <ChipGroup
          label="Show leave requests"
          value={filter}
          options={[["all", `All (${counts.all})`], ["Pending", `Pending (${counts.Pending})`], ["Approved", `Approved (${counts.Approved})`], ["Rejected", `Rejected (${counts.Rejected})`]] as const}
          onChange={onFilter}
        />
        <button className="sd-btn sd-btn--line at-bar-end" onClick={onRecord}><CalendarOff aria-hidden="true" />Record emergency leave</button>
      </div>

      {leaves.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>{filter === "all" ? "No leave requests yet" : `No ${filter.toLowerCase()} leave requests`}</b>
            <p>{filter === "Pending" ? "Every request has been decided." : "Leave requests from teachers show up here."}</p>
            {filter !== "all" && <button className="sd-btn sd-btn--line" onClick={() => onFilter("all")}>See all requests</button>}
          </div>
        </section>
      ) : (
        <section className="sd-panel as-list mc-swap" aria-label="Leave requests">
          {leaves.map((l) => {
            const name = l.profiles?.full_name || "Unknown teacher";
            const pending = l.status === "Pending";
            const waitingSchool = !!l.is_emergency && pending && l.admin_status === "approved";
            const needsSchoolFirst = !!l.is_emergency && pending && l.school_admin_status !== "approved" && !waitingSchool;
            const by = l.reviewer?.full_name;
            return (
              <article key={l.id} className="tm-leave" data-pending={pending} data-emergency={!!l.is_emergency}>
                <span className="sd-avatar" aria-hidden="true">{initialsOf(name)}</span>
                <div className="tm-leave-main">
                  <div className="tm-leave-who"><b>{name}</b><small>{[l.profiles?.email, l.schools?.name].filter(Boolean).join(" · ")}</small></div>
                  <div className="tm-leave-dates">
                    <b>{dates(l)}</b>
                    <span className="sm-muted">{plural(l.total_days || 0, "day")}</span>
                    {l.leave_type && !(l.is_emergency && l.leave_type.toLowerCase() === "emergency") && <span className="sm-chip">{l.leave_type}</span>}
                    {l.is_emergency && <span className="sm-chip" data-tone="red">Emergency</span>}
                    {l.substitute_required && <span className="sm-chip">Needs a substitute</span>}
                  </div>
                  {l.reason && <p className="tm-leave-reason">{l.reason}</p>}
                  <LeaveStages leave={l} />
                  {l.status === "Approved" && l.approved_at && <p className="tm-leave-by">Approved{by ? ` by ${by}` : ""} on {shortDate(l.approved_at)}</p>}
                  {l.status === "Rejected" && l.rejected_at && <p className="tm-leave-by">Rejected{by ? ` by ${by}` : ""} on {shortDate(l.rejected_at)}</p>}
                  {l.admin_remarks && <p className="tm-leave-by">Remarks: {l.admin_remarks}</p>}
                </div>
                <div className="tm-leave-act">
                  {waitingSchool && <span className="tm-wait">Waiting for the school admin</span>}
                  {pending && !waitingSchool && (
                    <>
                      {needsSchoolFirst && <span className="tm-wait">The school admin approves first</span>}
                      <button className="sd-btn sd-btn--line tm-reject" onClick={() => onReject(l)} disabled={busyId === l.id}><X aria-hidden="true" />Reject</button>
                      <button className="sd-btn sd-btn--amber" onClick={() => onApprove(l)} disabled={busyId === l.id || needsSchoolFirst}><Check aria-hidden="true" />Approve</button>
                    </>
                  )}
                  {l.status === "Approved" && <span className="sm-chip" data-tone="done">Approved</span>}
                  {l.status === "Rejected" && <span className="sm-chip" data-tone="red">Rejected</span>}
                  {l.status === "Cancelled" && <span className="sm-chip" data-on="false">Cancelled by teacher</span>}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
