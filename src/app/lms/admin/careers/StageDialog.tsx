"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Info } from "lucide-react";
import Modal from "@/components/portal/Modal";
import { adminApi } from "@/lib/api/admin.api";
import { LABEL, nice, type Detail } from "./CandidateView";

export const STAGE_COLOR: Record<string, string> = { new: "var(--sd-amber-deep)", screening: "#93b4f5", interview: "var(--sd-blue)", demo_class: "var(--sd-blue-deep)", offer: "var(--sd-navy)", hired: "#1f8a4c", rejected: "var(--sd-late)", on_hold: "#b88a1b", withdrawn: "var(--sd-ink-soft)" };
export const MAILED = ["screening", "interview", "demo_class", "offer", "hired", "on_hold", "rejected"];
const REOPEN = ["rejected", "on_hold", "withdrawn"];

/** What to ask the reviewer for, per stage. Interview is the only one the email cannot do without. */
const NOTE: Record<string, { label: string; hint: string; ph: string }> = {
  interview: { label: "Interview details", hint: "Required. The email asks them to confirm this.", ph: "Date, time and place" },
  demo_class: { label: "Demo class details", hint: "Optional. Without it, the email says you will confirm the date and place.", ph: "Date, time and place" },
  offer: { label: "Offer details", hint: "Optional. Shown in a highlighted box in the email.", ph: "Pay, joining date, anything they should know" },
  rejected: { label: "Personal note", hint: "Optional. A kind line is read more than the template.", ph: "Write a short, personal line" },
};
const NOTE_DEFAULT = { label: "Note", hint: "Optional. Shown in the email.", ph: "Add a line for them" };

type Mail = { subject: string; html: string; to: string };

/** The email as the applicant will see it. Rebuilds a moment after the note stops changing. */
function Preview({ id, stage, message, name }: { id: string; stage: string; message: string; name: string }) {
  const [mail, setMail] = useState<Mail | null>(null);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const { data } = await adminApi.careers.previewEmail(id, { stage, message: message.trim() || undefined });
        if (live) { setMail(data); setFailed(false); }
      } catch { if (live) setFailed(true); }
      finally { if (live) setBusy(false); }
    }, mail ? 450 : 0);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, stage, message]);

  return (
    <div className="sg-mail" aria-busy={busy}>
      <div className="sg-mail-head">
        <span className="sg-avatar" aria-hidden="true">Y</span>
        <div>
          <p className="sg-mail-from">YugMinds Careers</p>
          <p className="sg-mail-to">To {mail?.to ?? name}</p>
        </div>
        <span className="sg-live" data-busy={busy}>{busy ? "Updating" : "Live preview"}</span>
      </div>
      <p className="sg-mail-subj">{mail?.subject ?? " "}</p>
      {failed ? (
        <p className="sg-mail-err" role="alert">The preview did not load. You can still send; the email is built the same way.</p>
      ) : (
        <iframe title="Email preview" sandbox="" srcDoc={mail?.html ?? ""} className="sg-frame" />
      )}
    </div>
  );
}

export default function StageDialog({
  open, pending, resend, notify, message, saving, onNotify, onMessage, onClose, onConfirm,
}: {
  open: Detail | null; pending: string | null; resend: boolean; notify: boolean; message: string; saving: boolean;
  onNotify: (v: boolean) => void; onMessage: (v: string) => void; onClose: () => void; onConfirm: () => void;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const on = !!open && !!pending;
  const first = open ? nice(open.full_name).split(" ")[0] : "";
  const mailed = !!pending && MAILED.includes(pending);
  const emailing = mailed && (resend || notify);
  const reopening = !!open && !!pending && !resend && REOPEN.includes(open.stage) && !REOPEN.includes(pending) && mailed;
  const note = (pending && NOTE[pending]) || NOTE_DEFAULT;
  const need = pending === "interview" && emailing && !message.trim();
  const reject = pending === "rejected";

  const title = !on ? "" : resend ? `Resend email to ${first}` : reject ? `Reject ${first}` : `Move ${first} to ${LABEL[pending!]}`;
  const confirm = saving ? "Saving…" : resend ? "Resend email" : reject ? (emailing ? "Reject and email" : "Reject") : emailing ? "Move and email" : "Move";

  return (
    <Modal
      open={on}
      onClose={() => { if (!saving) { setTab("write"); onClose(); } }}
      title={title}
      subtitle={on ? [open!.role, open!.ref].filter(Boolean).join(" · ") : undefined}
      footer={on && (<>
        <button className="sd-btn sd-btn--line" disabled={saving} onClick={() => { setTab("write"); onClose(); }}>Cancel</button>
        <button className={`sd-btn sd-btn--ink${reject ? " sg-danger" : ""}`} disabled={saving || need} onClick={onConfirm}>{confirm}</button>
      </>)}
    >
      {on && (
        <div className="sg-root" data-wide={emailing} data-tab={tab}>
          {emailing && (
            <div className="sg-tabs" role="tablist" aria-label="Dialog sections">
              <button role="tab" aria-selected={tab === "write"} onClick={() => setTab("write")}>Write</button>
              <button role="tab" aria-selected={tab === "preview"} onClick={() => setTab("preview")}>Preview</button>
            </div>
          )}

          <div className="sg-write">
            <div className="sg-move" aria-label={resend ? `Current stage ${LABEL[pending!]}` : `From ${LABEL[open!.stage]} to ${LABEL[pending!]}`}>
              {!resend && (<>
                <span className="sg-pill" style={{ ["--c" as string]: STAGE_COLOR[open!.stage] }}>{LABEL[open!.stage] ?? open!.stage}</span>
                <ArrowRight aria-hidden="true" />
              </>)}
              <span className="sg-pill" data-to="true" style={{ ["--c" as string]: STAGE_COLOR[pending!] }}>{LABEL[pending!]}</span>
            </div>

            {reopening && (
              <p className="sg-callout"><Info aria-hidden="true" />This reopens their application. The email asks them to disregard the earlier message.</p>
            )}

            {mailed && !resend && (
              <label className="sg-switch">
                <span>
                  <b>Email {first}</b>
                  <small>{notify ? "Sent from YugMinds Careers. Replies reach HR." : "They will not be told. The move is logged in the history."}</small>
                </span>
                <input type="checkbox" role="switch" checked={notify} onChange={(e) => onNotify(e.target.checked)} />
                <i aria-hidden="true" />
              </label>
            )}

            {!mailed && <p className="sg-quiet">No email is sent for this stage. The move is logged in the history.</p>}

            {emailing && (
              <div className="sd-field-wrap">
                <label htmlFor="sg-note">{note.label}</label>
                <textarea id="sg-note" className="sd-field" rows={5} maxLength={600} value={message} onChange={(e) => onMessage(e.target.value)} placeholder={note.ph} aria-describedby="sg-hint" aria-required={need || pending === "interview"} />
                <p id="sg-hint" className="sg-hint"><span data-need={need}>{note.hint}</span><span>{message.length}/600</span></p>
              </div>
            )}
          </div>

          {emailing && <Preview key={`${open!.id}-${pending}`} id={open!.id} stage={pending!} message={message} name={first} />}
        </div>
      )}
    </Modal>
  );
}
