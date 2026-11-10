"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "../../portal/Modal";
import { requestClose } from "@/hooks/useUnsavedCloseGuard";
import { formatGradeSection } from "@/hooks/useTeacherData";
import { STATUS_LABEL, STATUS_ORDER, longDate, schoolName, statusOf, teacherName, type ReportStatus, type TeacherReport } from "./types";

/** Read one report and decide what happens to it: a status and an optional note for the teacher. */
export default function ReviewModal({
  report,
  onClose,
  onSave,
}: {
  report: TeacherReport;
  onClose: () => void;
  /** resolves true when saved */
  onSave: (status: ReportStatus, notes: string) => Promise<boolean>;
}) {
  const [status, setStatus] = useState<ReportStatus>(statusOf(report));
  const [notes, setNotes] = useState(report.admin_notes ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = status !== statusOf(report) || notes.trim() !== (report.admin_notes ?? "").trim();
  const close = () => { if (!busy) void requestClose(dirty, onClose); };
  const save = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await onSave(status, notes.trim());
    setBusy(false);
    if (ok) onClose();
  };
  const facts: [string, string][] = [
    ["Teacher", teacherName(report)],
    ["School", schoolName(report)],
    ["Class", formatGradeSection(report.grade, report.section) || "Not set"],
    ["Date", longDate(report.date)],
    ["Hours", `${report.duration_hours || 0}`],
    ["Students", `${report.student_count || 0}`],
  ];
  return (
    <Modal
      open
      onClose={close}
      wide
      title="Review report"
      subtitle={`${teacherName(report)}, ${longDate(report.date)}`}
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={close} disabled={busy}>Cancel</button>
          <button className="sd-btn sd-btn--amber" onClick={() => void save()} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}Save review
          </button>
        </>
      }
    >
      <div className="ar-review">
        <dl className="ar-facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        <section><h3>Topics taught</h3><p className="ar-text">{report.topics_taught || "None listed"}</p></section>
        {report.activities && <section><h3>Activities</h3><p className="ar-text">{report.activities}</p></section>}
        {report.notes && <section><h3>Teacher&apos;s notes</h3><p className="ar-text">{report.notes}</p></section>}
        <div className="sm-two">
          <div className="sd-field-wrap">
            <label htmlFor="ar-status">Status</label>
            <select id="ar-status" className="sd-field" value={status} onChange={(e) => setStatus(e.target.value as ReportStatus)}>
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        </div>
        <div className="sd-field-wrap">
          <label htmlFor="ar-notes">Your note <small>(optional)</small></label>
          <textarea id="ar-notes" className="sd-field" rows={3} placeholder="Add a note for this report" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
