"use client";

import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import QuestionField from "@/components/careers/QuestionField";
import { consentText, coreField, CORE_DEFAULT, CORE_KEYS, initial, type Answers, type FormConfig } from "@/lib/careers-form";

const fld = "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900";
const Fake = ({ label, hint, ph }: { label: string; hint?: string; ph?: string }) => (
  <label className="block text-sm font-semibold text-slate-900">
    {label}
    <input className={fld} placeholder={ph} readOnly tabIndex={-1} />
    {hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}
  </label>
);

/** Applicant's view of the form, live as the admin edits. Answers here are never saved. */
export default function FormPreview({ form, title, slug }: { form: FormConfig; title: string; slug: string }) {
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState(true);
  const [answers, setAnswers] = useState<Answers>({});
  const names = ["About you", ...form.steps.map((s) => s.title || "Untitled step"), form.resume === "off" ? "Consent" : "Resume"];
  const last = names.length - 1;
  const at = Math.min(step, last);
  const pct = ((at + 1) / names.length) * 100;

  return (
    <div className="fb-preview">
      <div className="fb-preview-bar">
        <span className="fb-preview-title">Applicant preview</span>
        <div role="group" aria-label="Preview size" className="fb-seg">
          <button type="button" aria-pressed={phone} onClick={() => setPhone(true)}><Smartphone className="h-3.5 w-3.5" aria-hidden="true" />Phone</button>
          <button type="button" aria-pressed={!phone} onClick={() => setPhone(false)}><Monitor className="h-3.5 w-3.5" aria-hidden="true" />Desktop</button>
        </div>
      </div>
      <div className="fb-stage">
        <div className="fb-frame" data-phone={phone}>
          <div className="fb-url">yugminds.org/careers/{slug || "role"}/apply</div>
          <div className="fb-page">
            <h4 className="text-xl font-bold text-slate-900">Apply: {title || "Untitled role"}</h4>
            <p className="mt-1 text-xs text-slate-600">Step {at + 1} of {names.length}: {names[at]}</p>
            <div className="mt-2 h-1.5 rounded bg-slate-200"><div className="h-full rounded bg-blue-600 transition-[width]" style={{ width: `${pct}%` }} /></div>
            <div className="fb-dots" role="tablist" aria-label="Preview steps">
              {names.map((n, i) => (
                <button key={i} type="button" role="tab" aria-selected={i === at} onClick={() => setStep(i)} title={n}>{i + 1}</button>
              ))}
            </div>
            <div className="mt-4 space-y-4">
              {at === 0 && (<>
                {CORE_KEYS.map((k) => { const c = coreField(form, k); return c.mode === "off" ? null : <Fake key={k} label={`${c.label}${c.mode === "optional" ? " (optional)" : ""}`} hint={k === "phone" ? CORE_DEFAULT.phone.hint : undefined} />; })}
              </>)}
              {at > 0 && at < last && (form.steps[at - 1].questions.length === 0
                ? <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">No questions in this step yet.</p>
                : form.steps[at - 1].questions.map((q) => (
                  <QuestionField key={q.id} q={q} value={answers[q.id] ?? initial(q)} onChange={(v) => setAnswers((p) => ({ ...p, [q.id]: v }))} />
                )))}
              {at === last && (<>
                {form.resume !== "off" && (
                  <label className="block text-sm font-semibold text-slate-900">
                    Resume (PDF or Word, up to 5 MB){form.resume === "optional" ? " (optional)" : ""}
                    <input className={fld} type="file" disabled />
                  </label>
                )}
                <label className="flex items-start gap-2 text-xs text-slate-700">
                  <input type="checkbox" className="mt-0.5" disabled />
                  <span>{consentText(form)}</span>
                </label>
              </>)}
            </div>
            <div className="mt-5 flex items-center justify-between">
              {at > 0 ? <button type="button" onClick={() => setStep(at - 1)} className="rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Back</button> : <span />}
              {at < last
                ? <button type="button" onClick={() => setStep(at + 1)} className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white">Next</button>
                : <span className="rounded-md bg-blue-600/50 px-5 py-2 text-sm font-semibold text-white">Submit application</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
