export type Col = { key: string; label: string; /** the full month, for screen readers and the hover title */ full?: string; value: number | null; text: string; hot?: boolean };

/** Bars side by side, one per period. A period with no value stays an empty slot, never a zero. */
export function ColumnChart({ cols, max = 100, label }: { cols: Col[]; max?: number; label: string }) {
  return (
    <ol className="ta-cols" data-dense={cols.length > 8} style={{ "--n": cols.length } as React.CSSProperties} aria-label={label}>
      {cols.map((c) => (
        <li key={c.key} className="ta-col" data-empty={c.value == null} data-hot={c.hot} aria-label={`${c.full ?? c.label}: ${c.text}`} title={`${c.full ?? c.label}: ${c.text}`}>
          <span className="ta-val">{c.value == null ? "" : c.value}</span>
          <span className="ta-track">{c.value != null && <i style={{ "--h": `${Math.max(2, Math.min(100, (c.value / max) * 100))}%` } as React.CSSProperties} />}</span>
          <span className="ta-lab"><span className="ta-full">{c.label}</span><span className="ta-one" aria-hidden="true">{c.label.charAt(0)}</span></span>
        </li>
      ))}
    </ol>
  );
}

export type Part = { label: string; value: number; tone: "ink" | "amber" | "blue" | "red" | "line" | "soft" };

/** One bar split into parts, with a legend that carries the numbers. */
export function SegmentBar({ parts, unit = "", empty }: { parts: Part[]; unit?: string; empty: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  if (total === 0) return <p className="ta-empty">{empty}</p>;
  return (
    <div>
      <div className="ta-seg" role="img" aria-label={parts.filter((p) => p.value > 0).map((p) => `${p.label} ${p.value}`).join(", ")}>
        {parts.filter((p) => p.value > 0).map((p) => <i key={p.label} data-t={p.tone} style={{ flex: p.value }} />)}
      </div>
      <ul className="ta-legend">
        {parts.map((p) => (
          <li key={p.label} data-zero={p.value === 0}>
            <i data-t={p.tone} aria-hidden="true" />
            <span>{p.label}</span>
            <b>{p.value}{unit}</b>
            <small>{Math.round((p.value / total) * 100)}%</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The thin version: just the bar, for rows that already carry their own label. */
export function MiniSeg({ parts }: { parts: Part[] }) {
  return (
    <div className="ta-seg ta-seg--thin" role="img" aria-label={parts.filter((p) => p.value > 0).map((p) => `${p.label} ${p.value}`).join(", ")}>
      {parts.filter((p) => p.value > 0).map((p) => <i key={p.label} data-t={p.tone} style={{ flex: p.value }} />)}
    </div>
  );
}
