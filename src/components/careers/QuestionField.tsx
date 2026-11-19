"use client";

import type { Question, Value } from "@/lib/careers-form";

const input =
  "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-base text-ym-text outline-none focus-visible:border-ym-blue focus-visible:ring-2 focus-visible:ring-ym-blue/30";
const chip = (on: boolean) =>
  `cursor-pointer rounded-full border px-3 py-1.5 text-sm ${on ? "border-ym-blue bg-ym-blue text-white" : "border-slate-300"}`;

/** One renderer for every question type: the public apply form and the admin preview share it. */
export default function QuestionField({ q, value, onChange }: { q: Question; value: Value; onChange: (v: Value) => void }) {
  const label = (
    <>
      {q.label}
      {!q.required && q.type !== "yesno" ? " (optional)" : ""}
    </>
  );
  const help = q.help && <span className="mt-1 block text-xs font-normal text-slate-500">{q.help}</span>;
  const list = Array.isArray(value) ? value : [];

  if (q.type === "yesno")
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} /> {q.label}{q.required ? <span className="text-red-600" aria-hidden="true"> *</span> : null}
      </label>
    );
  if (q.type === "multi" || q.type === "choice")
    return (
      <fieldset>
        <legend className="text-sm font-semibold text-ym-text">{label}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(q.options ?? []).map((o) => {
            const on = q.type === "multi" ? list.includes(o) : value === o;
            return (
              <label key={o} className={chip(on)}>
                <input
                  type={q.type === "multi" ? "checkbox" : "radio"}
                  name={q.id}
                  className="sr-only"
                  checked={on}
                  onChange={() => onChange(q.type === "multi" ? (on ? list.filter((x) => x !== o) : [...list, o]) : o)}
                />
                {o}
              </label>
            );
          })}
        </div>
        {help}
      </fieldset>
    );
  return (
    <label className="block text-sm font-semibold text-ym-text">
      {label}
      {q.type === "textarea" ? (
        <textarea className={input} rows={4} maxLength={2000} value={String(value)} onChange={(e) => onChange(e.target.value)} />
      ) : q.type === "scale" ? (
        <select className={input} value={String(value)} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Select</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      ) : (
        <input
          className={input}
          type={q.type === "date" ? "date" : q.type === "url" ? "url" : "text"}
          inputMode={q.type === "number" ? "numeric" : undefined}
          maxLength={q.type === "url" ? 300 : 160}
          value={String(value)}
          onChange={(e) => onChange(q.type === "number" ? e.target.value.replace(/\D/g, "") : e.target.value)}
        />
      )}
      {help}
    </label>
  );
}
