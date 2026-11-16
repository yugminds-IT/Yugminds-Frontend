"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { commonApi } from "@/lib/api/common.api";

type Result = { ref: string; role: string; applied_at: string; stage: string; on_hold?: boolean; updated_at: string; history: { stage: string; at: string }[] };

const STEPS = [
  { key: "new", title: "Application received", next: "Our team is reading it. This usually takes a few days." },
  { key: "screening", title: "Screening call", next: "Keep your phone handy. We will call you, or reply to our email with a time that suits you." },
  { key: "interview", title: "Interview", next: "Talk with us about teaching, kids and technology. Check your email for the time and place." },
  { key: "demo_class", title: "Demo class", next: "Teach us a ten-minute topic. We share feedback the same day." },
  { key: "offer", title: "Offer", next: "Check your email for the offer and reply to accept." },
  { key: "hired", title: "Welcome aboard", next: "You are in. Our team will share your joining and training details." },
];
const ENDED: Record<string, { title: string; note: string }> = {
  rejected: { title: "Not moving forward", note: "We keep your details and will reach out if a suitable role opens. You are welcome to apply again." },
  withdrawn: { title: "Application withdrawn", note: "This application is closed. You can apply again any time." },
};

const input =
  "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-base text-ym-text outline-none focus-visible:border-ym-blue focus-visible:ring-2 focus-visible:ring-ym-blue/30";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function Tracker({ r, email, onClosed }: { r: Result; email: string; onClosed: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function withdraw() {
    setBusy(true);
    setErr("");
    try {
      await commonApi.careers.withdraw(r.ref, email);
      onClosed();
    } catch {
      setErr("We could not withdraw it right now. Try again, or reply to any email from us.");
      setBusy(false);
    }
  }

  const ended = ENDED[r.stage];
  // Furthest step reached, taken from history so a closed application still shows its path.
  const reached = Math.max(0, ...r.history.map((h) => STEPS.findIndex((s) => s.key === h.stage)), STEPS.findIndex((s) => s.key === r.stage));
  const at = (k: string) => r.history.find((h) => h.stage === k)?.at;
  const shown = ended ? STEPS.slice(0, reached + 1) : STEPS;
  return (
    <div className="mt-8">
      <p className="text-sm text-slate-600">{r.role}</p>
      <p className="mt-1 font-mono text-sm font-bold text-ym-blue">{r.ref}</p>
      {r.on_hold && (
        <p className="mt-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-ym-text">
          Your application is on hold for now. This is not a no. We will contact you when it moves forward.
        </p>
      )}
      <ol className="mt-6" aria-label="Application progress">
        {shown.map((s, i) => {
          const done = i < reached || (i === reached && !!ended);
          const now = i === reached && !ended;
          const last = i === shown.length - 1 && !ended;
          return (
            <li key={s.key} aria-current={now ? "step" : undefined} className="relative flex gap-4 pb-7 last:pb-0">
              {!last && <span className={`absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5 ${i < reached ? "bg-ym-blue" : "bg-slate-200"}`} aria-hidden />}
              <span className={`relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${done || (now && s.key === "hired") ? "border-ym-blue bg-ym-blue text-white" : now ? "border-ym-blue bg-white ring-4 ring-ym-blue/20" : "border-slate-300 bg-white"}`}>
                {(done || (now && s.key === "hired")) && <Check className="size-4" aria-hidden />}
                {now && s.key !== "hired" && <span className="size-2.5 rounded-full bg-ym-blue" aria-hidden />}
              </span>
              <div>
                <p className={`font-semibold ${now || done ? "text-ym-text" : "text-slate-400"}`}>
                  {s.title}
                  {at(s.key) && <span className="ml-2 text-sm font-normal text-slate-500">{day(at(s.key)!)}</span>}
                </p>
                {now && <p className="mt-1 max-w-prose text-slate-700">{s.next}</p>}
              </div>
            </li>
          );
        })}
        {ended && (
          <li className="relative flex gap-4 pt-7" aria-current="step">
            <span className="mt-0.5 size-7 shrink-0 rounded-full border-2 border-slate-400 bg-slate-100" aria-hidden />
            <div>
              <p className="font-semibold text-ym-text">{ended.title}<span className="ml-2 text-sm font-normal text-slate-500">{day(r.updated_at)}</span></p>
              <p className="mt-1 max-w-prose text-slate-700">{ended.note}</p>
            </div>
          </li>
        )}
      </ol>
      {!ended && r.stage !== "hired" && (
        <div className="mt-8 border-t border-slate-200 pt-6">
          {!confirm ? (
            <button type="button" onClick={() => setConfirm(true)} className="text-sm font-semibold text-slate-600 underline hover:text-ym-text">
              Withdraw my application
            </button>
          ) : (
            <div role="alertdialog" aria-label="Confirm withdrawal" className="rounded-lg border border-slate-300 p-4">
              <p className="font-semibold text-ym-text">Withdraw this application?</p>
              <p className="mt-1 text-sm text-slate-600">We will stop the process and tell our team. You can apply again later, but not for this role with the same email.</p>
              {err && <p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={busy} onClick={() => void withdraw()} className="min-h-11 rounded-md bg-slate-900 px-5 font-semibold text-white disabled:opacity-60">
                  {busy ? "Withdrawing…" : "Yes, withdraw"}
                </button>
                <button type="button" disabled={busy} onClick={() => setConfirm(false)} className="min-h-11 rounded-md px-4 font-semibold text-slate-700 hover:bg-slate-100">Keep it</button>
              </div>
            </div>
          )}
        </div>
      )}
      <p className="mt-8 text-sm text-slate-600">
        Applied on {day(r.applied_at)}. Questions? Reply to any email from us or call +91 85003 45655.
      </p>
    </div>
  );
}

export default function CareersStatus({ initialRef = "" }: { initialRef?: string }) {
  const [ref, setRef] = useState(initialRef);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<Result | null>(null);

  async function look(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setErr("");
    try {
      setRes((await commonApi.careers.status(ref.trim(), email.trim())).data);
    } catch (x) {
      const r = (x as { response?: { status?: number; data?: { message?: string } } }).response;
      setRes(null);
      setErr(
        r?.status === 429
          ? "Too many tries. Wait a minute and try again."
          : r?.status === 404
            ? (r.data?.message ?? "We could not find that application.")
            : "We could not check right now. Try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-5 pb-20 pt-28 md:pt-32">
      <h1 className="font-acdisplay text-3xl font-bold text-ym-text md:text-4xl">Check your application</h1>
      <p className="mt-2 text-slate-600">Enter the reference from your confirmation email and the email address you applied with.</p>
      <form onSubmit={look} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold text-ym-text">
          Reference
          <input className={`${input} font-mono uppercase`} placeholder="YM-T-XXXXX" required maxLength={20} autoCapitalize="characters" autoComplete="off" value={ref} onChange={(e) => setRef(e.target.value)} />
        </label>
        <label className="block text-sm font-semibold text-ym-text">
          Email
          <input className={input} type="email" required maxLength={200} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {err && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <button type="submit" disabled={busy} className="min-h-11 rounded-md bg-ym-blue px-6 font-semibold text-white hover:bg-ym-blue-lit disabled:opacity-60">
          {busy ? "Checking…" : "Check status"}
        </button>
      </form>
      <div aria-live="polite">{res && <Tracker key={res.ref + res.stage} r={res} email={email.trim()} onClosed={() => void look()} />}</div>
      <p className="mt-10 text-sm text-slate-600">
        Lost your reference? Search your inbox for “We got your application”, or <Link href="/#contact" className="font-semibold text-ym-blue underline">contact us</Link>.
      </p>
    </section>
  );
}
