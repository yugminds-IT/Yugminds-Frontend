"use client";

import { useState } from "react";
import { Copy, Eye, EyeOff, KeyRound, Loader2, RefreshCw, UserPlus } from "lucide-react";
import Modal from "../../portal/Modal";
import PasswordCoach from "../../portal/PasswordCoach";

export interface AdminFormValues { full_name: string; email: string; phone: string; school_id: string; temp_password: string }
export interface SchoolChoice { id: string; name: string; place?: string }

/** A random password that always has an uppercase letter, a lowercase letter, a number and a symbol. */
export function generatePassword(length = 12): string {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%&*"];
  const all = sets.join("");
  const pick = (s: string) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  const chars = sets.map(pick);
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  onCopy,
  error,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCopy: () => void;
  error?: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="sd-field-wrap">
      <label htmlFor={id}>{label}</label>
      <div className="st-input">
        <input id={id} className="sd-field" type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" aria-invalid={!!error} />
        <div className="st-input-r">
          <button type="button" className="st-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff /> : <Eye />}</button>
        </div>
      </div>
      {error ? <p className="st-hint" data-t="bad">{error}</p> : hint ? <p className="st-hint">{hint}</p> : null}
      <div className="sa-pwrow">
        <button type="button" className="sd-btn sd-btn--line" onClick={() => onChange(generatePassword())}><RefreshCw aria-hidden="true" />Generate one</button>
        <button type="button" className="sd-btn sd-btn--line" onClick={onCopy} disabled={!value}><Copy aria-hidden="true" />Copy</button>
      </div>
      <PasswordCoach password={value} />
    </div>
  );
}

/** Add a school admin, or edit one's details. Passwords are reset from their own dialog. */
export function AdminFormModal({
  mode,
  open,
  values,
  errors,
  schools,
  busy,
  onChange,
  onCopyPassword,
  onSubmit,
  onClose,
}: {
  mode: "add" | "edit";
  open: boolean;
  values: AdminFormValues;
  errors: Record<string, string>;
  schools: SchoolChoice[];
  busy: boolean;
  onChange: (field: keyof AdminFormValues, value: string) => void;
  onCopyPassword: () => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const add = mode === "add";
  const field = (id: keyof AdminFormValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="sd-field-wrap">
      <label htmlFor={`sa-${mode}-${id}`}>{label}</label>
      <input id={`sa-${mode}-${id}`} className="sd-field" value={values[id] ?? ""} onChange={(e) => onChange(id, e.target.value)} aria-invalid={!!errors[id]} {...props} />
      {errors[id] && <p className="st-hint" data-t="bad">{errors[id]}</p>}
    </div>
  );
  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose(); }}
      title={add ? "Add school admin" : "Edit school admin"}
      subtitle={add ? "They sign in with the email and temporary password you set here." : "Change their details or move them to another school."}
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="sd-btn sd-btn--amber" onClick={onSubmit} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : add ? <UserPlus aria-hidden="true" /> : null}
            {add ? "Add school admin" : "Save changes"}
          </button>
        </>
      }
    >
      <form className="sm-form sa-form" onSubmit={(e) => { e.preventDefault(); if (!busy) onSubmit(); }} noValidate>
        {field("full_name", "Full name", { autoComplete: "off", placeholder: "For example, Ravi Teja" })}
        <div className="sm-two">
          {field("email", "Email", { type: "email", autoComplete: "off", placeholder: "name@school.org" })}
          {field("phone", "Phone", { type: "tel", autoComplete: "off", placeholder: "10-digit number" })}
        </div>
        <div className="sd-field-wrap">
          <label htmlFor={`sa-${mode}-school`}>School</label>
          <select id={`sa-${mode}-school`} className="sd-field" value={values.school_id} onChange={(e) => onChange("school_id", e.target.value)} aria-invalid={!!errors.school_id}>
            <option value="">{schools.length ? "Choose a school" : "No schools yet. Add a school first"}</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}{s.place ? `, ${s.place}` : ""}</option>)}
          </select>
          {errors.school_id && <p className="st-hint" data-t="bad">{errors.school_id}</p>}
        </div>
        {add && (
          <PasswordField
            id="sa-add-password"
            label="Temporary password"
            value={values.temp_password}
            onChange={(v) => onChange("temp_password", v)}
            onCopy={onCopyPassword}
            error={errors.temp_password}
            hint="Share it with them safely. They can change it after they sign in."
          />
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/** Set a new password for someone who has forgotten theirs. */
export function ResetPasswordModal({
  name,
  open,
  password,
  busy,
  onPassword,
  onCopy,
  onClose,
  onConfirm,
}: {
  name: string;
  open: boolean;
  password: string;
  busy: boolean;
  onPassword: (v: string) => void;
  onCopy: () => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose(); }}
      title="Reset password"
      subtitle={name ? `${name} will need the new password the next time they sign in.` : undefined}
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="sd-btn sd-btn--amber" onClick={onConfirm} disabled={busy || password.length < 8}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
            Reset password
          </button>
        </>
      }
    >
      <form className="sm-form" onSubmit={(e) => { e.preventDefault(); if (!busy && password.length >= 8) onConfirm(); }}>
        <PasswordField id="sa-reset-password" label="New password" value={password} onChange={onPassword} onCopy={onCopy} />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
