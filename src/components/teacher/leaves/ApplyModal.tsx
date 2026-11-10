"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import Modal from "../../portal/Modal";
import { useApplyLeave } from "@/hooks/useTeacherData";
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm";
import { loadFormData, clearFormData } from "@/lib/form-persistence";
import { requestClose } from "@/hooks/useUnsavedCloseGuard";
import { plural } from "../overview/utils";
import { daysBetween, shiftDate } from "./utils";

const KEY = "teacher-leave-form";
type Draft = { school_id: string; start_date: string; end_date: string; reason: string; substitute_required: boolean; is_emergency: boolean };

/**
 * Ask for leave. Regular leave goes in before 8 PM IST and cannot start in the past. Emergency leave skips the
 * cutoff, may start two days back, and needs two approvals in order. The draft is kept on this device until sent.
 */
export default function ApplyModal({
  schools,
  defaultSchoolId,
  serverToday,
  onClose,
  onSent,
}: {
  schools: { id?: string; name?: string }[];
  defaultSchoolId?: string;
  serverToday: string;
  onClose: () => void;
  onSent: (emergency: boolean) => void;
}) {
  const applyLeave = useApplyLeave();
  const [saved] = useState(() => (typeof window !== "undefined" ? loadFormData<Draft>(KEY) : null));
  const [f, setF] = useState<Draft>(() => ({
    school_id: defaultSchoolId ?? schools[0]?.id ?? "",
    start_date: "",
    end_date: "",
    reason: "",
    substitute_required: false,
    is_emergency: false,
    ...(saved ?? {}),
    ...(saved?.school_id && !schools.some((s) => s.id === saved.school_id) ? { school_id: defaultSchoolId ?? schools[0]?.id ?? "" } : {}),
  }));
  const [error, setError] = useState("");

  const { isDirty, clearSavedData } = useAutoSaveForm({
    formId: KEY,
    formData: f,
    autoSave: true,
    autoSaveInterval: 2000,
    debounceDelay: 500,
    useSession: false,
    onLoad: (data) => { if (data && !saved) setF(data as Draft); },
    markDirty: true,
  });
  const dirty = isDirty && (!!f.start_date || !!f.end_date || !!f.reason.trim() || f.substitute_required || f.is_emergency);
  const busy = applyLeave.isPending;
  const discard = () => { clearSavedData(); clearFormData(KEY); onClose(); };
  const close = () => { if (!busy) void requestClose(dirty, discard); };

  const min = f.is_emergency ? shiftDate(serverToday, -2) : serverToday;
  const days = f.start_date && f.end_date && f.end_date >= f.start_date ? daysBetween(f.start_date, f.end_date) : 0;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setF((p) => ({ ...p, [k]: v })); setError(""); };
  const missing = !f.school_id ? "choose a school" : !f.start_date || !f.end_date ? "pick the dates" : f.end_date < f.start_date ? "the end date must not be before the start" : !f.reason.trim() ? "give a reason" : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (missing || busy) return;
    try {
      await applyLeave.mutateAsync({
        school_id: f.school_id,
        start_date: f.start_date,
        end_date: f.end_date,
        reason: f.reason.trim(),
        substitute_required: f.substitute_required,
        is_emergency: f.is_emergency || undefined,
      });
      clearSavedData();
      clearFormData(KEY);
      onSent(f.is_emergency);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || (err instanceof Error ? err.message : "The request was not sent."));
    }
  };

  return (
    <Modal
      open
      onClose={close}
      title="Apply for leave"
      subtitle="Your school admin and the admin review it. Either can approve or reject."
      footer={
        <>
          {missing && <span className="sd-modal-note">Still needed: {missing}.</span>}
          <button type="button" className="sd-btn sd-btn--line" onClick={close} disabled={busy}>Cancel</button>
          <button type="submit" form="lv-form" className="sd-btn sd-btn--amber" disabled={busy || !!missing}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            {busy ? "Sending" : "Send request"}
          </button>
        </>
      }
    >
      <form id="lv-form" className="lv-form" onSubmit={submit} noValidate>
        {error && <p className="lv-error" role="alert">{error}</p>}

        {schools.length > 1 && (
          <div className="sd-field-wrap">
            <label htmlFor="school_id">Which school?</label>
            <select id="school_id" className="sd-field" value={f.school_id} onChange={(e) => set("school_id", e.target.value)}>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        <div className="lv-dates">
          <div className="sd-field-wrap">
            <label htmlFor="start_date">From</label>
            <input id="start_date" className="sd-field" type="date" value={f.start_date} min={min} onChange={(e) => set("start_date", e.target.value)} />
          </div>
          <div className="sd-field-wrap">
            <label htmlFor="end_date">To</label>
            <input id="end_date" className="sd-field" type="date" value={f.end_date} min={f.start_date || min} onChange={(e) => set("end_date", e.target.value)} />
          </div>
        </div>
        {days > 0 && <p className="lv-days" aria-live="polite"><b>{plural(days, "day")}</b> of leave</p>}

        <div className="sd-field-wrap">
          <label htmlFor="reason">Reason</label>
          <textarea id="reason" className="sd-field" rows={4} maxLength={1000} placeholder="Tell your admin why you need leave" value={f.reason} onChange={(e) => set("reason", e.target.value)} aria-required="true" />
        </div>

        <label className="lv-check" data-tone={f.is_emergency ? "red" : undefined}>
          <input type="checkbox" id="is_emergency" checked={f.is_emergency} onChange={(e) => set("is_emergency", e.target.checked)} />
          <span><b>This is an emergency</b><small>Skips the 8 PM cutoff and can start up to 2 days back. It needs two approvals in order: your school admin first, then the admin.</small></span>
        </label>
        {!f.is_emergency && <p className="lv-fine">Regular leave must be sent before 8 PM IST and cannot start in the past.</p>}

        <label className="lv-check">
          <input type="checkbox" id="substitute_required" checked={f.substitute_required} onChange={(e) => set("substitute_required", e.target.checked)} />
          <span><b>I need a substitute teacher</b><small>Lets your admin know your classes need covering.</small></span>
        </label>
      </form>
    </Modal>
  );
}
