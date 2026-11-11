"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Info, ShieldAlert, Clock, Wrench } from "lucide-react";

import AuthShell from "@/components/public/AuthShell";
import LoginShowcase from "@/components/public/LoginShowcase";
import { brandHref } from "@/lib/brand-host";
import { markFreshLogin } from "@/hooks/useSessionValidation";
import { shortenUserId } from "@/lib/utils";
import { setStoredSession, waitForSession, consumeLogoutReason, safeNextPath } from "@/lib/session-utils";
import { authApi } from "@/lib/api";
import { getBaseURL } from "@/lib/api/axios";

const LOGOUT_ICONS = {
  logged_out: <Info size={18} aria-hidden="true" />,
  session_expired: <ShieldAlert size={18} aria-hidden="true" />,
  session_timeout: <Clock size={18} aria-hidden="true" />,
  wrong_role: <ShieldAlert size={18} aria-hidden="true" />,
};

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [logoutNotice, setLogoutNotice] = useState<{ title: string; detail: string; icon: React.ReactNode } | null>(null);
  // Maintenance (Admin > System controls): shown before anyone types a password, not as an error afterwards.
  const [maintenance, setMaintenance] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let off = false;
    const load = () =>
      fetch(`${getBaseURL().replace(/\/$/, "")}/system-status`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { maintenance_mode?: boolean; maintenance_message?: string } | null) => {
          if (!off && d) setMaintenance(d.maintenance_mode ? (d.maintenance_message ?? "") : null);
        })
        .catch(() => {});
    void load();
    window.addEventListener("focus", load); // an admin may switch it off while this page is open
    return () => {
      off = true;
      window.removeEventListener("focus", load);
    };
  }, []);

  useEffect(() => {
    const reason = consumeLogoutReason();
    if (reason) {
      // consumeLogoutReason already removed the stored key, so the icon is inferred from the title.
      const t = reason.title.toLowerCase();
      const icon = t.includes("signed out")
        ? LOGOUT_ICONS.logged_out
        : t.includes("access")
        ? LOGOUT_ICONS.wrong_role
        : t.includes("timed")
        ? LOGOUT_ICONS.session_timeout
        : LOGOUT_ICONS.session_expired;
      setLogoutNotice({ ...reason, icon });
    }
  }, []);

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    let loginTimeout: NodeJS.Timeout | null = null;

    try {
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get("email") || "").trim();
      const password = String(formData.get("password") || "");

      if (!email || !password) {
        setError("Email and password are required.");
        return;
      }

      loginTimeout = setTimeout(() => {
        setError("Login is taking too long. Please try again.");
        setLoading(false);
      }, 60000);

      const authRes = await authApi.login({ email, password });
      if (loginTimeout) clearTimeout(loginTimeout);

      setStoredSession({
        access_token: authRes.tokens.accessToken,
        user: {
          id: String(authRes.user.id),
          email: authRes.user.email,
          mustChangePassword: (authRes.user as { mustChangePassword?: boolean }).mustChangePassword ?? false,
        },
      });

      await waitForSession(3, 300);
      markFreshLogin();

      const role = String(authRes.user.role || "").trim().toLowerCase();
      const roleRoutes: Record<string, string> = {
        admin: "/lms/admin",
        super_admin: "/lms/admin",
        school_admin: "/lms/school-admin",
        teacher: "/lms/teacher",
        student: "/lms/student",
      };

      const next = safeNextPath(
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next")
          : null,
      );

      console.log("✅ Login successful:", {
        userId: shortenUserId(String(authRes.user.id)),
        role,
      });

      router.push(next || roleRoutes[role] || "/lms/login");
    } catch (err: unknown) {
      if (loginTimeout) clearTimeout(loginTimeout);
      const apiErr = err as Error & { status?: number };
      const rawMsg = err instanceof Error ? err.message : String(err);

      // Always show a clean, user-friendly message for wrong credentials
      const is401 =
        apiErr.status === 401 ||
        rawMsg.toLowerCase().includes("invalid email") ||
        rawMsg.toLowerCase().includes("unauthorized") ||
        rawMsg === "[object Object]";

      const msg = is401
        ? "Invalid email or password"
        : rawMsg || "Login failed. Please try again.";

      // During maintenance the notice above already says it, so the server's 403 is not shown a second time as an error.
      const isMaintenanceBlock = apiErr.status === 403 && maintenance !== null && rawMsg.trim() === maintenance.trim();
      if (!isMaintenanceBlock) setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = () => router.push("/lms/forgot-password");
  const handleCreateAccount = () => router.push("/lms/signup");

  const neutral = logoutNotice?.title.toLowerCase().includes("signed out");

  return (
    <AuthShell sideTitle="Pick up where you left off." sideText="Your courses, assignments and certificates are one sign-in away." side={<LoginShowcase />}>
      <h1 id="lg-h1">Sign in to RoboCoders LMS.</h1>
      <p className="rh-lede">Use your school account to reach your courses, assignments and certificates.</p>

      {maintenance !== null && (
        <div className="lg-note lg-maint" role="status">
          <span className="lg-maint-ico" aria-hidden="true"><Wrench /></span>
          <div>
            <b>Sign-in is paused for maintenance</b>
            <p>{maintenance.trim() || "Please check back soon."}</p>
            <small>Admins can still sign in. If you are already signed in, you can keep working.</small>
          </div>
        </div>
      )}

      {logoutNotice && (
        <div className="lg-note" data-tone={neutral ? "info" : "warn"} role="status">
          {logoutNotice.icon}
          <div>
            <b>{logoutNotice.title}</b>
            <p>{logoutNotice.detail}</p>
          </div>
          <button type="button" onClick={() => setLogoutNotice(null)} aria-label="Dismiss">✕</button>
        </div>
      )}

      {error && (
        <div className="lg-note" data-tone="error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            {error.split("\n").map((line, i) => (
              <p key={i} style={i === 0 ? { fontWeight: 600 } : undefined}>{line}</p>
            ))}
          </div>
        </div>
      )}

      <form className="lg-form" onSubmit={handleSignIn} noValidate>
        <div className="lg-field">
          <label htmlFor="email">Email address</label>
          <div className="lg-input">
            <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" />
          </div>
        </div>
        <div className="lg-field">
          <label htmlFor="password">Password</label>
          <div className="lg-input lg-input--pw">
            <input id="password" name="password" type={showPw ? "text" : "password"} autoComplete="current-password" placeholder="Your password" />
            <button type="button" className="lg-eye" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}>
              {showPw ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>
        <div className="lg-row">
          <label className="lg-check">
            <input type="checkbox" name="rememberMe" autoComplete="off" />
            Keep me signed in
          </label>
          <button type="button" className="rh-link" onClick={handleResetPassword}>Reset password</button>
        </div>
        <button type="submit" className="rh-btn rh-btn--primary lg-submit" disabled={loading} aria-busy={loading}>
          {loading && <span className="lg-spin" aria-hidden="true" />}
          {loading ? "Signing in" : "Sign in"}
        </button>
      </form>

      <div className="lg-helps">
        <p className="lg-help">New to the platform? <button type="button" className="rh-link" onClick={handleCreateAccount}>Create an account</button></p>
        <p className="lg-help">Taking online classes instead? <Link href={brandHref("/academy/login")} className="rh-link">Use Academy login</Link></p>
      </div>
    </AuthShell>
  );
}
