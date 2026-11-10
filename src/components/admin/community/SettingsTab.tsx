import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { ChipGroup } from "../../portal/notifications";
import type { CommunityConfig } from "@/lib/community-types";

type Cfg = CommunityConfig;
const SECTION_ROWS = [
  ["hero", "Hero banner"],
  ["reels", "Impact reels"],
  ["profiles", "Profiles"],
  ["projects", "Projects"],
  ["learn_videos", "Learn videos"],
  ["challenges", "Challenges"],
  ["blogs", "Blogs"],
  ["corner_pillars", "Corner pillars"],
  ["impact_stats", "Impact stats"],
] as const;
/** only these have a title visitors read */
const TITLED = new Set(["reels", "profiles", "projects", "learn_videos", "challenges", "blogs"]);

/** Hero, section titles and colours, impact numbers and social links: everything about the page that is not an item. */
export default function SettingsTab({
  config,
  onConfig,
  heroPreview,
  onHeroFile,
}: {
  config: Cfg;
  onConfig: (c: Cfg) => void;
  heroPreview: string | null;
  onHeroFile: (f: File) => void;
}) {
  const stats = config.impact_stats ?? [];
  const links = config.social_links ?? [];
  const setStat = (i: number, k: "value" | "label" | "icon", v: string) => onConfig({ ...config, impact_stats: stats.map((s, j) => (j === i ? { ...s, [k]: v } : s)) });
  const setLink = (i: number, url: string) => onConfig({ ...config, social_links: links.map((l, j) => (j === i ? { ...l, url } : l)) });
  return (
    <div className="cn-stack mc-swap">
      <section className="sd-panel">
        <div className="sd-panel-head"><h2>Hero</h2><small>The top of the page</small></div>
        <div className="cn-hero">
          <div className="cn-fields">
            <div className="sd-field-wrap">
              <label htmlFor="cn-h-title">Title</label>
              <input id="cn-h-title" className="sd-field" value={config.hero_title} onChange={(e) => onConfig({ ...config, hero_title: e.target.value })} />
            </div>
            <div className="sd-field-wrap">
              <label htmlFor="cn-h-sub">Subtitle</label>
              <textarea id="cn-h-sub" className="sd-field cn-area" rows={3} value={config.hero_subtitle ?? ""} onChange={(e) => onConfig({ ...config, hero_subtitle: e.target.value })} />
            </div>
          </div>
          <div className="sd-field-wrap">
            <label htmlFor="cn-h-img">Hero image</label>
            <div className="cn-hero-img">
              {heroPreview ? <Image src={heroPreview} alt="Hero image preview" fill sizes="320px" className="cn-img" unoptimized /> : <ImageIcon aria-hidden="true" />}
            </div>
            <label className="cn-pick sd-btn sd-btn--line">
              {heroPreview ? "Replace image" : "Choose image"}
              <input id="cn-h-img" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onHeroFile(f); }} />
            </label>
          </div>
        </div>
      </section>

      <section className="sd-panel cn-rows">
        <div className="sd-panel-head"><h2>Sections</h2><small>Title, background and whether visitors see it</small></div>
        {SECTION_ROWS.map(([key, name]) => {
          const color: "blue" | "white" = config.section_colors?.[key] === "blue" ? "blue" : "white";
          return (
            <div key={key} className="cn-row">
              {TITLED.has(key) ? (
                <div className="sd-field-wrap">
                  <label htmlFor={`cn-t-${key}`}>{name}</label>
                  <input id={`cn-t-${key}`} className="sd-field" placeholder="Section title" value={config.section_titles?.[key] ?? ""} onChange={(e) => onConfig({ ...config, section_titles: { ...config.section_titles, [key]: e.target.value } })} />
                </div>
              ) : (
                <b className="cn-rname">{name}</b>
              )}
              <ChipGroup label={`${name} background`} value={color} options={[["white", "White"], ["blue", "Blue"]] as const} onChange={(c) => onConfig({ ...config, section_colors: { ...config.section_colors, [key]: c } })} />
              {key !== "impact_stats" ? (
                <label className="cn-show">
                  <button type="button" role="switch" aria-checked={config.section_enabled?.[key] !== false} aria-label={`Show ${name} on the page`} className="st-switch" onClick={() => onConfig({ ...config, section_enabled: { ...config.section_enabled, [key]: config.section_enabled?.[key] === false } })} />
                  Show
                </label>
              ) : <span />}
            </div>
          );
        })}
      </section>

      <section className="sd-panel">
        <div className="sd-panel-head"><h2>Impact numbers</h2><small>The big figures in the impact section</small></div>
        <div className="cn-stats">
          {stats.map((s, i) => (
            <div key={i} className="cn-stat">
              <div className="sd-field-wrap"><label htmlFor={`cn-sv-${i}`}>Number</label><input id={`cn-sv-${i}`} className="sd-field" placeholder="e.g. 500+" value={s.value} onChange={(e) => setStat(i, "value", e.target.value)} /></div>
              <div className="sd-field-wrap"><label htmlFor={`cn-sl-${i}`}>What it counts</label><input id={`cn-sl-${i}`} className="sd-field" value={s.label} onChange={(e) => setStat(i, "label", e.target.value)} /></div>
              <div className="sd-field-wrap">
                <label htmlFor={`cn-si-${i}`}>Icon</label>
                <select id={`cn-si-${i}`} className="sd-field" value={s.icon} onChange={(e) => setStat(i, "icon", e.target.value)}>
                  <option value="trophy">Trophy</option>
                  <option value="award">Award</option>
                  <option value="star">Star</option>
                </select>
              </div>
            </div>
          ))}
          {stats.length === 0 && <p className="cn-empty-note">No impact numbers are set up yet.</p>}
        </div>
      </section>

      <section className="sd-panel">
        <div className="sd-panel-head"><h2>Social links</h2><small>Shown in the social section</small></div>
        <div className="cn-stats">
          {links.map((l, i) => (
            <div key={l.platform} className="sd-field-wrap">
              <label htmlFor={`cn-so-${i}`}>{l.label}</label>
              <input id={`cn-so-${i}`} className="sd-field" placeholder="https://" value={l.url} onChange={(e) => setLink(i, e.target.value)} />
            </div>
          ))}
          {links.length === 0 && <p className="cn-empty-note">No social platforms are set up yet.</p>}
        </div>
      </section>
    </div>
  );
}
