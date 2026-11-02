"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle } from "lucide-react";
import { commonApi } from "@/lib/api";
import AuthShell from "@/components/public/AuthShell";
import AuthSteps from "@/components/public/AuthSteps";

const STEPS = [
  { name: "You send a request", text: "Enter your email and submit it." },
  { name: "Your administrator reviews it", text: "They set a temporary password for your account." },
  { name: "You get the temporary password", text: "You get an in-app notification, and your administrator gives you the password directly." },
  { name: "You choose a new password", text: "Sign in with the temporary one. You'll be asked to set a new password straight away." },
];

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { data } = await commonApi.auth.passwordResetRequest({ email: email.trim() });
      setMessage((data as { message?: string })?.message || "Your request has been submitted.");
      setSubmitted(true);
    } catch (error: unknown) {
      console.error("Error submitting password reset request:", error);
      setError(error instanceof Error ? error.message : "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      sideTitle="Locked out? It takes four steps."
      sideText="Your administrator helps you back in. Here is how a reset works."
      side={<AuthSteps steps={STEPS} stage={1} auto={!submitted} label="How a password reset works" />}
    >
      <h1>Forgot your password?</h1>
      <p className="rh-lede">Submit a reset request. Your administrator will review it and set a temporary password.</p>

      {submitted ? (
        <>
          <div className="lg-note" data-tone="ok" role="status">
            <CheckCircle size={18} aria-hidden="true" />
            <div>
              <b>Request submitted</b>
              <p>{message} Your administrator will review it and get back to you directly.</p>
            </div>
          </div>
          <div className="lg-actions">
            <button type="button" className="rh-btn rh-btn--ghost" onClick={() => { setSubmitted(false); setEmail(""); setMessage(""); }}>
              Submit another request
            </button>
            <Link href="/lms/login" className="rh-btn rh-btn--primary">Back to sign in</Link>
          </div>
        </>
      ) : (
        <form className="lg-form" onSubmit={handleResetPassword}>
          {error && (
            <div className="lg-note" data-tone="error" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div><b>We couldn&apos;t send the request</b><p>{error}</p></div>
            </div>
          )}
          <div className="lg-field">
            <label htmlFor="email">Email address</label>
            <div className="lg-input">
              <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" disabled={loading} />
            </div>
            <span className="lg-hint">Use the email address linked to your account.</span>
          </div>
          <button type="submit" className="rh-btn rh-btn--primary lg-submit" disabled={loading || !email.trim()} aria-busy={loading}>
            {loading && <span className="lg-spin" aria-hidden="true" />}
            {loading ? "Sending request" : "Send reset request"}
          </button>
        </form>
      )}

      <div className="lg-helps">
        <p className="lg-help">
          <Link href="/lms/login" className="rh-link"><ArrowLeft size={14} aria-hidden="true" style={{ display: "inline", verticalAlign: "-2px" }} /> Back to sign in</Link>
        </p>
      </div>
    </AuthShell>
  );
}
