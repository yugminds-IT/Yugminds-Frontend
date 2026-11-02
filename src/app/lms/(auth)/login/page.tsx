"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Info, ShieldAlert, Clock } from "lucide-react";

import AuthShell from "@/components/public/AuthShell";
import LoginShowcase from "@/components/public/LoginShowcase";
import { brandHref } from "@/lib/brand-host";
import { markFreshLogin } from "@/hooks/useSessionValidation";
import { shortenUserId } from "@/lib/utils";
import { setStoredSession, waitForSession, consumeLogoutReason, safeNextPath } from "@/lib/session-utils";
import { authApi, commonApi } from "@/lib/api";

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
  const router = useRouter();

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

      commonApi.auth
        .trackLogin({
          user_id: String(authRes.user.id),
          email,
          success: true,
          ip_address: null,
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : null,
        })
        .catch(() => {});

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

      setError(msg);

      commonApi.auth
        .trackLogin({
          email: (() => {
            try {
              const fd = new FormData(event.currentTarget);
              return String(fd.get("email") || "").trim();
            } catch {
              return "";
            }
          })(),
          success: false,
          failure_reason: rawMsg,
          ip_address: null,
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : null,
        })
        .catch(() => {});
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
