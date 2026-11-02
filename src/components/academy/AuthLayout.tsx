"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import AuthShell from "@/components/public/AuthShell";
import AcademyShowcase from "./AcademyShowcase";

/**
 * Split auth screen shared by Academy login, signup and forgot password. It wears the RoboCoders site look (navy grid
 * panel, plain form) and keeps the Academy's own account system: nothing here touches the LMS.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthShell
      sideTitle="One account. Everything you need to start building."
      sideText="Courses to learn at your own pace, live classes with a tutor, and certificates anyone can verify."
      side={<AcademyShowcase />}
    >
      {children}
    </AuthShell>
  );
}

/** A labelled form field. The input inside takes its look from the field wrapper. */
export function GlassField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="lg-field">
      <label htmlFor={htmlFor}>{label}</label>
      <div className="lg-input">{children}</div>
      {hint && <span className="lg-hint">{hint}</span>}
    </div>
  );
}

/** Kept so existing pages still pass it; the wrapper above styles the input. */
export const glassInput = "";

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="lg-input--pw">
      <input {...props} type={show ? "text" : "password"} />
      <button type="button" className="lg-eye" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
      </button>
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="lg-note" data-tone="error" role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <div><p style={{ whiteSpace: "pre-line" }}>{message}</p></div>
    </div>
  );
}

export function AuthSubmit({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button disabled={busy} aria-busy={busy} className="rh-btn rh-btn--primary lg-submit">
      {busy && <span className="lg-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function PasswordRules() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}><CheckCircle2 size={13} aria-hidden="true" /> 8+ characters with an uppercase letter, a lowercase letter and a number</span>
  );
}
