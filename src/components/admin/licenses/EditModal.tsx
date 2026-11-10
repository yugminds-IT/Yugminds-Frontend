"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import Modal from "../../portal/Modal";
import { requestClose } from "@/hooks/useUnsavedCloseGuard";
import { cleanMachineId, type LicenseItem } from "./utils";

export interface EditValues { systemLabel: string; notes: string; isActive: boolean; machineId: string; durationDays: number; startDate: string }

/** Change a license. Anything that changes the key itself makes a new key, and the old one keeps working on the computer until it runs out. */
export default function EditModal({
  license,
  schoolName,
  busy,
  onClose,
  onSave,
}: {
  license: LicenseItem;
  schoolName: string;
  busy: boolean;
  onClose: () => void;
  onSave: (values: EditValues, regenerate: boolean) => void;
}) {
  const [v, setV] = useState<EditValues>({
    systemLabel: license.system_label,
    notes: license.notes ?? "",
    isActive: license.is_active,
    machineId: license.machine_id,
    durationDays: license.duration_days,
    startDate: license.start_date,
  });
  const dirty =
    v.systemLabel !== license.system_label || v.notes !== (license.notes ?? "") || v.isActive !== license.is_active ||
    v.machineId !== license.machine_id || Number(v.durationDays) !== license.duration_days || v.startDate !== license.start_date;
  const close = () => { if (!busy) void requestClose(dirty, onClose); };
  const set = (p: Partial<EditValues>) => setV((x) => ({ ...x, ...p }));

  return (
    <Modal
      open
      onClose={close}
      wide
      title="Edit license"
      subtitle={`${schoolName}, ${license.machine_id}`}
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={() => onSave(v, true)} disabled={busy} style={{ marginRight: "auto" }}>
            <RefreshCw aria-hidden="true" />Make a new key
          </button>
          <button className="sd-btn sd-btn--line" onClick={close} disabled={busy}>Cancel</button>
          <button className="sd-btn sd-btn--amber" onClick={() => onSave(v, false)} disabled={busy}>{busy && <Loader2 className="animate-spin" aria-hidden="true" />}Save changes</button>
        </>
      }
    >
      <form className="sm-form" onSubmit={(e) => { e.preventDefault(); if (!busy) onSave(v, false); }}>
        {license.key_build_mismatch && (
          <p className="lc-alert" role="alert"><AlertTriangle aria-hidden="true" />This key carries license number {license.license_number}, but the current build expects {license.expected_license_number}. The computer will reject it. Press <b>Make a new key</b> to issue one for the current build.</p>
        )}
        <div className="sd-field-wrap">
          <label htmlFor="lc-e-name">Computer</label>
          <input id="lc-e-name" className="sd-field" value={v.systemLabel} onChange={(e) => set({ systemLabel: e.target.value })} />
        </div>
        <div className="lc-switch">
          <div>
            <b id="lc-e-active">Active in this table</b>
            <p>This only changes the record here (filters and counts). Activation is offline, so switching it off does not stop a computer that already has the key. That key works until it expires.</p>
          </div>
          <button type="button" role="switch" aria-checked={v.isActive} aria-labelledby="lc-e-active" className="st-switch" onClick={() => set({ isActive: !v.isActive })} />
        </div>
        <fieldset className="lc-reissue">
          <legend>Changing these makes a new key</legend>
          <p>The old key is not cancelled. It keeps working on any computer it was already typed into until it runs out. Give the new key to the computer to replace it.</p>
          <div className="sm-two">
            <div className="sd-field-wrap">
              <label htmlFor="lc-e-mid">Machine ID</label>
              <input id="lc-e-mid" className="sd-field lc-mono" value={v.machineId} spellCheck={false} maxLength={16} onChange={(e) => set({ machineId: cleanMachineId(e.target.value) })} />
            </div>
            <div className="sd-field-wrap">
              <label htmlFor="lc-e-days">Days valid</label>
              <input id="lc-e-days" type="number" min={1} max={20000} className="sd-field" value={v.durationDays} onChange={(e) => set({ durationDays: Number(e.target.value) })} />
            </div>
          </div>
          <div className="sd-field-wrap" style={{ maxWidth: "16rem" }}>
            <label htmlFor="lc-e-start">Start date</label>
            <input id="lc-e-start" type="date" className="sd-field" value={v.startDate} onChange={(e) => set({ startDate: e.target.value })} />
          </div>
        </fieldset>
        <div className="sd-field-wrap">
          <label htmlFor="lc-e-notes">Notes</label>
          <textarea id="lc-e-notes" className="sd-field" rows={2} value={v.notes} onChange={(e) => set({ notes: e.target.value })} />
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
