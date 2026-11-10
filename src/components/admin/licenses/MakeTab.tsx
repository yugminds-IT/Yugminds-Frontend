"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { adminApi } from "@/lib/api/admin.api";
import { toast } from "@/components/ui/toast";
import { DURATION_PRESETS, MACHINE_ID_RE, cleanMachineId, errorText, licensesOf, payloadOf, plural, type LicenseItem } from "./utils";

type Draft = { uid: string; label: string; machineId: string; durationDays: number; notes: string; saving: boolean; savedKey: string | null };

/** Make keys for a school's lab computers, one row per computer. A saved row keeps its key on screen to copy. */
export default function MakeTab({
  schools,
  schoolsLoading,
  onCreated,
  onConflict,
}: {
  schools: { id: string; name: string }[];
  schoolsLoading: boolean;
  /** a key was made */
  onCreated: (l: LicenseItem | undefined) => void;
  /** this computer already has an active license: take the person to it */
  onConflict: (existing: LicenseItem) => void;
}) {
  const [schoolId, setSchoolId] = useState("");
  const [count, setCount] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [existing, setExisting] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const school = schools.find((s) => s.id === schoolId);

  // How many the school already has, so new rows are numbered after them.
  useEffect(() => {
    if (!schoolId) return;
    let live = true;
    adminApi.licenses.list({ schoolId }).then(({ data }) => { if (live) setExisting(licensesOf(data).length); }).catch(() => { if (live) setExisting(0); });
    return () => { live = false; };
  }, [schoolId]);

  const patch = (uid: string, p: Partial<Draft>) => setDrafts((prev) => prev.map((d) => (d.uid === uid ? { ...d, ...p } : d)));

  const createRows = () => {
    const n = Math.floor(Number(count));
    if (!Number.isFinite(n) || n < 1 || n > 100) { toast.error("Enter a number of computers from 1 to 100."); return; }
    const base = existing + drafts.length;
    setDrafts((prev) => [...prev, ...Array.from({ length: n }, (_, i): Draft => ({ uid: crypto.randomUUID(), label: `System ${base + i + 1}`, machineId: "", durationDays: 365, notes: "", saving: false, savedKey: null }))]);
    setCount("");
  };

  const generate = async (d: Draft) => {
    const label = d.label.trim();
    const machineId = d.machineId.trim().toUpperCase();
    if (!label) return toast.error("Give the computer a name or number.");
    if (!MACHINE_ID_RE.test(machineId)) return toast.error(`${label}: the machine ID is 16 letters and numbers (0 to 9, A to F).`);
    patch(d.uid, { saving: true });
    try {
      const { data } = await adminApi.licenses.generate({ schoolId, systemLabel: label, machineId, durationDays: d.durationDays, notes: d.notes.trim() || undefined });
      const created = payloadOf(data).license as LicenseItem | undefined;
      patch(d.uid, { saving: false, savedKey: created?.activation_key ?? null });
      onCreated(created);
      toast.success(`${label}: key made.`);
    } catch (e) {
      patch(d.uid, { saving: false });
      const msg = errorText(e, "Could not make the key.");
      toast.error(`${label}: ${msg}`);
      // This computer already has an active license here: jump to it instead of leaving a dead end.
      if (msg.includes("already has an active license")) {
        try {
          const { data } = await adminApi.licenses.list({ schoolId, search: machineId });
          const found = licensesOf(data).find((l) => l.machine_id === machineId);
          if (found) onConflict(found);
        } catch { /* the message above already explained it */ }
      }
    }
  };

  const copy = async (d: Draft) => {
    if (!d.savedKey) return;
    try { await navigator.clipboard.writeText(d.savedKey); setCopied(d.uid); setTimeout(() => setCopied((c) => (c === d.uid ? null : c)), 1800); } catch { /* select by hand */ }
  };

  return (
    <div className="lc-make">
      <section className="sd-panel" aria-labelledby="lc-mk">
        <div className="sd-panel-head"><div><h2 id="lc-mk">Make keys for a school</h2><p>Each key works on one computer only, for the number of days you pick. It starts today.</p></div></div>
        <div className="lc-make-top">
          <div className="sd-field-wrap">
            <label htmlFor="lc-school">School</label>
            <select id="lc-school" className="sd-field" value={schoolId} onChange={(e) => { setSchoolId(e.target.value); setDrafts([]); }} disabled={schoolsLoading}>
              <option value="">{schoolsLoading ? "Loading schools…" : "Choose a school"}</option>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {schoolId && (
            <form className="lc-count" onSubmit={(e) => { e.preventDefault(); createRows(); }}>
              <div className="sd-field-wrap">
                <label htmlFor="lc-count">How many computers</label>
                <input id="lc-count" type="number" min={1} max={100} className="sd-field" value={count} placeholder="For example, 5" onChange={(e) => setCount(e.target.value)} />
              </div>
              <button type="submit" className="sd-btn sd-btn--amber"><Plus aria-hidden="true" />Add rows</button>
            </form>
          )}
        </div>
        {schoolId && existing > 0 && <p className="lc-hint">{school?.name} already has {plural(existing, "license")}, so new computers are numbered from System {existing + 1}.</p>}
      </section>

      {!schoolId ? (
        <section className="sd-panel"><div className="sd-empty"><b>Pick a school first</b><p>Then say how many computers need a key, and fill in each machine ID from the RoboCoders desktop app.</p></div></section>
      ) : drafts.length > 0 && (
        <section className="sd-panel lc-drafts" aria-label={`Keys for ${school?.name}`}>
          {drafts.map((d) => (
            <div key={d.uid} className="lc-draft" data-saved={!!d.savedKey}>
              <div className="sd-field-wrap">
                <label htmlFor={`lc-l-${d.uid}`}>Computer</label>
                <input id={`lc-l-${d.uid}`} className="sd-field" value={d.label} disabled={!!d.savedKey} onChange={(e) => patch(d.uid, { label: e.target.value })} />
              </div>
              <div className="sd-field-wrap">
                <label htmlFor={`lc-m-${d.uid}`}>Machine ID <small>(16 characters, from the desktop app)</small></label>
                <input id={`lc-m-${d.uid}`} className="sd-field lc-mono" value={d.machineId} disabled={!!d.savedKey} spellCheck={false} maxLength={16} placeholder="7E4C84B9F7D28C0D" onChange={(e) => patch(d.uid, { machineId: cleanMachineId(e.target.value) })} />
              </div>
              <div className="sd-field-wrap">
                <label htmlFor={`lc-d-${d.uid}`}>Valid for</label>
                <select id={`lc-d-${d.uid}`} className="sd-field" value={d.durationDays} disabled={!!d.savedKey} onChange={(e) => patch(d.uid, { durationDays: Number(e.target.value) })}>
                  {DURATION_PRESETS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
                </select>
              </div>
              <div className="lc-draft-acts">
                {d.savedKey ? (
                  <button type="button" className="sd-btn sd-btn--line" onClick={() => void copy(d)}>{copied === d.uid ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied === d.uid ? "Copied" : "Copy key"}</button>
                ) : (
                  <>
                    <button type="button" className="sd-btn sd-btn--amber" onClick={() => void generate(d)} disabled={d.saving}>
                      {d.saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}Make key
                    </button>
                    <button type="button" className="pl-ico" aria-label={`Remove ${d.label}`} onClick={() => setDrafts((prev) => prev.filter((x) => x.uid !== d.uid))}><Trash2 /></button>
                  </>
                )}
              </div>
              {d.savedKey && (
                <p className="lc-saved"><code>{d.savedKey}</code><span><Check aria-hidden="true" />Saved</span></p>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
