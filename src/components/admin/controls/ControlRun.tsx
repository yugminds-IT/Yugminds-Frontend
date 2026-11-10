import Droid from "../../portal/Droid";
import { PARTS, type Controls, type Part } from "./utils";

/**
 * The three platform switches as stops. Each shows whether it is doing anything right now: maintenance on is red,
 * a live announcement or any flag turned on is amber, off is dim. The droid waits at the part you are editing.
 * Pressing a stop opens that part.
 */
export default function ControlRun({
  saved,
  selected,
  onSelect,
  caption,
}: {
  saved: Controls;
  selected: Part;
  onSelect: (p: Part) => void;
  caption: React.ReactNode;
}) {
  const flagsOn = Object.values(saved.feature_flags).filter(Boolean).length;
  const state: Record<Part, { on: boolean; node: string; late?: boolean }> = {
    maintenance: { on: saved.maintenance_mode, node: saved.maintenance_mode ? "On" : "Off", late: saved.maintenance_mode },
    announcement: { on: saved.announcement.enabled, node: saved.announcement.enabled ? "Live" : "Off" },
    flags: { on: flagsOn > 0, node: String(flagsOn) },
  };
  const n = PARTS.length;
  const at = PARTS.findIndex((p) => p.key === selected);
  return (
    <div className="sd-run-card">
      <div className="sd-run tm-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
        <div className="sd-droid"><Droid /></div>
        <div className="sd-run-line" />
        <ol className="sd-days" aria-label="Platform controls and whether they are on">
          {PARTS.map((p) => {
            const s = state[p.key];
            return (
              <li key={p.key} className="sd-day" data-active={s.on && !s.late} data-late={!!s.late} data-today={selected === p.key} data-future={!s.on}>
                <button type="button" className="tm-node" aria-pressed={selected === p.key} aria-label={`${p.label}: ${p.key === "flags" ? `${flagsOn} on` : s.on ? "on" : "off"}`} onClick={() => onSelect(p.key)}>
                  <span className="sd-node">{s.node}</span>
                  <span>{p.short}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="sd-run-foot">
        <b>{[saved.maintenance_mode, saved.announcement.enabled, flagsOn > 0].filter(Boolean).length}<small>of 3 in use</small></b>
        <span>{caption}</span>
      </div>
    </div>
  );
}
