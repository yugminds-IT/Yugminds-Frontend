import Droid from "../../portal/Droid";

export type LogoView = "have" | "missing";
export const VIEW_ORDER: LogoView[] = ["have", "missing"];
export const VIEW_LABEL: Record<LogoView, string> = { have: "Has a logo", missing: "No logo yet" };

/**
 * Whether each school has a logo on file. The droid waits at "No logo yet" while any school still needs one.
 * Pressing a stop switches the list to those schools; pressing the active "No logo yet" stop goes back to the logos.
 */
export default function LogoRun({
  counts,
  view,
  onSelect,
  caption,
}: {
  counts: Record<LogoView, number>;
  view: LogoView;
  onSelect: (v: LogoView) => void;
  caption: React.ReactNode;
}) {
  const n = VIEW_ORDER.length;
  const total = counts.have + counts.missing;
  const at = counts.missing > 0 || view === "missing" ? 1 : 0;
  return (
    <div className="sd-run-card">
      <div className="sd-run tm-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Schools by whether they have a logo">
          {VIEW_ORDER.map((v) => (
            <li key={v} className="sd-day" data-active={v === "have" && counts.have > 0} data-late={v === "missing" && counts.missing > 0} data-today={view === v} data-future={counts[v] === 0}>
              <button type="button" className="tm-node" aria-pressed={view === v} aria-label={`${VIEW_LABEL[v]}: ${counts[v]} ${counts[v] === 1 ? "school" : "schools"}`} onClick={() => onSelect(v === "missing" && view === "missing" ? "have" : v)}>
                <span className="sd-node">{counts[v]}</span>
                <span>{VIEW_LABEL[v]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{total}<small>{total === 1 ? "school" : "schools"}</small></b>
        <span>{caption}</span>
      </div>
    </div>
  );
}
