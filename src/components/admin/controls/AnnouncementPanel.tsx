import { Megaphone } from "lucide-react";
import { ChipGroup } from "../../portal/notifications";
import { MAX_TEXT, type Announcement, type Controls } from "./utils";

const LEVELS = [["info", "Info"], ["warning", "Warning"], ["critical", "Critical"]] as const;

/** A banner across the top of every signed-in dashboard. The preview is the real banner style. */
export default function AnnouncementPanel({ value, onChange }: { value: Controls; onChange: (c: Controls) => void }) {
  const a = value.announcement;
  const set = (patch: Partial<Announcement>) => onChange({ ...value, announcement: { ...a, ...patch } });
  return (
    <div className="ctl-stack mc-swap">
      <section className="sd-panel ctl-panel" data-live={a.enabled}>
        <div className="ctl-switchrow">
          <span className="ctl-ico" aria-hidden="true"><Megaphone /></span>
          <span className="ctl-sw-text">
            <b id="ctl-a-l">Show the announcement banner</b>
            <small>Every signed-in user sees it at the top of their dashboard. People can dismiss it for the session.</small>
          </span>
          <button type="button" role="switch" aria-checked={a.enabled} aria-labelledby="ctl-a-l" className="st-switch ctl-switch" onClick={() => set({ enabled: !a.enabled })} />
        </div>
      </section>

      <section className="sd-panel">
        <div className="sd-panel-head"><h2>Banner</h2><small>{a.text.length} of {MAX_TEXT}</small></div>
        <div className="sd-field-wrap">
          <label htmlFor="ctl-a-text">Announcement text</label>
          <textarea id="ctl-a-text" className="sd-field ctl-area" rows={3} maxLength={MAX_TEXT} value={a.text} onChange={(e) => set({ text: e.target.value })} placeholder="e.g. Report cards will be published on Friday." />
        </div>
        <div className="sd-field-wrap">
          <label>How serious is it?</label>
          <ChipGroup label="Severity" value={a.level} options={LEVELS} onChange={(level) => set({ level })} />
        </div>
        {a.enabled && !a.text.trim() && <p className="ctl-warn" role="status">The banner is switched on but has no text, so nobody will see it. Write the announcement first.</p>}
        <div className="ctl-preview" data-off={!a.enabled || !a.text.trim()}>
          <small>{!a.text.trim() ? "Write some text to see the banner" : a.enabled ? "This is what everyone sees" : "Preview. The banner is switched off, so no one sees it yet"}</small>
          <div className="sd-banner" data-tone={a.level} role="presentation">
            <Megaphone aria-hidden="true" />
            <span>{a.text.trim() || "Your announcement appears here"}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
