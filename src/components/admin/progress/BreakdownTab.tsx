export interface Item {
  key: string;
  name: string;
  sub?: string;
  /** small numbers shown beside the meter */
  facts: { label: string; value: number }[];
  pct: number;
  pctLabel: string;
}

/** One line per school, course or grade: its numbers and a meter. "See students" opens the Students tab filtered to it. */
export default function BreakdownTab({
  items,
  label,
  noun,
  active,
  onOpen,
}: {
  items: Item[];
  label: string;
  noun: string;
  active: string;
  onOpen: (key: string) => void;
}) {
  return (
    <section className="sd-panel ps-list mc-swap" aria-label={label}>
      {items.map((it) => (
        <div key={it.key} className="ps-brow" data-on={active === it.key}>
          <span className="ps-bname"><b>{it.name}</b>{it.sub && <small>{it.sub}</small>}</span>
          <dl className="ps-facts">
            {it.facts.map((f) => (
              <div key={f.label}><dd>{f.value}</dd><dt>{f.label}</dt></div>
            ))}
          </dl>
          <span className="ps-prog">
            <span className="sd-meter" role="img" aria-label={`${it.pctLabel}: ${it.pct}%`}><i style={{ "--p": `${it.pct}%` } as React.CSSProperties} /></span>
            <b>{it.pct}%</b>
            <small>{it.pctLabel}</small>
          </span>
          <button type="button" className="sd-btn sd-btn--line ps-go" aria-label={`See students in ${noun} ${it.name}`} onClick={() => onOpen(it.key)}>See students</button>
        </div>
      ))}
    </section>
  );
}
