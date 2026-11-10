import { Loader2, Mail, Phone } from "lucide-react";
import Modal from "../../portal/Modal";
import { ChipGroup } from "../../portal/notifications";
import { FLOW, STATUS_LABEL, mailtoReply, nameOf, phoneOf, purposeOf, stamp, type Message, type Status } from "./utils";

/** The whole message, who sent it, how to reach them, and a place to set its status and keep private notes. */
export default function MessageModal({
  message,
  status,
  onStatus,
  notes,
  onNotes,
  saving,
  onSave,
  onClose,
}: {
  message: Message | null;
  status: Status;
  onStatus: (s: Status) => void;
  notes: string;
  onNotes: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const phone = message ? phoneOf(message) : "";
  return (
    <Modal
      open={!!message}
      onClose={() => { if (!saving) onClose(); }}
      wide
      title={message ? nameOf(message) : "Message"}
      subtitle={message ? `Received ${stamp(message.created_at)}` : undefined}
      footer={
        <>
          {message && <a className="sd-btn sd-btn--line ib-reply" href={mailtoReply(message)}><Mail aria-hidden="true" />Reply by email</a>}
          <button className="sd-btn sd-btn--line" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="sd-btn sd-btn--amber" onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
            Save changes
          </button>
        </>
      }
    >
      {message && (
        <>
          <div className="ib-reach">
            <a href={`mailto:${message.email}`}><Mail aria-hidden="true" />{message.email}</a>
            {phone && <a href={`tel:${phone.replace(/\s+/g, "")}`}><Phone aria-hidden="true" />{phone}</a>}
          </div>
          <div className="ib-quote">
            <b>{purposeOf(message.purpose)}</b>
            <p>{message.message}</p>
          </div>
          <div className="sd-field-wrap">
            <label id="ib-status-l">Status</label>
            <ChipGroup label="Message status" value={status} options={FLOW.map((s) => [s, STATUS_LABEL[s]] as const)} onChange={onStatus} />
          </div>
          <div className="sd-field-wrap">
            <label htmlFor="ib-notes">Private notes</label>
            <textarea id="ib-notes" className="sd-field ib-area" rows={4} placeholder="Who called back, what was agreed, what to do next" value={notes} onChange={(e) => onNotes(e.target.value)} />
            <small className="ib-hint">Only admins can see notes.</small>
          </div>
        </>
      )}
    </Modal>
  );
}
