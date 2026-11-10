import Droid from "../../portal/Droid";

export type CertStatus = "active" | "pending" | "broken" | "revoked";
export const CERT_ORDER: CertStatus[] = ["active", "pending", "broken", "revoked"];
export const CERT_LABEL: Record<CertStatus, string> = { active: "Active", pending: "Pending", broken: "Broken", revoked: "Revoked" };

/**
 * Certificates by health: active, pending (image not made yet), broken (image missing) and revoked.
 * The droid waits at the first stop that needs work (broken, then pending), or at the one you filtered to.
 * Pressing a stop filters the list; pressing it again clears the filter.
 */
export default function CertRun({
  counts,
  selected,
  onSelect,
  caption,
}: {
  counts: Record<CertStatus, number>;
  selected: CertStatus | null;
  onSelect: (s: CertStatus | null) => void;
  caption: React.ReactNode;
}) {
  const n = CERT_ORDER.length;
  const total = CERT_ORDER.reduce((sum, s) => sum + counts[s], 0);
  const firstTodo = counts.broken > 0 ? 2 : counts.pending > 0 ? 1 : 0;
  const at = selected ? CERT_ORDER.indexOf(selected) : firstTodo;
  return (
    <div className="sd-run-card">
      <div className="sd-run tm-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Certificates by status">
          {CERT_ORDER.map((s) => (
            <li key={s} className="sd-day" data-active={s === "active" && counts[s] > 0} data-late={(s === "pending" || s === "broken") && counts[s] > 0} data-today={selected === s} data-future={counts[s] === 0 || s === "revoked"}>
              <button type="button" className="tm-node" aria-pressed={selected === s} aria-label={`${CERT_LABEL[s]}: ${counts[s]} ${counts[s] === 1 ? "certificate" : "certificates"}`} onClick={() => onSelect(selected === s ? null : s)}>
                <span className="sd-node">{counts[s]}</span>
                <span>{CERT_LABEL[s]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{total}<small>{total === 1 ? "certificate" : "certificates"}</small></b>
        {selected ? <button type="button" className="sm-reset" onClick={() => onSelect(null)}>Show all certificates</button> : <span>{caption}</span>}
      </div>
    </div>
  );
}
