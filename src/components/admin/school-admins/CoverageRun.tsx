import Droid from "../../portal/Droid";

export type Coverage = "covered" | "inactive" | "none";
export const COVERAGE_ORDER: Coverage[] = ["covered", "inactive", "none"];
export const COVERAGE_LABEL: Record<Coverage, string> = { covered: "Has an admin", inactive: "Admins inactive", none: "No admin" };

/**
 * Whether each school has someone running it: an active school admin, only inactive ones, or nobody.
 * The droid waits at the stop you filtered to, or at the stop that needs work first.
 * Pressing a stop filters the page; pressing it again clears the filter.
 */
export default function CoverageRun({
  counts,
  selected,
  onSelect,
  caption,
}: {
  counts: Record<Coverage, number>;
  selected: Coverage | null;
  onSelect: (c: Coverage | null) => void;
  caption: React.ReactNode;
}) {
  const n = COVERAGE_ORDER.length;
  const total = COVERAGE_ORDER.reduce((sum, c) => sum + counts[c], 0);
  const firstTodo = counts.none > 0 ? 2 : counts.inactive > 0 ? 1 : 0;
  const at = selected ? COVERAGE_ORDER.indexOf(selected) : firstTodo;
  return (
    <div className="sd-run-card">
      <div className="sd-run tm-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Schools by whether they have a school admin">
          {COVERAGE_ORDER.map((c) => (
            <li key={c} className="sd-day" data-active={c === "covered" && counts[c] > 0} data-late={c !== "covered" && counts[c] > 0} data-today={selected === c} data-future={counts[c] === 0}>
              <button type="button" className="tm-node" aria-pressed={selected === c} aria-label={`${COVERAGE_LABEL[c]}: ${counts[c]} ${counts[c] === 1 ? "school" : "schools"}`} onClick={() => onSelect(selected === c ? null : c)}>
                <span className="sd-node">{counts[c]}</span>
                <span>{COVERAGE_LABEL[c]}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{total}<small>{total === 1 ? "school" : "schools"}</small></b>
        {selected ? <button type="button" className="sm-reset" onClick={() => onSelect(null)}>Show everything</button> : <span>{caption}</span>}
      </div>
    </div>
  );
}
