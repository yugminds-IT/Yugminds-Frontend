"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { academy } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { safeAcademyNext } from "@/lib/academy/paths";
import { AuthError, AuthSubmit, GlassField, PasswordInput, PasswordRules, glassInput } from "@/components/academy/AuthLayout";

function SignupForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeAcademyNext(search.get("next"));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await academy.auth.signup({
        fullName: String(f.get("fullName") ?? "").trim(),
        email: String(f.get("email") ?? "").trim(),
        phone: String(f.get("phone") ?? "").trim(),
        password: String(f.get("password") ?? ""),
        parentName: String(f.get("parentName") ?? "").trim() || undefined,
      });
      router.replace(next ?? "/academy/learn");
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-acdisplay text-3xl font-bold leading-tight text-ac-ink sm:text-4xl">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">Free to join — start with a demo course or a free 1:1 trial class.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <GlassField label="Learner's full name" htmlFor="fullName" hint="Printed on certificates.">
          <input id="fullName" name="fullName" autoComplete="name" required minLength={2} placeholder="e.g. Aarav Sharma" className={glassInput} />
        </GlassField>
        <GlassField label="Parent's name (if under 18)" htmlFor="parentName">
          <input id="parentName" name="parentName" placeholder="Optional" className={glassInput} />
        </GlassField>
        <div className="grid gap-4 sm:grid-cols-2">
          <GlassField label="Email address" htmlFor="email">
            <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" className={glassInput} />
          </GlassField>
          <GlassField label="Phone" htmlFor="phone">
            <input id="phone" name="phone" type="tel" autoComplete="tel" required pattern="[0-9+\- ]{7,20}" placeholder="98765 43210" className={glassInput} />
          </GlassField>
        </div>
        <GlassField label="Password" htmlFor="password" hint={<PasswordRules />}>
          <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={8} placeholder="Create a password" />
        </GlassField>
        <AuthError message={error} />
        <AuthSubmit busy={busy}>{busy ? "Creating account…" : "Create Account"}</AuthSubmit>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={`/academy/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-ac-brand hover:underline">Sign in</Link>
      </p>
    </div>
  );
}

// useSearchParams needs a Suspense boundary on prerendered pages.
export default function AcademySignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
