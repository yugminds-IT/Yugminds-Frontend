import { Archive, CheckCheck, Eye, Mail, Trash2, Undo2, Loader2 } from "lucide-react";
import RowMenu, { type RowMenuItem } from "../../portal/RowMenu";
import { ago, initialsOf } from "../../portal/notifications";
import { STATUS_LABEL, mailtoReply, nameOf, phoneOf, purposeOf, type Message, type Status, type View } from "./utils";

/** One row per message. Opening a row shows the whole message; the menu does the common things without opening it. */
export default function MessageList({
  rows,
  view,
  now,
  busyId,
  picked,
  onPick,
  onPickAll,
  onOpen,
  onStatus,
  onDelete,
  onRestore,
  onPurge,
}: {
  rows: Message[];
  view: View | "all";
  now: number;
  busyId: string | null;
  picked: Set<string>;
  onPick: (id: string) => void;
  onPickAll: () => void;
  onOpen: (m: Message) => void;
  onStatus: (m: Message, s: Status) => void;
  onDelete: (m: Message) => void;
  onRestore: (m: Message) => void;
  onPurge: (m: Message) => void;
}) {
  const deleted = view === "deleted";
  return (
    <section className="sd-panel ib-list mc-swap" aria-label={deleted ? "Deleted messages" : "Messages"}>
      <div className="ib-head">
        <input type="checkbox" className="sa-check" aria-label="Select everything on this page" checked={rows.length > 0 && rows.every((m) => picked.has(m.id))} onChange={onPickAll} />
        <span />
        <span>Sender</span>
        <span>Message</span>
        <span>Status</span>
        <span>Received</span>
        <span />
      </div>
      {rows.map((m) => {
        const items: RowMenuItem[] = deleted
          ? [
              { label: "Restore", icon: Undo2, onClick: () => onRestore(m) },
              { label: "Delete forever", icon: Trash2, onClick: () => onPurge(m), danger: true, separatorBefore: true },
            ]
          : [
              { label: "Open message", icon: Eye, onClick: () => onOpen(m) },
              { label: "Reply by email", icon: Mail, onClick: () => { window.location.href = mailtoReply(m); } },
              ...(m.status !== "replied" ? [{ label: "Mark as replied", icon: CheckCheck, onClick: () => onStatus(m, "replied" as Status) }] : []),
              ...(m.status !== "archived" ? [{ label: "Archive", icon: Archive, onClick: () => onStatus(m, "archived" as Status) }] : []),
              { label: "Delete", icon: Trash2, onClick: () => onDelete(m), danger: true, separatorBefore: true },
            ];
        const phone = phoneOf(m);
        return (
          <div key={m.id} className="ib-row" data-new={m.status === "new" && !deleted} data-busy={busyId === m.id} data-picked={picked.has(m.id)}>
            <input type="checkbox" className="sa-check" aria-label={`Select message from ${nameOf(m)}`} checked={picked.has(m.id)} onChange={() => onPick(m.id)} />
            <span className="sd-avatar" aria-hidden="true">{initialsOf(nameOf(m))}</span>
            <span className="ib-who">
              <b>{nameOf(m)}</b>
              <small>{m.email}</small>
              {phone && <small>{phone}</small>}
            </span>
            {deleted ? (
              <span className="ib-msg"><b>{purposeOf(m.purpose)}</b><span>{m.message}</span></span>
            ) : (
              <button type="button" className="ib-msg ib-open" onClick={() => onOpen(m)} aria-label={`Open message from ${nameOf(m)}`}>
                <b>{purposeOf(m.purpose)}</b><span>{m.message}</span>
              </button>
            )}
            <span className="ib-status">
              {deleted ? <span className="sm-chip" data-s="idle">Deleted</span> : (
                <span className="sm-chip" data-on={m.status === "replied" ? "true" : undefined} data-class={m.status === "new" ? "true" : undefined} data-s={m.status === "archived" ? "idle" : undefined}>{STATUS_LABEL[m.status]}</span>
              )}
            </span>
            <span className="ib-when">{ago(m.created_at, now)}<small>{new Date(m.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</small></span>
            <span className="ib-menu">
              {busyId === m.id ? <Loader2 className="animate-spin" aria-label="Working" width={18} height={18} /> : <RowMenu label={`Actions for ${nameOf(m)}`} items={items} />}
            </span>
          </div>
        );
      })}
    </section>
  );
}
