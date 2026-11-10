import Droid from "../../portal/Droid";
import type { CommunitySectionType } from "@/lib/community-types";
import { SECTIONS, type SectionCount } from "./utils";

/**
 * The public page, section by section, in the order visitors scroll through it. Each stop shows how many items are live.
 * A stop with only drafts is amber-red and an empty one is dashed. The droid waits at the section you are editing,
 * or at the first one with nothing live. Pressing a stop opens that section.
 */
export default function SectionRun({
  counts,
  selected,
  hidden,
  onSelect,
  caption,
}: {
  counts: Record<CommunitySectionType, SectionCount>;
  selected: CommunitySectionType | null;
  hidden: Set<CommunitySectionType>;
  onSelect: (t: CommunitySectionType) => void;
  caption: React.ReactNode;
}) {
  const n = SECTIONS.length;
  const total = SECTIONS.reduce((sum, s) => sum + counts[s.type].total, 0);
  const firstTodo = Math.max(0, SECTIONS.findIndex((s) => counts[s.type].live === 0));
  const at = selected ? SECTIONS.findIndex((s) => s.type === selected) : firstTodo;
  return (
    <div className="sd-run-card">
      <div className="sd-run tm-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Sections of the community page">
          {SECTIONS.map((s) => {
            const c = counts[s.type];
            return (
              <li key={s.type} className="sd-day" data-active={c.live > 0} data-late={c.live === 0 && c.drafts > 0} data-today={selected === s.type} data-future={c.total === 0 || hidden.has(s.type)}>
                <button
                  type="button"
                  className="tm-node"
                  aria-pressed={selected === s.type}
                  aria-label={`${s.label}: ${c.live} live, ${c.drafts} ${c.drafts === 1 ? "draft" : "drafts"}${hidden.has(s.type) ? ", hidden on the page" : ""}`}
                  onClick={() => onSelect(s.type)}
                >
                  <span className="sd-node">{c.live}</span>
                  <span>{s.short}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{total}<small>{total === 1 ? "item" : "items"}</small></b>
        <span>{caption}</span>
      </div>
    </div>
  );
}
