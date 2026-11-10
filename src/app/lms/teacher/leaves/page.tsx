"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, CalendarPlus } from "lucide-react";
import { useTeacherSchool } from "../context";
import { useTeacherLeaves, useTeacherDayStatus, useCancelLeave } from "@/hooks/useTeacherData";
import { toast } from "@/components/ui/toast";
import ConfirmModal from "@/components/portal/ConfirmModal";
import LeaveStages from "@/components/school-admin/LeaveStages";
import LeaveRun from "@/components/teacher/leaves/LeaveRun";
import ApplyModal from "@/components/teacher/leaves/ApplyModal";
import { daysBetween, daysWithin, rangeLabel, statusOf, STATUS_LABEL, waitingHint, type Leave, type LeaveStatus } from "@/components/teacher/leaves/utils";
import { plural } from "@/components/teacher/overview/utils";
import "@/components/school-admin/overview.css"; // hero meta, two-column grid
import "@/components/school-admin/teachers.css"; // emergency approval steps
import "@/components/teacher/overview/overview.css"; // status track
import "@/components/teacher/leaves/leaves.css";

const PAGE = 8;

/**
 * Leave requests. Approvals come from the school admin and the admin (either can decide); an emergency leave needs
 * both, in order. Approved leave shows as leave in attendance.
 */
export default function LeavesPage() {
  const params = useSearchParams();
  const { selectedSchool, schools } = useTeacherSchool();
  const [apply, setApply] = useState(params.get("apply") === "1");
  const [filter, setFilter] = useState<LeaveStatus | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [cancelId, setCancelId] = useState<string | null>(null);

  // History across every assigned school: a request is always filed against one school, but you can have several.
  const leavesQ = useTeacherLeaves();
  const cancelLeave = useCancelLeave();
  const { data: serverDay } = useTeacherDayStatus();
  const today = serverDay?.date ?? new Date().toLocaleDateString("en-CA");

  const leaves = useMemo(() => ((leavesQ.data ?? []) as Leave[]).slice().sort((a, b) => b.start_date.localeCompare(a.start_date)), [leavesQ.data]);
  const counts = useMemo(() => {
    const c: Record<LeaveStatus, number> = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    leaves.forEach((l) => { c[statusOf(l)]++; });
    return c;
  }, [leaves]);
  const visible = filter ? leaves.filter((l) => statusOf(l) === filter) : leaves;
  const schoolName = (id?: string) => schools.find((s) => s.id === id)?.name;

  // Pending any time, or approved but not started yet. The server enforces the same.
  const canCancel = (l: Leave) => statusOf(l) === "pending" || (statusOf(l) === "approved" && l.start_date > today);

  /* ───────── numbers ───────── */
  const year = today.slice(0, 4);
  const approved = leaves.filter((l) => statusOf(l) === "approved");
  const daysThisYear = approved.reduce((n, l) => n + daysWithin(l, `${year}-01-01`, `${year}-12-31`), 0);
  const daysAhead = approved.reduce((n, l) => n + daysWithin(l, today, "9999-12-31"), 0);
  const rejectedThisYear = leaves.filter((l) => statusOf(l) === "rejected" && l.start_date.startsWith(year)).length;
  const next = approved.filter((l) => l.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date))[0];

  const ledger = [
    { label: "Days approved this year", value: daysThisYear, hint: daysThisYear ? "Counting every approved day" : "No approved leave yet" },
    { label: "Days still to come", value: daysAhead, hint: next ? `Next: ${rangeLabel(next.start_date, next.end_date)}` : "Nothing planned" },
    { label: "Waiting for approval", value: counts.pending, hint: counts.pending ? "Not decided yet" : "Nothing waiting" },
    { label: "Rejected this year", value: rejectedThisYear, hint: rejectedThisYear ? "Ask your admin why" : "None rejected" },
  ];

  let status: React.ReactNode;
  if (leavesQ.isError) status = "Your requests did not load. Try again.";
  else if (leavesQ.isLoading) status = "Loading your requests…";
  else if (counts.pending > 0) status = <><strong>{plural(counts.pending, "request")}</strong> {counts.pending === 1 ? "is" : "are"} waiting for approval.</>;
  else if (next) status = <><strong>Next leave: {rangeLabel(next.start_date, next.end_date)}.</strong> Approved.</>;
  else if (leaves.length === 0) status = "You have not asked for leave yet.";
  else status = "No leave is planned right now.";

  const caption = filter ? `Showing ${STATUS_LABEL[filter].toLowerCase()} only` : "Press a stop to filter";

  const confirmCancel = async () => {
    if (!cancelId) return;
    try {
      await cancelLeave.mutateAsync(cancelId);
      toast.success("Leave request cancelled.");
      setCancelId(null);
    } catch (error) {
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || "The request could not be cancelled.");
    }
  };

  if (schools.length === 0) {
    return (
      <div className="sd-page">
        <section className="sd-panel"><div className="sd-empty"><b>No school assigned</b><p>You are not assigned to any school yet. Ask your admin to add you to one.</p></div></section>
      </div>
    );
  }

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="lv-title">
        <div className="sd-hero-copy">
          <h1 id="lv-title" className="mc-hero-title">Leave requests</h1>
          <p className="sd-where">{schools.length > 1 ? `All ${schools.length} of your schools` : schools[0]?.name}</p>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            <button className="sd-btn sd-btn--amber" onClick={() => setApply(true)}><CalendarPlus aria-hidden="true" />Apply for leave</button>
            <Link href="/lms/teacher/calendar" className="sd-btn sd-btn--ghost-dark"><CalendarDays aria-hidden="true" />School calendar</Link>
          </div>
        </div>
        {leavesQ.isLoading ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : leavesQ.isError ? (
          <div className="sd-run-card to-run-empty">
            <b>Your requests did not load</b>
            <button className="sd-btn sd-btn--amber" onClick={() => void leavesQ.refetch()}>Try again</button>
          </div>
        ) : (
          <LeaveRun counts={counts} selected={filter} onSelect={(s) => { setFilter(filter === s ? null : s); setShown(PAGE); }} caption={caption} />
        )}
      </section>

      <div className="sd-ledger" role="group" aria-label="Your leave">
        {ledger.map((m) => (
          <div key={m.label}>
            <span className="sd-l">{m.label}</span>
            {leavesQ.isLoading ? <span className="sd-skel" style={{ height: "2.2rem", width: "4.5rem" }} /> : <b className="sd-n">{leavesQ.isError ? "–" : m.value}</b>}
            <small>{m.hint}</small>
          </div>
        ))}
      </div>

      <div className="so-grid">
        <div className="so-col">
          <section className="sd-panel as-list lv-list" aria-labelledby="lv-requests">
            <div className="sd-panel-head" style={{ margin: 0, padding: "1.25rem 1.25rem 0.9rem" }}>
              <div><h2 id="lv-requests">{filter ? `${STATUS_LABEL[filter]} requests` : "Your requests"}</h2><p>{filter ? `${visible.length} of ${leaves.length}` : "Newest first"}</p></div>
              {filter && <button className="lv-clear" onClick={() => setFilter(null)}>Show all</button>}
            </div>
            {leavesQ.isLoading ? (
              <div style={{ padding: "0 1.25rem 1.25rem" }}><div className="sd-skel" /><div className="sd-skel" /></div>
            ) : leavesQ.isError ? (
              <div className="sd-empty" style={{ padding: "0 1.25rem 1.25rem" }}>
                <b>Could not load your requests</b>
                <p>Check your connection and try again.</p>
              </div>
            ) : visible.length === 0 ? (
              <div className="sd-empty" style={{ padding: "0 1.25rem 1.25rem" }}>
                <b>{filter ? `No ${STATUS_LABEL[filter].toLowerCase()} requests` : "No leave requests yet"}</b>
                <p>{filter ? "Nothing matches that stop." : "When you ask for leave, it shows up here with where it stands."}</p>
                {filter ? <button className="sd-btn sd-btn--line" onClick={() => setFilter(null)}>Show all</button> : <button className="sd-btn sd-btn--amber" onClick={() => setApply(true)}>Apply for leave</button>}
              </div>
            ) : (
              <>
                {visible.slice(0, shown).map((l) => {
                  const s = statusOf(l);
                  const hint = waitingHint(l);
                  const school = schools.length > 1 ? schoolName(l.school_id) : undefined;
                  return (
                    <article key={l.id} className="lv-row" data-s={s}>
                      <div className="lv-when">
                        <b>{rangeLabel(l.start_date, l.end_date)}</b>
                        <small>{plural(daysBetween(l.start_date, l.end_date), "day")}{school ? `, ${school}` : ""}</small>
                      </div>
                      <div className="lv-why">
                        {l.reason && <p>{l.reason}</p>}
                        {(l.is_emergency || l.substitute_required) && (
                          <span className="lv-tags">
                            {l.is_emergency && <span className="lv-tag" data-red="true">Emergency</span>}
                            {l.substitute_required && <span className="lv-tag">Needs a substitute</span>}
                          </span>
                        )}
                      </div>
                      <span className="lv-chip" data-s={s}>{STATUS_LABEL[s]}</span>
                      <span className="lv-acts">
                        {canCancel(l) && <button type="button" className="lv-cancel" onClick={() => setCancelId(l.id)}>Cancel request</button>}
                      </span>
                      {(l.is_emergency || hint) && (
                        <div className="lv-extra">
                          <LeaveStages leave={l as unknown as Parameters<typeof LeaveStages>[0]["leave"]} />
                          {hint && <p className="lv-hint">{hint}</p>}
                        </div>
                      )}
                    </article>
                  );
                })}
                {visible.length > shown && (
                  <div className="lv-more"><button className="sd-btn sd-btn--line" onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, visible.length - shown)} more</button></div>
                )}
              </>
            )}
          </section>
        </div>

        <div className="so-col">
          <section className="sd-panel" aria-labelledby="lv-how">
            <div className="sd-panel-head"><div><h2 id="lv-how">How leave works</h2></div></div>
            <ul className="lv-how">
              <li>Send regular leave before 8 PM IST. It cannot start in the past.</li>
              <li>Your school admin or the admin can approve or reject it.</li>
              <li>An emergency skips the cutoff, can start 2 days back, and needs your school admin first, then the admin.</li>
              <li>Approved leave shows as leave in your attendance, whatever you report.</li>
              <li>You can cancel a waiting request, or approved leave that has not started.</li>
            </ul>
          </section>
        </div>
      </div>

      {apply && (
        <ApplyModal
          schools={schools}
          defaultSchoolId={selectedSchool?.id}
          serverToday={today}
          onClose={() => setApply(false)}
          onSent={(emergency) => {
            setApply(false);
            toast.success(emergency ? "Emergency leave sent. Your school admin approves first, then the admin. Track both here." : "Leave request sent. Your school admin and the admin will review it.");
          }}
        />
      )}

      <ConfirmModal
        open={cancelId !== null}
        onClose={() => setCancelId(null)}
        title="Cancel this leave request?"
        subtitle="It is withdrawn, and your school admin and the admin are told."
        confirmLabel="Cancel request"
        cancelLabel="Keep it"
        danger
        busy={cancelLeave.isPending}
        onConfirm={() => void confirmCancel()}
      />
    </div>
  );
}
