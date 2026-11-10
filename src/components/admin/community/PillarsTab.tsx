import { ImageIcon, Plus } from "lucide-react";
import { ChipGroup } from "../../portal/notifications";
import type { CommunityConfig } from "@/lib/community-types";

type Pillar = CommunityConfig["corner_pillars"][number];
const MAX = 3;

/** The three round call-to-action cards near the bottom of the page. */
export default function PillarsTab({ config, onConfig }: { config: CommunityConfig; onConfig: (c: CommunityConfig) => void }) {
  const pillars = config.corner_pillars ?? [];
  const color: "blue" | "white" = config.section_colors?.corner_pillars === "blue" ? "blue" : "white";
  const shown = config.section_enabled?.corner_pillars !== false;
  const set = (i: number, k: keyof Pillar, v: string) => onConfig({ ...config, corner_pillars: pillars.map((p, j) => (j === i ? { ...p, [k]: k === "image_url" ? v || null : v } : p)) });
  return (
    <div className="cn-stack mc-swap">
      <section className="sd-panel">
        <div className="sd-panel-head"><h2>Corner pillars</h2><small>Up to {MAX} round cards that point visitors somewhere</small></div>
        <div className="cn-pillar-top">
          <label className="cn-show">
            <button type="button" role="switch" aria-checked={shown} aria-label="Show corner pillars on the page" className="st-switch" onClick={() => onConfig({ ...config, section_enabled: { ...config.section_enabled, corner_pillars: !shown } })} />
            Show on the page
          </label>
          <ChipGroup label="Background" value={color} options={[["white", "White"], ["blue", "Blue"]] as const} onChange={(c) => onConfig({ ...config, section_colors: { ...config.section_colors, corner_pillars: c } })} />
        </div>
      </section>

      {pillars.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>No pillars yet</b>
            <p>A pillar is a title, a short line and a link, shown as a round image. Add up to {MAX}.</p>
            <button className="sd-btn sd-btn--amber" onClick={() => onConfig({ ...config, corner_pillars: [{ title: "", description: "", image_url: null, link_url: "" }] })}><Plus aria-hidden="true" />Add a pillar</button>
          </div>
        </section>
      ) : (
        <div className="cn-pillars">
          {pillars.map((p, i) => (
            <section key={i} className="sd-panel cn-pillar">
              <div className="cn-pillar-head">
                <span className="cn-round" role="img" aria-label={p.image_url ? "Pillar image" : "No image"} style={p.image_url ? { backgroundImage: `url("${p.image_url.replace(/"/g, "%22")}")` } : undefined}>{!p.image_url && <ImageIcon aria-hidden="true" />}</span>
                <b>{p.title || `Pillar ${i + 1}`}</b>
                <button type="button" className="sm-reset" onClick={() => onConfig({ ...config, corner_pillars: pillars.filter((_, j) => j !== i) })}>Remove</button>
              </div>
              <div className="sd-field-wrap"><label htmlFor={`cn-p-t-${i}`}>Title</label><input id={`cn-p-t-${i}`} className="sd-field" placeholder="e.g. Share a story" value={p.title} onChange={(e) => set(i, "title", e.target.value)} /></div>
              <div className="sd-field-wrap"><label htmlFor={`cn-p-d-${i}`}>Short line</label><input id={`cn-p-d-${i}`} className="sd-field" value={p.description} onChange={(e) => set(i, "description", e.target.value)} /></div>
              <div className="sd-field-wrap"><label htmlFor={`cn-p-l-${i}`}>Link</label><input id={`cn-p-l-${i}`} className="sd-field" placeholder="https://" value={p.link_url} onChange={(e) => set(i, "link_url", e.target.value)} /></div>
              <div className="sd-field-wrap"><label htmlFor={`cn-p-i-${i}`}>Image link (optional)</label><input id={`cn-p-i-${i}`} className="sd-field" placeholder="https://" value={p.image_url ?? ""} onChange={(e) => set(i, "image_url", e.target.value)} /></div>
            </section>
          ))}
          {pillars.length < MAX && (
            <button type="button" className="cn-add" onClick={() => onConfig({ ...config, corner_pillars: [...pillars, { title: "", description: "", image_url: null, link_url: "" }] })}>
              <Plus aria-hidden="true" />Add a pillar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
