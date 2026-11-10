import { Wrench } from "lucide-react";
import { MAX_TEXT, type Controls } from "./utils";

/** Blocks sign-in for everyone except admins. The message is what people read when they try to sign in. */
export default function MaintenancePanel({ value, onChange }: { value: Controls; onChange: (c: Controls) => void }) {
  const on = value.maintenance_mode;
  return (
    <div className="ctl-stack mc-swap">
      <section className="sd-panel ctl-panel" data-danger={on}>
        <div className="ctl-switchrow">
          <span className="ctl-ico" aria-hidden="true"><Wrench /></span>
          <span className="ctl-sw-text">
            <b id="ctl-m-l">Block sign-ins during maintenance</b>
            <small>Students, teachers and school admins cannot sign in while this is on. Admins can, and anyone already signed in stays signed in.</small>
          </span>
          <button type="button" role="switch" aria-checked={on} aria-labelledby="ctl-m-l" className="st-switch ctl-switch" onClick={() => onChange({ ...value, maintenance_mode: !on })} />
        </div>
        {on && <p className="ctl-live" role="status">Maintenance mode is on. Turn it off and save when the work is done.</p>}
      </section>

      <section className="sd-panel">
        <div className="sd-panel-head"><h2>Message at sign-in</h2><small>{value.maintenance_message.length} of {MAX_TEXT}</small></div>
        <div className="sd-field-wrap">
          <label htmlFor="ctl-m-msg">What people read when they try to sign in</label>
          <textarea id="ctl-m-msg" className="sd-field ctl-area" rows={3} maxLength={MAX_TEXT} value={value.maintenance_message} onChange={(e) => onChange({ ...value, maintenance_message: e.target.value })} placeholder="Yugminds is undergoing scheduled maintenance. Please check back shortly." />
        </div>
        <div className="ctl-peek" aria-label="Preview of the sign-in message">
          <small>Preview</small>
          <p>{value.maintenance_message.trim() || "Yugminds is undergoing scheduled maintenance. Please check back shortly."}</p>
        </div>
      </section>
    </div>
  );
}
