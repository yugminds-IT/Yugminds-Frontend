"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { commonApi } from "@/lib/api/common.api";


const DRAFT = "ym-careers-draft";
const SKILLS = ["Scratch", "Python", "Arduino", "Robotics kits", "AI / ML basics", "Web / HTML"];
const BANDS = ["Grades 1-5", "Grades 6-8", "Grades 9-12"];
const STEPS = ["About you", "Background", "Skills", "Questions", "Resume"];

type Form = {
  fullName: string; email: string; phone: string; city: string; willTravel: boolean;
  qualification: string; college: string; gradYear: string; experienceYears: string; currentStatus: string;
  skills: string[]; gradeBands: string[]; englishLevel: number; hasTwoWheeler: boolean;
  why: string; explain: string; expectedSalary: string; joinDate: string; heardFrom: string; videoUrl: string;
  consent: boolean;
};
const EMPTY: Form = {
  fullName: "", email: "", phone: "", city: "", willTravel: true,
  qualification: "", college: "", gradYear: "", experienceYears: "0", currentStatus: "fresher",
  skills: [], gradeBands: [], englishLevel: 3, hasTwoWheeler: false,
  why: "", explain: "", expectedSalary: "", joinDate: "", heardFrom: "", videoUrl: "",
  consent: false,
};

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

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** Returns an error message for the step, or "" when it can continue. */
function check(step: number, f: Form, file: File | null): string {
  if (step === 0) {
    if (!f.fullName.trim()) return "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return "Enter a valid email.";
    if (!/^(\+?91)?[6-9]\d{9}$/.test(f.phone.replace(/[\s()-]/g, ""))) return "Enter a 10-digit mobile number.";
    if (!f.city.trim()) return "Enter your city or area.";
  }
  if (step === 1 && !f.qualification.trim()) return "Enter your highest qualification.";
  if (step === 3) {
    if (!f.why.trim()) return "Tell us why you want to be a trainer.";
    if (!f.explain.trim()) return "Answer the explain-it question.";
    if (f.videoUrl.trim() && !/^https?:\/\//i.test(f.videoUrl.trim())) return "The video link must start with https://";
  }
  if (step === 4) {
    if (!file) return "Attach your resume.";
    if (file.size > 5 * 1024 * 1024) return "Resume must be 5 MB or smaller.";
    if (!/\.(pdf|doc|docx)$/i.test(file.name)) return "Resume must be a PDF or Word file.";
    if (!f.consent) return "Please accept the consent to apply.";
  }
  return "";
}

export default function CareersApply({ slug }: { slug: string }) {
  const [roleState, setRoleState] = useState<"loading" | "open" | "gone">("loading");
  const [roleName, setRoleName] = useState(slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
  useEffect(() => {
    commonApi.careers.openings()
      .then((r: { data?: { openings?: { slug: string; title: string }[] } }) => {
        const list = r.data?.openings;
        if (!Array.isArray(list)) return setRoleState("open");
        const o = list.find((x) => x.slug === slug);
        if (o) setRoleName(o.title);
        setRoleState(o ? "open" : "gone");
      })
      .catch(() => setRoleState("open")); // server still enforces; do not block the form on a failed lookup
  }, [slug]);
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [ref, setRef] = useState("");
  const top = useRef<HTMLHeadingElement>(null);

  // Restore a saved draft (never the file, never consent).
  useEffect(() => {
    try {
      const d = localStorage.getItem(DRAFT);
      if (d) setF({ ...EMPTY, ...JSON.parse(d), consent: false });
    } catch {}
  }, []);
  useEffect(() => {
    try {
      if (!ref) localStorage.setItem(DRAFT, JSON.stringify({ ...f, consent: false }));
    } catch {}
  }, [f, ref]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const go = (n: number) => {
    setStep(n);
    setErr("");
    top.current?.focus();
  };

  async function submit() {
    const e = check(4, f, file);
    if (e) return setErr(e);
    setSending(true);
    setErr("");
    const fd = new FormData();
    fd.append("resume", file as File);
    fd.append(
      "data",
      JSON.stringify({
        ...f,
        fullName: f.fullName.trim(), email: f.email.trim(), city: f.city.trim(),
        gradYear: f.gradYear || null, experienceYears: f.experienceYears || 0,
        expectedSalary: f.expectedSalary || null,
      }),
    );
    try {
      const res = await commonApi.careers.apply(slug, fd);
      setRef(res.data?.ref ?? "");
      try { localStorage.removeItem(DRAFT); } catch {}
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

  if (roleState === "gone")
    return (
      <section className="mx-auto max-w-2xl px-5 pb-20 pt-28 md:pt-32">
        <h1 className="font-acdisplay text-3xl font-bold text-ym-text md:text-4xl">
          This role is no longer open
        </h1>
        <p className="mt-4 text-slate-700">
          We have filled this role or taken it down. See what else is open.
        </p>
        <Link href="/#careers" className="mt-8 inline-block font-semibold text-ym-blue underline">Back to careers</Link>
      </section>
    );

  return (
    <section className="mx-auto max-w-2xl px-5 pb-20 pt-28 md:pt-32">
      <h1 ref={top} tabIndex={-1} className="font-acdisplay text-3xl font-bold text-ym-text outline-none md:text-4xl">
        Apply: {roleName}
      </h1>
      <p className="mt-2 text-sm text-slate-600">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
      <div className="mt-3 h-1.5 rounded bg-slate-200" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
        <div className="h-full rounded bg-ym-blue transition-[width]" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      <form
        className="mt-8 space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (step === STEPS.length - 1) return void submit();
          const m = check(step, f, file);
          if (m) setErr(m);
          else go(step + 1);
        }}
      >
        {step === 0 && (
          <>
            <Field label="Full name"><input className={input} autoComplete="name" maxLength={80} value={f.fullName} onChange={(e) => set("fullName", e.target.value)} /></Field>
            <Field label="Email"><input className={input} type="email" autoComplete="email" maxLength={200} value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="Mobile number" hint="10 digits. We will call this number."><input className={input} type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label="City / area"><input className={input} autoComplete="address-level2" maxLength={80} value={f.city} onChange={(e) => set("city", e.target.value)} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.willTravel} onChange={(e) => set("willTravel", e.target.checked)} /> I can travel to schools across Hyderabad</label>
          </>
        )}
        {step === 1 && (
          <>
            <Field label="Highest qualification" hint="For example B.Tech, Diploma, B.Sc, 12th"><input className={input} maxLength={120} value={f.qualification} onChange={(e) => set("qualification", e.target.value)} /></Field>
            <Field label="College / institute (optional)"><input className={input} maxLength={160} value={f.college} onChange={(e) => set("college", e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Graduation year"><input className={input} inputMode="numeric" maxLength={4} value={f.gradYear} onChange={(e) => set("gradYear", e.target.value.replace(/\D/g, ""))} /></Field>
              <Field label="Years of experience"><input className={input} inputMode="numeric" maxLength={2} value={f.experienceYears} onChange={(e) => set("experienceYears", e.target.value.replace(/\D/g, ""))} /></Field>
            </div>
            <Field label="Right now I am">
              <select className={input} value={f.currentStatus} onChange={(e) => set("currentStatus", e.target.value)}>
                <option value="fresher">A fresher</option><option value="student">A student</option><option value="working">Working</option>
              </select>
            </Field>
          </>
        )}
        {step === 2 && (
          <>
            <fieldset><legend className="text-sm font-semibold text-ym-text">What do you know? (any)</legend>
              <div className="mt-2 flex flex-wrap gap-2">{SKILLS.map((s) => (
                <label key={s} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${f.skills.includes(s) ? "border-ym-blue bg-ym-blue text-white" : "border-slate-300"}`}>
                  <input type="checkbox" className="sr-only" checked={f.skills.includes(s)} onChange={() => set("skills", toggle(f.skills, s))} />{s}
                </label>))}</div></fieldset>
            <fieldset><legend className="text-sm font-semibold text-ym-text">Which grades can you teach?</legend>
              <div className="mt-2 flex flex-wrap gap-2">{BANDS.map((s) => (
                <label key={s} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${f.gradeBands.includes(s) ? "border-ym-blue bg-ym-blue text-white" : "border-slate-300"}`}>
                  <input type="checkbox" className="sr-only" checked={f.gradeBands.includes(s)} onChange={() => set("gradeBands", toggle(f.gradeBands, s))} />{s}
                </label>))}</div></fieldset>
            <Field label="Spoken English (1 = basic, 5 = fluent)">
              <select className={input} value={f.englishLevel} onChange={(e) => set("englishLevel", Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.hasTwoWheeler} onChange={(e) => set("hasTwoWheeler", e.target.checked)} /> I have a two-wheeler</label>
          </>
        )}
        {step === 3 && (
          <>
            <Field label="Why do you want to be a trainer?"><textarea className={input} rows={4} maxLength={1000} value={f.why} onChange={(e) => set("why", e.target.value)} /></Field>
            <Field label="Explain a sensor (or how a robot knows where it is) to a 10-year-old" hint="A few sentences is enough."><textarea className={input} rows={4} maxLength={1000} value={f.explain} onChange={(e) => set("explain", e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Expected salary (₹ / month)"><input className={input} inputMode="numeric" maxLength={7} value={f.expectedSalary} onChange={(e) => set("expectedSalary", e.target.value.replace(/\D/g, ""))} /></Field>
              <Field label="Earliest joining date"><input className={input} type="date" value={f.joinDate} onChange={(e) => set("joinDate", e.target.value)} /></Field>
            </div>
            <Field label="How did you hear about us? (optional)"><input className={input} maxLength={80} value={f.heardFrom} onChange={(e) => set("heardFrom", e.target.value)} /></Field>
            <Field label="Intro video link (optional)" hint="A one-minute video of you explaining something. YouTube or Drive link."><input className={input} type="url" maxLength={300} value={f.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} /></Field>
          </>
        )}
        {step === 4 && (
          <>
            <Field label="Resume (PDF or Word, up to 5 MB)">
              <input className={input} type="file" accept=".pdf,.doc,.docx,application/pdf" onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                const bad = picked ? check(4, { ...f, consent: true }, picked) : "";
                if (bad) { e.target.value = ""; setFile(null); setErr(bad); } else { setFile(picked); setErr(""); }
              }} />
              {file && <p className="mt-1 text-xs text-slate-600">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
            </Field>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" className="mt-1" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} />
              <span>I agree that YugMinds may store my details and resume to review my application and contact me about this and future roles. I can ask for them to be deleted by emailing info@yugminds.org.</span>
            </label>
          </>
        )}

        {err && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        <div className="flex items-center justify-between pt-2">
          {step > 0 ? <button type="button" onClick={() => go(step - 1)} className="min-h-11 rounded-md px-4 font-semibold text-slate-700 hover:bg-slate-100">Back</button> : <span />}
          <button type="submit" disabled={sending} className="min-h-11 rounded-md bg-ym-blue px-6 font-semibold text-white hover:bg-ym-blue-lit disabled:opacity-60">
            {step === STEPS.length - 1 ? (sending ? "Sending…" : "Submit application") : "Next"}
          </button>
        </div>
      </form>
    </section>
  );
}
