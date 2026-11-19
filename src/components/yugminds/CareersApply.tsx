"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { commonApi } from "@/lib/api/common.api";
import { checkStep, consentText, coreField, CORE_DEFAULT, CORE_KEYS, initial, type Answers, type FormConfig, type Value } from "@/lib/careers-form";
import QuestionField from "@/components/careers/QuestionField";


const DRAFT = "ym-careers-draft";

type Core = { fullName: string; email: string; phone: string; city: string; consent: boolean };
const EMPTY: Core = { fullName: "", email: "", phone: "", city: "", consent: false };

const input =
  "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-base text-ym-text outline-none focus-visible:border-ym-blue focus-visible:ring-2 focus-visible:ring-ym-blue/30";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-ym-text">
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}
    </label>
  );
}

/** Returns an error message for the fixed steps (About you, Resume), or "" when it can continue. */
function checkCore(step: "about" | "resume", f: Core, file: File | null, form: FormConfig): string {
  if (step === "about") {
    if (!f.fullName.trim()) return `Enter your ${coreField(form, "fullName").label.toLowerCase()}.`;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return "Enter a valid email.";
    const p = coreField(form, "phone"), c = coreField(form, "city");
    if (p.mode === "required" || (p.mode === "optional" && f.phone.trim()))
      if (!/^(\+?91)?[6-9]\d{9}$/.test(f.phone.replace(/[\s()-]/g, ""))) return "Enter a 10-digit mobile number.";
    if (c.mode === "required" && !f.city.trim()) return `Enter your ${c.label.toLowerCase()}.`;
    return "";
  }
  if (form.resume === "required" && !file) return "Attach your resume.";
  if (file) {
    if (file.size > 5 * 1024 * 1024) return "Resume must be 5 MB or smaller.";
    if (!/\.(pdf|doc|docx)$/i.test(file.name)) return "Resume must be a PDF or Word file.";
  }
  if (!f.consent) return "Please accept the consent to apply.";
  return "";
}

export default function CareersApply({ slug }: { slug: string }) {
  const [roleState, setRoleState] = useState<"loading" | "open" | "gone" | "error">("loading");
  const [roleName, setRoleName] = useState(slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
  const [form, setForm] = useState<FormConfig | null>(null);
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Core>(EMPTY);
  const [answers, setAnswers] = useState<Answers>({});
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [ref, setRef] = useState("");
  const top = useRef<HTMLHeadingElement>(null);
  const key = `${DRAFT}-${slug}`;

  useEffect(() => {
    commonApi.careers.opening(slug)
      .then((r: { data?: { title: string; status: string; form: FormConfig } }) => {
        const o = r.data;
        if (!o || o.status !== "open") return setRoleState("gone");
        setRoleName(o.title);
        const start: Answers = {};
        for (const st of o.form.steps) for (const q of st.questions) start[q.id] = initial(q);
        // Restore a saved draft (never the file, never consent).
        try {
          const d = JSON.parse(localStorage.getItem(key) ?? "null");
          if (d) {
            setF({ ...EMPTY, ...d.f, consent: false });
            for (const id of Object.keys(start)) if (d.answers?.[id] !== undefined) start[id] = d.answers[id];
          }
        } catch {}
        setAnswers(start);
        setForm(o.form);
        setRoleState("open");
      })
      .catch((x: { response?: { status?: number } }) => setRoleState(x.response?.status === 404 ? "gone" : "error"));
  }, [slug, key]);
  useEffect(() => {
    try {
      if (form && !ref) localStorage.setItem(key, JSON.stringify({ f: { ...f, consent: false }, answers }));
    } catch {}
  }, [f, answers, ref, form, key]);

  const names = form ? ["About you", ...form.steps.map((s) => s.title), form.resume === "off" ? "Consent" : "Resume"] : [];
  const last = names.length - 1;
  const set = <K extends keyof Core>(k: K, v: Core[K]) => setF((p) => ({ ...p, [k]: v }));
  const go = (n: number) => {
    setStep(n);
    setErr("");
    top.current?.focus();
  };
  const check = (n: number) =>
    !form ? "" : n === 0 ? checkCore("about", f, null, form) : n === last ? checkCore("resume", f, file, form) : checkStep(form.steps[n - 1].questions, answers);

  async function submit() {
    if (!form) return;
    const e = check(last);
    if (e) return setErr(e);
    setSending(true);
    setErr("");
    const fd = new FormData();
    if (file && form.resume !== "off") fd.append("resume", file);
    fd.append("data", JSON.stringify({ ...f, fullName: f.fullName.trim(), email: f.email.trim(), city: f.city.trim(), answers }));
    try {
      const res = await commonApi.careers.apply(slug, fd);
      setRef(res.data?.ref ?? "");
      try { localStorage.removeItem(key); } catch {}
      window.scrollTo({ top: 0 });
    } catch (x) {
      const r = (x as { response?: { status?: number; data?: { message?: string | string[] } } }).response;
      const m = Array.isArray(r?.data?.message) ? r?.data?.message.join(", ") : r?.data?.message;
      setErr(
        r?.status === 429
          ? "Too many tries in a minute. Wait a moment and send again."
          : r?.status === 409 || r?.status === 400
            ? m || "Please check the form."
            : "Your application did not send. Check your connection and try again, or email info@yugminds.org.",
      );
    } finally {
      setSending(false);
    }
  }

  if (ref)
    return (
      <section className="mx-auto max-w-2xl px-5 pb-20 pt-32 text-center">
        <h1 className="font-acdisplay text-4xl font-bold text-ym-text">Application received</h1>
        <p className="mt-4 text-slate-700">Thank you for applying. Your reference is</p>
        <p className="mt-2 font-mono text-2xl font-bold text-ym-blue">{ref}</p>
        <p className="mt-4 text-slate-600">
          We sent a confirmation to your email. Our team reviews applications within a few days and will call you if it
          is a fit. Keep your phone handy.
        </p>
        <Link href={`/careers/status?ref=${ref}`} className="mt-8 inline-flex min-h-11 items-center rounded-md bg-ym-blue px-6 font-semibold text-white hover:bg-ym-blue-lit">Track your application</Link>
        <p className="mt-3 text-sm text-slate-600">Save your reference. You will need it, with your email, to check your status.</p>
        <Link href="/#careers" className="mt-6 inline-block font-semibold text-ym-blue underline">Back to careers</Link>
      </section>
    );

  if (roleState === "gone" || roleState === "error")
    return (
      <section className="mx-auto max-w-2xl px-5 pb-20 pt-28 md:pt-32">
        <h1 className="font-acdisplay text-3xl font-bold text-ym-text md:text-4xl">
          {roleState === "gone" ? "This role is no longer open" : "We could not load this form"}
        </h1>
        <p className="mt-4 text-slate-700">
          {roleState === "gone" ? "We have filled this role or taken it down. See what else is open." : "Check your connection and reload the page."}
        </p>
        <Link href={`/careers/${slug}`} className="mt-8 inline-block font-semibold text-ym-blue underline">View this role</Link>
        <Link href="/#careers" className="mt-8 ml-6 inline-block font-semibold text-ym-blue underline">All open roles</Link>
      </section>
    );

  if (!form)
    return <section className="mx-auto max-w-2xl px-5 pb-20 pt-32 text-slate-600">Loading…</section>;

  return (
    <section className="mx-auto max-w-2xl px-5 pb-20 pt-28 md:pt-32">
      <Link href={`/careers/${slug}`} className="mb-4 inline-block text-sm font-semibold text-ym-blue underline">← Back to role details</Link>
      <h1 ref={top} tabIndex={-1} className="font-acdisplay text-3xl font-bold text-ym-text outline-none md:text-4xl">
        Apply: {roleName}
      </h1>
      <p className="mt-2 text-sm text-slate-600">Step {step + 1} of {names.length}: {names[step]}</p>
      <div className="mt-3 h-1.5 rounded bg-slate-200" role="progressbar" aria-valuemin={1} aria-valuemax={names.length} aria-valuenow={step + 1}>
        <div className="h-full rounded bg-ym-blue transition-[width]" style={{ width: `${((step + 1) / names.length) * 100}%` }} />
      </div>

      <form
        className="mt-8 space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (step === last) return void submit();
          const m = check(step);
          if (m) setErr(m);
          else go(step + 1);
        }}
      >
        {step === 0 && (
          <>
            {CORE_KEYS.map((k) => {
              const { label, mode } = coreField(form, k);
              if (mode === "off") return null;
              const p = { className: input, value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value) };
              return (
                <Field key={k} label={`${label}${mode === "optional" ? " (optional)" : ""}`} hint={k === "phone" ? CORE_DEFAULT.phone.hint : undefined}>
                  {k === "fullName" ? <input {...p} autoComplete="name" maxLength={80} />
                    : k === "email" ? <input {...p} type="email" autoComplete="email" maxLength={200} />
                    : k === "phone" ? <input {...p} type="tel" inputMode="tel" autoComplete="tel" />
                    : <input {...p} autoComplete="address-level2" maxLength={80} />}
                </Field>
              );
            })}
          </>
        )}
        {step > 0 && step < last &&
          form.steps[step - 1].questions.map((q) => (
            <QuestionField key={q.id} q={q} value={answers[q.id] ?? initial(q)} onChange={(v: Value) => setAnswers((p) => ({ ...p, [q.id]: v }))} />
          ))}
        {step === last && (
          <>
            {form.resume !== "off" && (
              <Field label={`Resume (PDF or Word, up to 5 MB)${form.resume === "optional" ? " (optional)" : ""}`}>
                <input className={input} type="file" accept=".pdf,.doc,.docx,application/pdf" onChange={(e) => {
                  const picked = e.target.files?.[0] ?? null;
                  const bad = picked ? checkCore("resume", { ...f, consent: true }, picked, { ...form, resume: "optional" }) : "";
                  if (bad) { e.target.value = ""; setFile(null); setErr(bad); } else { setFile(picked); setErr(""); }
                }} />
                {file && <p className="mt-1 text-xs text-slate-600">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
              </Field>
            )}
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" className="mt-1" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} />
              <span>{consentText(form)}</span>
            </label>
          </>
        )}

        {err && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        <div className="flex items-center justify-between pt-2">
          {step > 0 ? <button type="button" onClick={() => go(step - 1)} className="min-h-11 rounded-md px-4 font-semibold text-slate-700 hover:bg-slate-100">Back</button> : <span />}
          <button type="submit" disabled={sending} className="min-h-11 rounded-md bg-ym-blue px-6 font-semibold text-white hover:bg-ym-blue-lit disabled:opacity-60">
            {step === last ? (sending ? "Sending…" : "Submit application") : "Next"}
          </button>
        </div>
      </form>
    </section>
  );
}
