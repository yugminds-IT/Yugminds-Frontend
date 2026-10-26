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
    return <div className="flex justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ac-brand" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-acdisplay text-3xl font-bold leading-tight text-ac-ink sm:text-4xl">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">Sign in to continue your courses, classes and certificates.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-5">
        <GlassField label="Email address" htmlFor="email">
          <input id="email" name="email" type="email" autoComplete="email" required placeholder="Enter your email address" className={glassInput} />
        </GlassField>
        <GlassField label="Password" htmlFor="password">
          <PasswordInput id="password" name="password" autoComplete="current-password" required placeholder="Enter your password" />
        </GlassField>
        <div className="flex justify-end text-sm">
          <Link href="/academy/forgot-password" className="text-ac-brand hover:underline">Forgot password?</Link>
        </div>
        <AuthError message={error} />
        <AuthSubmit busy={busy}>{busy ? "Signing in…" : "Sign In"}</AuthSubmit>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        New to RoboCoders Academy?{" "}
        <Link href={`/academy/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-ac-brand hover:underline">
          Create a free account
        </Link>
      </p>
    </div>
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
