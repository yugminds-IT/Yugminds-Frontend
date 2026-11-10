import { Loader2, RotateCcw } from "lucide-react";
import Modal from "../../portal/Modal";

export interface Version { id: string; version_number: number; created_at: string }

/** Earlier saved versions of an item. Reverting makes that version the current one. */
export default function HistoryModal({
  title,
  versions,
  loading,
  revertingId,
  onRevert,
  onClose,
}: {
  /** the item's title, or null when closed */
  title: string | null;
  versions: Version[];
  loading: boolean;
  revertingId: string | null;
  onRevert: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal open={title !== null} onClose={onClose} title="Version history" subtitle={title ?? undefined} footer={<button className="sd-btn sd-btn--line" onClick={onClose}>Close</button>}>
      {loading ? (
        <div className="sd-skel" />
      ) : versions.length === 0 ? (
        <p className="cn-empty-note">No earlier versions yet. A version is saved each time you edit this item.</p>
      ) : (
        <ul className="cn-versions">
          {versions.map((v, i) => (
            <li key={v.id}>
              <span><b>Version {v.version_number}{i === 0 ? " (latest)" : ""}</b><small>{new Date(v.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</small></span>
              {i !== 0 && (
                <button className="sd-btn sd-btn--line" disabled={revertingId !== null} onClick={() => onRevert(v.id)}>
                  {revertingId === v.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
                  Revert to this
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
