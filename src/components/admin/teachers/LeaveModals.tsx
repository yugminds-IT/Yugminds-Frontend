"use client";

import { useState } from "react";
import { CalendarOff, Check, Loader2, X } from "lucide-react";
import Modal from "../../portal/Modal";
import { dateInput } from "../../school-admin/teacher-utils";
import { nameOf, schoolsOf, shortDate, type TeacherLike } from "./utils";
import type { AdminLeave } from "./LeavesTab";

/** Approve or reject one request, with an optional note the teacher can see. */
export function LeaveDecisionModal({
  leave,
  action,
  busy,
  remarks,
  onRemarks,
  onClose,
  onConfirm,
}: {
  leave: AdminLeave | null;
  action: "approve" | "reject";
  busy: boolean;
  remarks: string;
  onRemarks: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const approve = action === "approve";
  const who = leave?.profiles?.full_name || "The teacher";
  const range = leave ? `${shortDate(leave.start_date)}${leave.end_date !== leave.start_date ? ` to ${shortDate(leave.end_date)}` : ""}` : "";
  return (
    <Modal
      open={!!leave}
      onClose={() => { if (!busy) onClose(); }}
      title={approve ? "Approve this leave request?" : "Reject this leave request?"}
      subtitle={leave ? `${who}, ${range}` : undefined}
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={`sd-btn ${approve ? "sd-btn--amber" : "sd-btn--danger"}`} onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : approve ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
            {approve ? "Approve leave" : "Reject leave"}
          </button>
        </>
      }
    >
      <div className="sd-field-wrap">
        <label htmlFor="lm-remarks">Note for the teacher <small>(optional)</small></label>
        <textarea id="lm-remarks" className="sd-field" rows={3} placeholder="Add a reason or instructions" value={remarks} onChange={(e) => onRemarks(e.target.value)} />
      </div>
    </Modal>
  );
}

/** File an emergency leave on a teacher's behalf. Counts as the admin's approval; the school admin still has to approve. */
export function EmergencyLeaveModal({
  open,
  teachers,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  teachers: TeacherLike[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (v: { teacher_id: string; school_id: string; start_date: string; end_date: string; reason: string }) => void;
}) {
  const [teacherId, setTeacherId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const teacher = teachers.find((t) => String(t.id) === teacherId);
  const schools = teacher ? schoolsOf(teacher) : [];
  const school = schoolId || (schools.length === 1 ? schools[0].id : "");
  const ready = !!teacherId && !!school && !!start && !!end && !!reason.trim() && end >= start;
  const submit = () => onSubmit({ teacher_id: teacherId, school_id: school, start_date: start, end_date: end, reason: reason.trim() });

  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose(); }}
      title="Record emergency leave"
      subtitle="Use this when a teacher cannot ask for leave themselves."
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="sd-btn sd-btn--amber" disabled={busy || !ready} onClick={submit}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CalendarOff aria-hidden="true" />}
            Record leave
          </button>
        </>
      }
    >
      <form className="sm-form" onSubmit={(e) => { e.preventDefault(); if (ready && !busy) submit(); }}>
        <p className="nt-summary">It counts as your approval. The school admin must approve it too before the days are marked as leave. It can start today or up to 2 days back.</p>
        <div className="sd-field-wrap">
          <label htmlFor="ae-teacher">Teacher</label>
          <select id="ae-teacher" className="sd-field" value={teacherId} onChange={(e) => { setTeacherId(e.target.value); setSchoolId(""); }}>
            <option value="">Choose a teacher</option>
            {teachers.map((t) => <option key={String(t.id)} value={String(t.id)}>{nameOf(t)}</option>)}
          </select>
        </div>
        <div className="sd-field-wrap">
          <label htmlFor="ae-school">School</label>
          <select id="ae-school" className="sd-field" value={school} disabled={!teacherId} onChange={(e) => setSchoolId(e.target.value)}>
            <option value="">{teacherId ? (schools.length ? "Choose a school" : "This teacher has no school yet") : "Choose a teacher first"}</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="sm-two">
          <div className="sd-field-wrap">
            <label htmlFor="ae-start">First day</label>
            <input id="ae-start" type="date" className="sd-field" min={dateInput(-2)} value={start} onChange={(e) => { setStart(e.target.value); if (end && e.target.value > end) setEnd(""); }} />
          </div>
          <div className="sd-field-wrap">
            <label htmlFor="ae-end">Last day</label>
            <input id="ae-end" type="date" className="sd-field" min={start || dateInput(-2)} value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="sd-field-wrap">
          <label htmlFor="ae-reason">Reason</label>
          <textarea id="ae-reason" className="sd-field" rows={3} placeholder="What happened?" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
