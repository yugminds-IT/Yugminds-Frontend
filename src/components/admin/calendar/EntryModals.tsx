"use client";

import { Loader2, Sun } from "lucide-react";
import Modal from "../../portal/Modal";
import { ChipGroup } from "../../portal/notifications";
import { TYPES, TYPE_HINT, TYPE_LABEL, type EntryType } from "./utils";

export interface EntryForm {
  scope: "school" | "all";
  school_id: string;
  date: string;
  end_date: string;
  name: string;
  type: EntryType;
  description: string;
}
type School = { id: string; name: string };

const SCOPES = [["school", "One school"], ["all", "All schools"]] as const;

/** Add or edit one calendar entry. A school only appears if someone teaches there on the chosen date. */
export function EntryFormModal({
  open,
  editing,
  form,
  onChange,
  schools,
  schoolsOnDate,
  error,
  busy,
  onSubmit,
  onClose,
}: {
  open: boolean;
  editing: boolean;
  form: EntryForm;
  onChange: (patch: Partial<EntryForm>) => void;
  schools: School[];
  /** the schools where somebody teaches on the chosen date */
  schoolsOnDate: School[];
  error: string | null;
  busy: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const choices = editing ? schools : schoolsOnDate;
  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose(); }}
      title={editing ? "Edit calendar entry" : "Add calendar entry"}
      subtitle={editing ? "Change the dates, the reason or the kind." : "Declare a holiday, break, half day or make-up working day."}
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="sd-btn sd-btn--amber" onClick={onSubmit} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}{editing ? "Save changes" : "Add entry"}
          </button>
        </>
      }
    >
      <form className="sm-form" onSubmit={(e) => { e.preventDefault(); if (!busy) onSubmit(); }} noValidate>
        {!editing && (
          <div className="sd-field-wrap">
            <label id="ac-scope">Apply to</label>
            <ChipGroup label="Apply to" value={form.scope} options={SCOPES} onChange={(v) => onChange({ scope: v })} />
          </div>
        )}
        {(editing || form.scope === "school") && (
          <div className="sd-field-wrap">
            <label htmlFor="ac-school">School</label>
            <select id="ac-school" className="sd-field" value={form.school_id} disabled={editing} onChange={(e) => onChange({ school_id: e.target.value })}>
              <option value="">Choose a school</option>
              {choices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {!editing && choices.length === 0 && <p className="st-hint" data-t="bad">Nobody works at any school on this date. Pick another date, or apply it to all schools.</p>}
          </div>
        )}
        <div className="sm-two">
          <div className="sd-field-wrap">
            <label htmlFor="ac-date">First day</label>
            <input id="ac-date" type="date" className="sd-field" value={form.date} onChange={(e) => onChange({ date: e.target.value })} />
          </div>
          <div className="sd-field-wrap">
            <label htmlFor="ac-end">Last day <small>(optional)</small></label>
            <input id="ac-end" type="date" className="sd-field" min={form.date} value={form.end_date} onChange={(e) => onChange({ end_date: e.target.value })} />
          </div>
        </div>
        <div className="sd-field-wrap">
          <label htmlFor="ac-type">Kind</label>
          <select id="ac-type" className="sd-field" value={form.type} onChange={(e) => onChange({ type: e.target.value as EntryType })}>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          <p className="st-hint">{TYPE_HINT[form.type]}</p>
        </div>
        <div className="sd-field-wrap">
          <label htmlFor="ac-name">Reason</label>
          <input id="ac-name" className="sd-field" value={form.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="For example, Diwali, Republic Day, local bandh" aria-invalid={!!error && !form.name.trim()} />
        </div>
        <div className="sd-field-wrap">
          <label htmlFor="ac-notes">Notes <small>(optional)</small></label>
          <textarea id="ac-notes" className="sd-field" rows={3} value={form.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="Anything staff should know" />
        </div>
        {error && <p className="st-hint" data-t="bad" role="alert">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/** A sudden closure: today becomes a holiday straight away, so it never counts as an absence. */
export function MarkTodayModal({
  open,
  scope,
  onScope,
  schoolId,
  onSchool,
  reason,
  onReason,
  notes,
  onNotes,
  schools,
  error,
  busy,
  onSubmit,
  onClose,
}: {
  open: boolean;
  scope: "school" | "all";
  onScope: (s: "school" | "all") => void;
  schoolId: string;
  onSchool: (id: string) => void;
  reason: string;
  onReason: (v: string) => void;
  notes: string;
  onNotes: (v: string) => void;
  /** schools where somebody works today */
  schools: School[];
  error: string | null;
  busy: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose(); }}
      title="Mark today as a holiday"
      subtitle="For a sudden closure, like a bandh, bad weather or an emergency. Attendance is corrected straight away."
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="sd-btn sd-btn--danger" onClick={onSubmit} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sun aria-hidden="true" />}Mark as holiday
          </button>
        </>
      }
    >
      <form className="sm-form" onSubmit={(e) => { e.preventDefault(); if (!busy) onSubmit(); }} noValidate>
        <p className="nt-summary">Today stops counting as a working day. Nobody is marked absent for it, and it shows on attendance reports with your reason.</p>
        <div className="sd-field-wrap">
          <label id="ac-mt-scope">Apply to</label>
          <ChipGroup label="Apply to" value={scope} options={SCOPES} onChange={onScope} />
        </div>
        {scope === "school" && (
          <div className="sd-field-wrap">
            <label htmlFor="ac-mt-school">School</label>
            <select id="ac-mt-school" className="sd-field" value={schoolId} onChange={(e) => onSchool(e.target.value)}>
              <option value="">Choose a school</option>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {schools.length === 0 && <p className="st-hint" data-t="bad">Nobody works at any school today. Try All schools, or add an entry for another date.</p>}
          </div>
        )}
        <div className="sd-field-wrap">
          <label htmlFor="ac-mt-reason">Reason</label>
          <input id="ac-mt-reason" className="sd-field" value={reason} onChange={(e) => onReason(e.target.value)} placeholder="For example, city-wide bandh, heavy flooding" autoFocus />
        </div>
        <div className="sd-field-wrap">
          <label htmlFor="ac-mt-notes">Notes <small>(optional)</small></label>
          <textarea id="ac-mt-notes" className="sd-field" rows={3} value={notes} onChange={(e) => onNotes(e.target.value)} placeholder="Anything staff should know" />
        </div>
        {error && <p className="st-hint" data-t="bad" role="alert">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
