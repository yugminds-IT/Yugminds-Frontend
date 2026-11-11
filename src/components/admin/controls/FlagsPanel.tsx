import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import RowMenu from "../../portal/RowMenu";
import { FLAG_RE, toFlagName, type Controls } from "./utils";

/** Named on/off switches that developers read to turn features on or off without a release. */
export default function FlagsPanel({ value, onChange }: { value: Controls; onChange: (c: Controls) => void }) {
  const [name, setName] = useState("");
  const [problem, setProblem] = useState("");
  const flags = Object.entries(value.feature_flags);

  const add = () => {
    const n = toFlagName(name);
    if (!n) return;
    if (!FLAG_RE.test(n)) return setProblem("Use letters, numbers, dots, dashes and underscores, up to 64 characters.");
    if (Object.hasOwn(value.feature_flags, n)) return setProblem(`"${n}" already exists.`);
    onChange({ ...value, feature_flags: { ...value.feature_flags, [n]: false } });
    setName("");
    setProblem("");
  };
  const set = (k: string, on: boolean) => onChange({ ...value, feature_flags: { ...value.feature_flags, [k]: on } });
  const remove = (k: string) => {
    const next = { ...value.feature_flags };
    delete next[k];
    onChange({ ...value, feature_flags: next });
  };

  return (
    <div className="ctl-stack mc-swap">
      <section className="sd-panel">
        <div className="sd-panel-head"><h2>Add a flag</h2><small>New flags start off</small></div>
        <div className="ctl-add">
          <div className="sd-field-wrap">
            <label htmlFor="ctl-f-name">Flag name</label>
            <input id="ctl-f-name" className="sd-field" value={name} aria-invalid={!!problem} aria-describedby="ctl-f-hint" placeholder="new_flag_name" onChange={(e) => { setName(e.target.value); setProblem(""); }} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
          </div>
          <button className="sd-btn sd-btn--amber" onClick={add} disabled={!name.trim()}><Plus aria-hidden="true" />Add flag</button>
        </div>
        <p id="ctl-f-hint" className={problem ? "ctl-warn" : "ctl-hint"}>{problem || "Developers read flags from the public system status to gate a feature. Spaces become underscores."}</p>
      </section>

      {flags.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>No feature flags yet</b>
            <p>Add a flag above, then switch it on or off here whenever you need to.</p>
          </div>
        </section>
      ) : (
        <section className="sd-panel ctl-flags" aria-label="Feature flags">
          {flags.map(([k, on]) => (
            <div key={k} className="ctl-flag" data-on={on}>
              <code>{k}</code>
              <span className="ctl-flag-state">{on ? "On" : "Off"}</span>
              <button type="button" role="switch" aria-checked={on} aria-label={k} className="st-switch ctl-switch" onClick={() => set(k, !on)} />
              <RowMenu label={`More actions for ${k}`} items={[{ label: "Remove flag", icon: Trash2, onClick: () => remove(k), danger: true }]} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
