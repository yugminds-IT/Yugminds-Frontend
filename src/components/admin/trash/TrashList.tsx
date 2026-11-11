import { BookOpen, Loader2, Trash2, Undo2 } from "lucide-react";
import RowMenu from "../../portal/RowMenu";
import { ago, initialsOf } from "../../portal/notifications";
import { KINDS, type Kind, type TrashItem } from "./utils";

/** Deleted items, newest first. Restore is the main button; deleting forever lives in the row menu so it is never one slip away. */
export default function TrashList({
  kind,
  rows,
  now,
  picked,
  onPick,
  onPickAll,
  allPicked,
  busyId,
  onRestore,
  onPurge,
}: {
  kind: Kind;
  rows: TrashItem[];
  now: number;
  picked: Set<string>;
  onPick: (id: string) => void;
  onPickAll: () => void;
  allPicked: boolean;
  busyId: string | null;
  onRestore: (i: TrashItem) => void;
  onPurge: (i: TrashItem) => void;
}) {
  return (
    <section className="sd-panel tr-list mc-swap" aria-label={`Deleted ${KINDS.find((k) => k.key === kind)!.many}`}>
      <div className="tr-head">
        <input type="checkbox" className="sa-check" aria-label="Select everything on this page" checked={allPicked} onChange={onPickAll} />
        <span />
        <span>{KINDS.find((k) => k.key === kind)!.label.replace(/s$/, "")}</span>
        <span>Deleted</span>
        <span />
      </div>
      {rows.map((i) => (
        <div key={i.id} className="tr-row" data-picked={picked.has(i.id)} data-busy={busyId === i.id}>
          <input type="checkbox" className="sa-check" aria-label={`Select ${i.name}`} checked={picked.has(i.id)} onChange={() => onPick(i.id)} />
          {kind !== "courses" ? <span className="sd-avatar" aria-hidden="true">{initialsOf(i.name)}</span> : <span className="sd-avatar tr-ico" aria-hidden="true"><BookOpen /></span>}
          <span className="tr-who"><b>{i.name}</b><small>{i.detail}</small></span>
          <span className="tr-when">{i.deleted_at ? ago(i.deleted_at, now) : "Unknown"}{i.deleted_at && <small>{new Date(i.deleted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</small>}</span>
          <span className="tr-acts">
            <button className="sd-btn sd-btn--line" disabled={busyId === i.id} onClick={() => onRestore(i)}>
              {busyId === i.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Undo2 aria-hidden="true" />}
              Restore
            </button>
            <RowMenu label={`More actions for ${i.name}`} items={[{ label: "Delete forever", icon: Trash2, onClick: () => onPurge(i), danger: true }]} />
          </span>
        </div>
      ))}
    </section>
  );
}
