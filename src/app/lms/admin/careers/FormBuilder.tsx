"use client";

import { useEffect, useState } from "react";
import { AlignLeft, ArrowDown, ArrowUp, Calendar, CheckSquare, ChevronDown, Hash, Link2, ListChecks, Lock, Plus, Search, Star, ToggleLeft, Trash2, Type, X, type LucideIcon } from "lucide-react";
import { adminApi } from "@/lib/api/admin.api";
import FormPreview from "./FormPreview";
import { consentText, coreField, CORE_DEFAULT, CORE_KEYS, LOCKED, TYPE_LABEL, type FormConfig, type Mode, type Question, type QType } from "@/lib/careers-form";

type Meta = { library: Record<string, { label: string; type: QType; options?: string[] }>; presets: Record<"teaching" | "general" | "blank", FormConfig> };
const PRESETS = [
  ["teaching", "Teaching", "Skills, grades, English, two sample questions"],
  ["general", "General", "Education, experience, salary, one question"],
  ["blank", "Blank", "Only contact details and resume"],
] as const;
const CUSTOM: [QType, string, LucideIcon][] = [
  ["text", "A short answer, one line", Type],
  ["textarea", "A paragraph answer", AlignLeft],
  ["choice", "Pick one from a list", CheckSquare],
  ["multi", "Pick several from a list", ListChecks],
  ["yesno", "A tick box", ToggleLeft],
  ["scale", "Rate from 1 to 5", Star],
  ["number", "Digits only", Hash],
  ["date", "Pick a date", Calendar],
  ["url", "A web link", Link2],
];
const MODES: [Mode, string][] = [["required", "Required"], ["optional", "Optional"], ["off", "Not asked"]];
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

export const countQuestions = (f: FormConfig) => f.steps.reduce((n, s) => n + s.questions.length, 0);
/** First problem in the form, or "" when it can be saved. */
export function checkForm(f: FormConfig): string {
  for (const s of f.steps) {
    if (!s.title.trim()) return "Give every step a title.";
    if (!s.questions.length) return `"${s.title}" has no questions. Add one or delete the step.`;
    for (const q of s.questions) {
      if (!q.label.trim()) return `A question in "${s.title}" has no text.`;
      if (q.options && new Set(q.options.map((o) => o.trim()).filter(Boolean)).size < 2) return `"${q.label}" needs at least 2 different options.`;
    }
  }
  return "";
}

/** Admin builder for a role's application form, with a live applicant preview. `value` null = the Teaching form. */
export default function FormBuilder({ value, onChange, title, slug }: { value: FormConfig | null; onChange: (f: FormConfig) => void; title: string; slug: string }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [failed, setFailed] = useState(false);
  const [openQ, setOpenQ] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState<keyof Meta["presets"] | null>(null);
  const [delStep, setDelStep] = useState<string | null>(null);
  const [core, setCore] = useState<"about" | "end" | null>(null);
  const [view, setView] = useState<"build" | "preview">("build");
  useEffect(() => {
    adminApi.careers.openings.formMeta().then((r: { data: Meta }) => setMeta(r.data)).catch(() => setFailed(true));
  }, []);

  if (failed) return <p className="text-sm text-red-600">Could not load the form options. Close this window and try again.</p>;
  if (!meta) return <p className="text-sm text-slate-600">Loading form…</p>;
  const form = value ?? meta.presets.teaching;
  const edit = (fn: (d: FormConfig) => void) => { const d = structuredClone(form); fn(d); onChange(d); };
  const move = <T,>(a: T[], i: number, by: number) => { const j = i + by; if (j >= 0 && j < a.length) [a[i], a[j]] = [a[j], a[i]]; };
  const used = new Set(form.steps.flatMap((s) => s.questions.map((q) => q.key).filter(Boolean)));
  const total = countQuestions(form);
  const lib = Object.entries(meta.library).filter(([k, l]) => !used.has(k) && l.label.toLowerCase().includes(find.toLowerCase()));

  function add(si: number, pick: string) {
    const q: Question = pick.startsWith("lib:")
      ? { id: pick.slice(4), key: pick.slice(4), type: meta!.library[pick.slice(4)].type, label: meta!.library[pick.slice(4)].label, options: meta!.library[pick.slice(4)].options, required: false }
      : { id: uid("q"), type: pick as QType, label: "", required: false, options: pick === "choice" || pick === "multi" ? ["", ""] : undefined };
    edit((d) => { d.steps[si].questions.push(q); });
    setOpenQ(q.id); setAdding(null); setFind("");
  }
  const applyPreset = (k: keyof Meta["presets"]) => { onChange({ ...structuredClone(meta.presets[k]), resume: form.resume, core: form.core }); setReplace(null); setOpenQ(null); };

  return (
    <div className="fb-root">
      <div className="fb-tabs" role="tablist" aria-label="Builder view">
        <button role="tab" type="button" aria-selected={view === "build"} onClick={() => setView("build")}>Build</button>
        <button role="tab" type="button" aria-selected={view === "preview"} onClick={() => setView("preview")}>Preview</button>
      </div>

      <div className="fb-grid">
        <div className="fb-col" data-show={view === "build"}>
          <div className="fb-presets">
            <p className="fb-h">Start from a ready-made form</p>
            <div className="fb-preset-row">
              {PRESETS.map(([k, name, hint]) => (
                <button key={k} type="button" onClick={() => (total ? setReplace(k) : applyPreset(k))} className="fb-preset">
                  <b>{name}</b><span>{hint}</span>
                </button>
              ))}
            </div>
            {replace && (
              <div role="alert" className="fb-warn">
                This replaces your current questions with the {replace} form.
                <button type="button" onClick={() => applyPreset(replace)}>Replace</button>
                <button type="button" onClick={() => setReplace(null)}>Keep mine</button>
              </div>
            )}
          </div>

          <section className="fb-step">
            <header>
              <span className="fb-num" aria-hidden="true">1</span>
              <b className="fb-fixed-t">About you</b>
              <span className="fb-count">{CORE_KEYS.filter((k) => coreField(form, k).mode !== "off").length} fields</span>
              <button type="button" className="fb-link" aria-expanded={core === "about"} onClick={() => setCore(core === "about" ? null : "about")}>{core === "about" ? "Done" : "Edit"}</button>
            </header>
            {core === "about" && (
              <ul>
                {CORE_KEYS.map((k) => {
                  const c = coreField(form, k);
                  return (
                    <li key={k} className="fb-core">
                      <input aria-label={`${CORE_DEFAULT[k].label} label`} maxLength={40} value={form.core?.[k]?.label ?? CORE_DEFAULT[k].label} onChange={(e) => edit((d) => { d.core = { ...d.core, [k]: { ...d.core?.[k], label: e.target.value } }; })} />
                      {LOCKED.includes(k)
                        ? <span className="fb-lock"><Lock className="h-3.5 w-3.5" aria-hidden="true" />Always required</span>
                        : <div role="group" aria-label={`${c.label} setting`} className="fb-seg">
                          {MODES.map(([v, l]) => <button key={v} type="button" aria-pressed={c.mode === v} onClick={() => edit((d) => { d.core = { ...d.core, [k]: { ...d.core?.[k], mode: v } }; })}>{l}</button>)}
                        </div>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {form.steps.length === 0 && <p className="fb-empty">No extra questions yet. Add a step to ask more, or pick a ready-made form above.</p>}

          {form.steps.map((s, si) => (
            <section key={s.id} className="fb-step">
              <header>
                <span className="fb-num" aria-hidden="true">{si + 2}</span>
                <input aria-label="Step title" maxLength={40} value={s.title} placeholder="Step title" onChange={(e) => edit((d) => { d.steps[si].title = e.target.value; })} />
                <span className="fb-count">{s.questions.length} {s.questions.length === 1 ? "question" : "questions"}</span>
                <button type="button" aria-label="Move step up" disabled={si === 0} onClick={() => edit((d) => move(d.steps, si, -1))}><ArrowUp className="h-4 w-4" /></button>
                <button type="button" aria-label="Move step down" disabled={si === form.steps.length - 1} onClick={() => edit((d) => move(d.steps, si, 1))}><ArrowDown className="h-4 w-4" /></button>
                {delStep === s.id
                  ? <button type="button" className="fb-danger" onClick={() => { edit((d) => { d.steps.splice(si, 1); }); setDelStep(null); }}>Delete step?</button>
                  : <button type="button" aria-label="Delete step" onClick={() => (s.questions.length ? setDelStep(s.id) : edit((d) => { d.steps.splice(si, 1); }))}><Trash2 className="h-4 w-4" /></button>}
                {delStep === s.id && <button type="button" aria-label="Cancel delete" onClick={() => setDelStep(null)}><X className="h-4 w-4" /></button>}
              </header>

              <ul>
                {s.questions.map((q, qi) => (
                  <li key={q.id} data-open={openQ === q.id}>
                    <div className="fb-q">
                      <button type="button" className="fb-q-main" aria-expanded={openQ === q.id} onClick={() => setOpenQ(openQ === q.id ? null : q.id)}>
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        <span className={q.label ? "" : "fb-ph"}>{q.label || "Untitled question"}</span>
                        <em>{TYPE_LABEL[q.type]}</em>
                      </button>
                                              <button type="button" role="switch" aria-checked={q.required} className="fb-sw" onClick={() => edit((d) => { d.steps[si].questions[qi].required = !q.required; })}>
                          <i aria-hidden="true" />{q.required ? (q.type === "yesno" ? "Must tick" : "Required") : "Optional"}
                        </button>
                      <button type="button" aria-label="Move question up" disabled={qi === 0} onClick={() => edit((d) => move(d.steps[si].questions, qi, -1))}><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" aria-label="Move question down" disabled={qi === s.questions.length - 1} onClick={() => edit((d) => move(d.steps[si].questions, qi, 1))}><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" aria-label="Delete question" onClick={() => edit((d) => { d.steps[si].questions.splice(qi, 1); })}><Trash2 className="h-4 w-4" /></button>
                    </div>
                    {openQ === q.id && (
                      <div className="fb-edit">
                        <label>Question
                          <input autoFocus={!q.label} maxLength={160} value={q.label} onChange={(e) => edit((d) => { d.steps[si].questions[qi].label = e.target.value; })} />
                        </label>
                        <label>Help text <small>(optional, shown under the question)</small>
                          <input maxLength={200} value={q.help ?? ""} onChange={(e) => edit((d) => { d.steps[si].questions[qi].help = e.target.value; })} />
                        </label>
                        {q.options && (
                          <label>Options <small>(one per line)</small>
                            <textarea rows={Math.min(8, Math.max(3, q.options.length + 1))} value={q.options.join("\n")} onChange={(e) => edit((d) => { d.steps[si].questions[qi].options = e.target.value.split("\n"); })} />
                          </label>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {adding === si ? (
                <div className="fb-add">
                  <div className="fb-add-top">
                    <label className="fb-search"><Search className="h-4 w-4" aria-hidden="true" /><input autoFocus placeholder="Search common questions" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Search common questions" /></label>
                    <button type="button" aria-label="Close" onClick={() => { setAdding(null); setFind(""); }}><X className="h-4 w-4" /></button>
                  </div>
                  {lib.length > 0 && <p className="fb-h">Common questions</p>}
                  <div className="fb-opts">
                    {lib.map(([k, l]) => <button key={k} type="button" onClick={() => add(si, `lib:${k}`)}><b>{l.label}</b><span>{TYPE_LABEL[l.type]}</span></button>)}
                  </div>
                  {!find && (<>
                    <p className="fb-h">Write your own</p>
                    <div className="fb-opts">
                      {CUSTOM.map(([t, hint, Icon]) => <button key={t} type="button" onClick={() => add(si, t)}><Icon className="h-4 w-4" aria-hidden="true" /><b>{TYPE_LABEL[t]}</b><span>{hint}</span></button>)}
                    </div>
                  </>)}
                </div>
              ) : (
                <button type="button" className="fb-addbtn" disabled={total >= 40} onClick={() => { setAdding(si); setFind(""); }}><Plus className="h-4 w-4" aria-hidden="true" />Add a question</button>
              )}
            </section>
          ))}

          <button type="button" className="fb-addstep" disabled={form.steps.length >= 6} onClick={() => edit((d) => { d.steps.push({ id: uid("s"), title: "More questions", questions: [] }); })}>
            <Plus className="h-4 w-4" aria-hidden="true" />Add a step
          </button>

          <section className="fb-step">
            <header>
              <span className="fb-num" aria-hidden="true">{form.steps.length + 2}</span>
              <b className="fb-fixed-t">{form.resume === "off" ? "Consent" : "Resume and consent"}</b>
              <span className="fb-count">Resume {form.resume === "off" ? "not asked" : form.resume}</span>
              <button type="button" className="fb-link" aria-expanded={core === "end"} onClick={() => setCore(core === "end" ? null : "end")}>{core === "end" ? "Done" : "Edit"}</button>
            </header>
            {core === "end" && (
              <div className="fb-edit" style={{ paddingLeft: ".9rem" }}>
                <div className="fb-core" style={{ padding: 0 }}>
                  <span className="fb-h" style={{ margin: 0 }}>Resume upload</span>
                  <div role="group" aria-label="Resume" className="fb-seg">
                    {MODES.map(([v, l]) => <button key={v} type="button" aria-pressed={form.resume === v} onClick={() => edit((d) => { d.resume = v; })}>{l}</button>)}
                  </div>
                </div>
                <label>Consent text <small>(applicants must tick it to apply)</small>
                  <textarea rows={4} maxLength={500} value={form.core?.consent ?? consentText(form)} onChange={(e) => edit((d) => { d.core = { ...d.core, consent: e.target.value }; })} />
                </label>
                {form.core?.consent && <button type="button" className="fb-link" onClick={() => edit((d) => { if (d.core) delete d.core.consent; })}>Reset to default text</button>}
              </div>
            )}
          </section>
        </div>

        <div className="fb-col fb-side" data-show={view === "preview"}>
          <FormPreview form={form} title={title} slug={slug} />
        </div>
      </div>
    </div>
  );
}
