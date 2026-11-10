import Droid from "../../portal/Droid";
import type { ResetCounts } from "./types";

export type Stop = "pending" | "approved" | "rejected";
const STOPS: { id: Stop; label: string }[] = [
  { id: "pending", label: "Waiting" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

/**
 * Every request ends up in one of three places: still waiting, approved with a new password, or turned down.
 * The droid waits at "Waiting" while anyone is locked out, otherwise at "Approved". Pressing a stop filters.
 */
export default function ResetRun({
  counts,
  selected,
  onSelect,
  caption,
}: {
  counts: ResetCounts | undefined;
  selected: Stop | null;
  onSelect: (s: Stop) => void;
  caption: React.ReactNode;
}) {
  const c = (s: Stop) => counts?.[s] ?? 0;
  const at = Math.max(0, STOPS.findIndex((s) => s.id === (selected ?? (c("pending") > 0 ? "pending" : "approved"))));
  const n = STOPS.length;
  return (
    <div className="sd-run-card">
      <div className="sd-run rs-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Requests by outcome">
          {STOPS.map((s) => (
            <li key={s.id} className="sd-day" data-active={c(s.id) > 0} data-today={selected === s.id} data-future={c(s.id) === 0} data-late={s.id === "pending" && c("pending") > 0}>
              <button
                type="button"
                className="rs-node"
                aria-pressed={selected === s.id}
                aria-label={`${s.label}: ${c(s.id)} ${c(s.id) === 1 ? "request" : "requests"}`}
                onClick={() => onSelect(s.id)}
              >
                <span className="sd-node">{c(s.id)}</span>
                <span>{s.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">{caption}</div>
    </div>
  );
}
