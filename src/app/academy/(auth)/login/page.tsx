"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { academy } from "@/lib/academy/api";
import { errorText, refreshSession } from "@/lib/academy/client";
import { HOME_BY_ROLE, safeAcademyNext } from "@/lib/academy/paths";
import { AuthError, AuthSubmit, GlassField, PasswordInput, glassInput } from "@/components/academy/AuthLayout";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeAcademyNext(search.get("next"));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  // The middleware sends expired sessions here; a still-valid refresh cookie signs straight back in.
  useEffect(() => {
    refreshSession()
      .then(async (ok) => {
        if (!ok) return setChecking(false);
        const me = await academy.auth.me();
        router.replace(next ?? HOME_BY_ROLE[me.role]);
      })
      .catch(() => setChecking(false));
  }, [next, router]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const me = await academy.auth.login(String(f.get("email") ?? "").trim(), String(f.get("password") ?? ""));
      // A `next` in another role's area is bounced to the right home by the middleware.
      router.replace(next ?? HOME_BY_ROLE[me.role]);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  if (checking) {
    return <div className="lg-checking" role="status"><span className="lg-spin lg-spin--lg" aria-hidden="true" /> Checking your session</div>;
  }

  return (
    <>
      <h1>Welcome back.</h1>
      <p className="rh-lede">Sign in to continue your courses, classes and certificates.</p>
      <form onSubmit={onSubmit} className="lg-form">
        <GlassField label="Email address" htmlFor="email">
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" enterKeyHint="next" required placeholder="you@example.com" className={glassInput} />
        </GlassField>
        <GlassField label="Password" htmlFor="password">
          <PasswordInput id="password" name="password" autoComplete="current-password" enterKeyHint="go" required placeholder="Your password" />
        </GlassField>
        <div className="lg-row" style={{ justifyContent: "flex-end" }}>
          <Link href="/academy/forgot-password" className="rh-link">Forgot password?</Link>
        </div>
        <AuthError message={error} />
        <AuthSubmit busy={busy}>{busy ? "Signing in" : "Sign in"}</AuthSubmit>
      </form>
      <div className="lg-helps">
        <p className="lg-help">
          New to RoboCoders Academy?{" "}
          <Link href={`/academy/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="rh-link">Create a free account</Link>
        </p>
      </div>
    </>
  );
}

// useSearchParams needs a Suspense boundary on prerendered pages.
export default function AcademyLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
