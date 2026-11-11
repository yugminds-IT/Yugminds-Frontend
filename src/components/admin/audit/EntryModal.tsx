import { useState } from "react";
import { Check, Copy } from "lucide-react";
import Modal from "../../portal/Modal";
import { describe, entityLabel, stamp, whoOf, type AuditLogRow, roleLabel } from "./utils";

/** The full record of one change, with the data that was sent. Passwords and tokens were removed before it was saved. */
export default function EntryModal({ entry, onClose }: { entry: AuditLogRow | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const json = entry ? JSON.stringify(entry.payload ?? {}, null, 2) : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* the text is still selectable */
    }
  };
  const d = entry ? describe(entry) : null;
  return (
    <Modal open={!!entry} onClose={onClose} wide title={d?.headline ?? "Audit entry"} subtitle={entry ? stamp(entry.createdAt) : undefined} footer={<button className="sd-btn sd-btn--line" onClick={onClose}>Close</button>}>
      {entry && (
        <>
          <dl className="aud-facts">
            <div><dt>Who</dt><dd>{whoOf(entry)}{entry.actorEmail && entry.actorName ? <small>{entry.actorEmail}</small> : null}<small>{roleLabel(entry.actorRole)}</small></dd></div>
            {entry.impersonatedBy ? <div><dt>Really done by</dt><dd>{entry.impersonatedBy.name}<small>An admin acting as this person</small></dd></div> : null}
            {entry.schoolName ? <div><dt>School</dt><dd>{entry.schoolName}</dd></div> : null}
            <div><dt>Result</dt><dd className="aud-result" data-ok={entry.success}>{entry.success ? "Worked" : "Failed"}{entry.statusCode ? <small>HTTP {entry.statusCode}</small> : null}</dd></div>
            <div><dt>What</dt><dd>{entityLabel(entry.entityType)}{d?.id ? <small>Record {d.id}</small> : null}</dd></div>
            <div><dt>From</dt><dd>{entry.ipAddress ?? "Unknown address"}</dd></div>
          </dl>
          <div className="sd-field-wrap">
            <label>Request</label>
            <p className="aud-path"><span className="sm-chip">{entry.method}</span><code>{entry.path}</code></p>
          </div>
          <div className="sd-field-wrap">
            <div className="aud-pay-head">
              <label>Data sent</label>
              <button type="button" className="sm-reset" style={{ color: "var(--sd-ink)" }} onClick={() => void copy()}>
                {copied ? <><Check width={14} height={14} aria-hidden="true" /> Copied</> : <><Copy width={14} height={14} aria-hidden="true" /> Copy</>}
              </button>
            </div>
            <pre className="aud-pay" tabIndex={0} aria-label="Data sent with this request">{json}</pre>
            <small className="aud-hint">Passwords, tokens and secrets show as [redacted]. Long text is cut at 2,000 characters.</small>
          </div>
        </>
      )}
    </Modal>
  );
}
