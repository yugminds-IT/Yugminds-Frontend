"use client";

import { useState } from "react";
import { Import, Loader2, Search } from "lucide-react";
import { adminApi } from "@/lib/api/admin.api";
import { toast } from "@/components/ui/toast";
import { MACHINE_ID_RE, cleanMachineId, errorText, payloadOf, type LicenseItem } from "./utils";

const READABLE: Record<string, string> = {
  machineId: "Machine ID", machine_id: "Machine ID", licenseNumber: "License number", license_number: "License number",
  startDate: "Starts", start_date: "Starts", expiryDate: "Expires", expiry_date: "Expires", durationDays: "Days", duration_days: "Days",
  valid: "Seal is valid", sealValid: "Seal is valid", expired: "Expired",
};
const label = (k: string) => READABLE[k] ?? k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const show = (v: unknown) => (typeof v === "boolean" ? (v ? "Yes" : "No") : v == null ? "None" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** Record a key that was handed out before this system existed, and read what is inside any key. */
export default function ToolsTab({
  schools,
  schoolsLoading,
  onImported,
}: {
  schools: { id: string; name: string }[];
  schoolsLoading: boolean;
  onImported: (l: LicenseItem | undefined) => void;
}) {
  const [schoolId, setSchoolId] = useState("");
  const [name, setName] = useState("");
  const [machineId, setMachineId] = useState("");
  const [key, setKey] = useState("");
  const [notes, setNotes] = useState("");
  const [importing, setImporting] = useState(false);

  const [inspectKey, setInspectKey] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [inspecting, setInspecting] = useState(false);

  const add = async () => {
    const mid = machineId.trim().toUpperCase();
    if (!schoolId) return toast.error("Choose a school.");
    if (!name.trim()) return toast.error("Give the computer a name or number.");
    if (!MACHINE_ID_RE.test(mid)) return toast.error("The machine ID is 16 letters and numbers (0 to 9, A to F).");
    if (!key.trim()) return toast.error("Paste the activation key.");
    setImporting(true);
    try {
      const { data } = await adminApi.licenses.import({ schoolId, systemLabel: name.trim(), machineId: mid, activationKey: key.trim(), notes: notes.trim() || undefined });
      onImported(payloadOf(data).license as LicenseItem | undefined);
      toast.success(`${name.trim()}: license added.`);
      setName(""); setMachineId(""); setKey(""); setNotes("");
    } catch (e) {
      toast.error(errorText(e, "Could not add the license."));
    } finally {
      setImporting(false);
    }
  };

  const inspect = async () => {
    const k = inspectKey.trim();
    if (!k) return;
    setInspecting(true);
    setResult(null);
    try {
      const { data } = await adminApi.licenses.decode(k);
      setResult(payloadOf(data));
    } catch (e) {
      toast.error(errorText(e, "Could not read that key."));
    } finally {
      setInspecting(false);
    }
  };

  return (
    <div className="so-grid">
      <div className="so-col">
        <section className="sd-panel" aria-labelledby="lc-imp">
          <div className="sd-panel-head"><div><h2 id="lc-imp">Add a key you already gave out</h2><p>For keys issued before this page existed. Dates and license number are read from the key, and nothing is made again, so the stored key matches the one on the computer.</p></div></div>
          <form className="sm-form" onSubmit={(e) => { e.preventDefault(); void add(); }}>
            <div className="sm-two">
              <div className="sd-field-wrap">
                <label htmlFor="lc-i-school">School</label>
                <select id="lc-i-school" className="sd-field" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} disabled={schoolsLoading}>
                  <option value="">{schoolsLoading ? "Loading schools…" : "Choose a school"}</option>
                  {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="sd-field-wrap">
                <label htmlFor="lc-i-name">Computer</label>
                <input id="lc-i-name" className="sd-field" value={name} placeholder="For example, Lab PC 3" onChange={(e) => setName(e.target.value)} />
              </div>
            </div>
            <div className="sd-field-wrap">
              <label htmlFor="lc-i-mid">Machine ID <small>(16 characters, must match the key)</small></label>
              <input id="lc-i-mid" className="sd-field lc-mono" value={machineId} spellCheck={false} maxLength={16} placeholder="7E4C84B9F7D28C0D" onChange={(e) => setMachineId(cleanMachineId(e.target.value))} />
            </div>
            <div className="sd-field-wrap">
              <label htmlFor="lc-i-key">Activation key</label>
              <input id="lc-i-key" className="sd-field lc-mono" value={key} spellCheck={false} placeholder="XXXXXXX-XXXXXXX-XXXXXXX" onChange={(e) => setKey(e.target.value)} />
            </div>
            <div className="sd-field-wrap">
              <label htmlFor="lc-i-notes">Notes <small>(optional)</small></label>
              <input id="lc-i-notes" className="sd-field" value={notes} placeholder="For example, issued by hand in January" onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div><button type="submit" className="sd-btn sd-btn--amber" disabled={importing}>{importing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Import aria-hidden="true" />}Add license</button></div>
          </form>
        </section>
      </div>
      <div className="so-col">
        <section className="sd-panel" aria-labelledby="lc-ins">
          <div className="sd-panel-head"><div><h2 id="lc-ins">Check a key</h2><p>Paste any key to check its tamper seal and read the machine ID, dates and license number.</p></div></div>
          <form className="sm-form" onSubmit={(e) => { e.preventDefault(); void inspect(); }}>
            <div className="sd-field-wrap">
              <label htmlFor="lc-inspect">Activation key</label>
              <input id="lc-inspect" className="sd-field lc-mono" value={inspectKey} spellCheck={false} placeholder="XXXXXXX-XXXXXXX-XXXXXXX" onChange={(e) => setInspectKey(e.target.value)} />
            </div>
            <div><button type="submit" className="sd-btn sd-btn--line" disabled={inspecting || !inspectKey.trim()}>{inspecting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}Read the key</button></div>
          </form>
          {result && (
            <dl className="lc-facts" aria-live="polite">
              {Object.entries(result).map(([k, v]) => <div key={k}><dt>{label(k)}</dt><dd>{show(v)}</dd></div>)}
            </dl>
          )}
        </section>
      </div>
    </div>
  );
}
