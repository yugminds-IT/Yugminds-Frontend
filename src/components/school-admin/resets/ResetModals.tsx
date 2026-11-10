"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2, RefreshCw } from "lucide-react";
import Modal from "../../portal/Modal";
import { initialsOf } from "../../portal/notifications";
import { requestClose } from "@/hooks/useUnsavedCloseGuard";
import { generatePassword } from "../student-utils";
import { fullDate, nameOf, roleLabel, STATUS_LABEL, type ResetRequest } from "./types";

/** Who is asking, shown at the top of every dialog so nobody approves the wrong person. */
function Who({ r }: { r: ResetRequest }) {
  return (
    <div className="rs-who">
      <span className="sd-avatar" aria-hidden="true">{initialsOf(nameOf(r))}</span>
      <span><b>{nameOf(r)}</b><small>{r.email} · {roleLabel(r.user_role)}{r.schools?.name ? ` · ${r.schools.name}` : ""}</small></span>
    </div>
  );
}

const MIN_LENGTH = 6; // what the server accepts; the person must change it at first login anyway

/** Set a temporary password for someone who is locked out. After it is set, the password stays on screen to share. */
export function ApproveModal({
  request,
  onClose,
  onApprove,
}: {
  request: ResetRequest;
  onClose: () => void;
  /** resolves true when the server accepted it */
  onApprove: (password: string, notes: string) => Promise<boolean>;
}) {
  const [pw, setPw] = useState("");
  const [notes, setNotes] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const valid = pw.trim().length >= MIN_LENGTH;
  const dirty = !done && (pw.trim() !== "" || notes.trim() !== "");
  const close = () => { if (!busy) void requestClose(dirty, onClose); };

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const ok = await onApprove(pw.trim(), notes.trim());
    setBusy(false);
    if (ok) { setDone(true); setShow(true); }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pw.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* the password is on screen, so it can be selected by hand */ }
  };

  if (done) {
    return (
      <Modal open onClose={onClose} title="Password set" subtitle={`${nameOf(request)} has been told their request was approved.`}
        footer={<button className="sd-btn sd-btn--amber" onClick={onClose}>Done</button>}>
        <div className="rs-done">
          <p>Give them this password yourself. We do not show it again, and they must change it the first time they log in.</p>
          <div className="rs-pw"><code>{pw.trim()}</code>
            <button className="sd-btn sd-btn--line" onClick={copy}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? "Copied" : "Copy"}</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={close} title="Approve request" subtitle="Choose a temporary password. They will be asked to change it when they log in."
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={close} disabled={busy}>Cancel</button>
          <button className="sd-btn sd-btn--amber" onClick={() => void submit()} disabled={busy || !valid}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}Approve and set password
          </button>
        </>
      }>
      <form className="sm-form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Who r={request} />
        <div className="sd-field-wrap">
          <label htmlFor="sa-temp-password">Temporary password</label>
          <div className="st-input">
            <input id="sa-temp-password" type={show ? "text" : "password"} className="sd-field" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            <span className="st-input-r">
              <button type="button" className="st-eye" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>
                {show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </span>
          </div>
          <small className="rs-hint" data-ok={valid}>{valid ? "Good to go." : `Use at least ${MIN_LENGTH} characters.`}</small>
        </div>
        <div className="sm-pwacts">
          <button type="button" className="sd-btn sd-btn--line" onClick={() => { setPw(generatePassword()); setShow(true); }}><RefreshCw aria-hidden="true" />Generate one</button>
          <button type="button" className="sd-btn sd-btn--line" onClick={copy} disabled={!pw}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? "Copied" : "Copy"}</button>
        </div>
        <div className="sd-field-wrap">
          <label htmlFor="sa-notes">Note <span className="sm-muted">(optional)</span></label>
          <textarea id="sa-notes" className="sd-field" rows={3} maxLength={500} placeholder="Anything worth keeping with this request" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <small className="rs-hint">{notes.length}/500</small>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/** Turn a request down. The person is told, so a reason helps. */
export function RejectModal({
  request,
  onClose,
  onReject,
}: {
  request: ResetRequest;
  onClose: () => void;
  onReject: (notes: string) => Promise<boolean>;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => { if (!busy) void requestClose(notes.trim() !== "", onClose); };

  return (
    <Modal open onClose={close} title="Reject request" subtitle="They will be told it was rejected, along with your reason if you add one."
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={close} disabled={busy}>Cancel</button>
          <button className="sd-btn sd-btn--danger" disabled={busy} onClick={async () => { setBusy(true); const ok = await onReject(notes.trim()); setBusy(false); if (ok) onClose(); }}>
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}Reject request
          </button>
        </>
      }>
      <div className="sm-form">
        <Who r={request} />
        <div className="sd-field-wrap">
          <label htmlFor="sa-notes">Reason <span className="sm-muted">(optional)</span></label>
          <textarea id="sa-notes" className="sd-field" rows={3} maxLength={500} placeholder="For example: please ask your class teacher to confirm it is you" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <small className="rs-hint">{notes.length}/500</small>
        </div>
      </div>
    </Modal>
  );
}

/** Everything we know about one request. */
export function DetailModal({ request, onClose }: { request: ResetRequest; onClose: () => void }) {
  const r = request;
  const rows: [string, React.ReactNode][] = [
    ["Status", STATUS_LABEL[r.status] ?? r.status],
    ["Requested", fullDate(r.requested_at)],
    ...(r.approved_at ? [[r.status === "rejected" ? "Rejected" : "Resolved", fullDate(r.approved_at)] as [string, React.ReactNode]] : []),
    ...(r.approved_by_name ? [["Resolved by", r.approved_by_name] as [string, React.ReactNode]] : []),
    ...(r.schools?.name ? [["School", r.schools.name] as [string, React.ReactNode]] : []),
  ];
  return (
    <Modal open onClose={onClose} title="Request details" footer={<button className="sd-btn sd-btn--line" onClick={onClose}>Close</button>}>
      <div className="sm-detail">
        <Who r={r} />
        <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        {r.notes && <div><h3>Note</h3><p className="rs-note">{r.notes}</p></div>}
      </div>
    </Modal>
  );
}
