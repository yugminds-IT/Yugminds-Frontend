"use client";

import { useState } from "react";
import { Check, MapPin, Pencil, Plus, Trash2, Users, Wallet } from "lucide-react";
import Modal from "@/components/portal/Modal";
import { adminApi } from "@/lib/api/admin.api";
import { toast } from "@/components/ui/toast";

export type Opening = {
  id: string;
  slug: string;
  title: string;
  team: string;
  location: string;
  jobType: string;
  payMin: number | null;
  payMax: number | null;
  description: string;
  details?: { teach?: string[]; seeking?: string[] } | null;
  status: "draft" | "open" | "paused" | "closed";
  positions: number;
  rejectCooldownDays: number;
  withdrawCooldownDays: number;
  applications: number;
  hired: number;
};

const EMPTY = {
  title: "", team: "Teaching", positions: "1", location: "", jobType: "Full-time, Permanent",
  payMin: "", payMax: "", description: "", teach: "", seeking: "", status: "open",
  rejectCooldownDays: "90", withdrawCooldownDays: "30",
};
type Form = typeof EMPTY;
const STATUS_LABEL = { draft: "Draft", open: "Open", paused: "Paused", closed: "Closed" } as const;
const STATUS_CLS = { draft: "bg-amber-100 text-amber-800", open: "bg-emerald-100 text-emerald-800", paused: "bg-sky-100 text-sky-800", closed: "bg-slate-200 text-slate-700" } as const;
const STEPS = ["Role", "Pay", "Details", "Review"] as const;
const JOB_TYPES = ["Full-time, Permanent", "Part-time", "Contract", "Internship"];
const field = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal";
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const payText = (min: number | null, max: number | null) =>
  min && max ? `${inr(min)} – ${inr(max)} a month` : max ? `Up to ${inr(max)} a month` : min ? `From ${inr(min)} a month` : "Pay not shown";
const lines = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);

/** Returns the first problem on a step, or "" when it is fine to continue. */
function check(step: number, f: Form) {
  if (step === 0) {
    if (f.title.trim().length < 3) return "Give the role a title (at least 3 letters).";
    if (!f.location.trim()) return "Add where the person will be based.";
    if (!(Number(f.positions) >= 1)) return "Enter how many positions are open (at least 1).";
  }
  if (step === 1 && f.payMin && f.payMax && Number(f.payMin) > Number(f.payMax)) return "The lowest pay cannot be more than the highest.";
  if (step === 2 && !f.description.trim()) return "Add a short description of the role.";
  if (step === 2 && (f.rejectCooldownDays === "" || f.withdrawCooldownDays === "" || Number(f.rejectCooldownDays) > 730 || Number(f.withdrawCooldownDays) > 730)) return "Enter the waiting days as a number from 0 to 730.";
  return "";
}

function Preview({ f }: { f: Form }) {
  const teach = lines(f.teach), seeking = lines(f.seeking);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold text-slate-500">How it looks on yugminds.org</p>
      <h4 className="mt-2 text-2xl font-bold">{f.title || "Untitled role"}</h4>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" aria-hidden="true" />{f.team || "Team"}</span>
        <span>{Number(f.positions) || 1} {Number(f.positions) === 1 ? "position" : "positions"} open</span>
        <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{f.location || "Location"}</span>
        <span className="inline-flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" aria-hidden="true" />{f.payMin || f.payMax ? payText(Number(f.payMin) || null, Number(f.payMax) || null) : f.jobType}</span>
      </p>
      <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{f.description || "No description yet."}</p>
      {[["What you will teach", teach], ["Who we are looking for", seeking]].map(([t, items]) =>
        (items as string[]).length ? (
          <div key={t as string} className="mt-3">
            <p className="text-sm font-semibold">{t as string}</p>
            <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">{(items as string[]).map((i) => <li key={i}>{i}</li>)}</ul>
          </div>
        ) : null,
      )}
    </div>
  );
}

export default function OpeningsPanel({
  openings, loading, failed, onChanged,
}: { openings: Opening[]; loading: boolean; failed: boolean; onChanged: () => void }) {
  const [form, setForm] = useState<Form | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof Form, v: string) => { setErr(""); setForm((f) => (f ? { ...f, [k]: v } : f)); };

  function start(o?: Opening) {
    setErr(""); setStep(0);
    setEditId(o?.id ?? null);
    setForm(o ? {
      title: o.title, team: o.team, positions: String(o.positions ?? 1), location: o.location, jobType: o.jobType,
      payMin: o.payMin?.toString() ?? "", payMax: o.payMax?.toString() ?? "", description: o.description,
      teach: (o.details?.teach ?? []).join("\n"), seeking: (o.details?.seeking ?? []).join("\n"), status: o.status,
      rejectCooldownDays: String(o.rejectCooldownDays ?? 90), withdrawCooldownDays: String(o.withdrawCooldownDays ?? 30),
    } : EMPTY);
  }

  function next() {
    if (!form) return;
    const p = check(step, form);
    if (p) setErr(p); else { setErr(""); setStep((s) => s + 1); }
  }

  async function save(status: string) {
    if (!form) return;
    for (let i = 0; i < 3; i++) { const p = check(i, form); if (p) { setStep(i); setErr(p); return; } }
    setSaving(true); setErr("");
    try {
      const data = { ...form, status };
      if (editId) await adminApi.careers.openings.update(editId, data);
      else await adminApi.careers.openings.create(data);
      toast.success(status === "open" ? "Opening is live on the site" : "Opening saved");
      setForm(null);
      onChanged();
    } catch (e) {
      setErr((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? "That did not save. Try again.");
    } finally { setSaving(false); }
  }

  async function setStatus(o: Opening, status: string) {
    try {
      await adminApi.careers.openings.update(o.id, { status });
      toast.success(status === "open" ? (o.status === "paused" ? "Applications resumed" : "Opening is live") : status === "paused" ? "Applications paused" : status === "closed" ? "Opening closed" : "Moved to draft");
      onChanged();
    } catch { toast.error("Could not change the status."); }
  }

  async function close(o: Opening) {
    if (!window.confirm(`Close "${o.title}"? It disappears from the site. Existing applications are kept.`)) return;
    await setStatus(o, "closed");
  }

  async function remove(o: Opening) {
    if (!window.confirm(`Delete "${o.title}"? This cannot be undone.`)) return;
    try {
      await adminApi.careers.openings.delete(o.id);
      toast.success("Opening deleted");
      onChanged();
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Could not delete.");
    }
  }

  const live = openings.filter((o) => o.status === "open" || o.status === "paused");
  const other = openings.filter((o) => o.status !== "open" && o.status !== "paused");
  const Card = ({ o }: { o: Opening }) => (
    <li className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-lg font-bold">{o.title}</h4>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLS[o.status]}`}>{STATUS_LABEL[o.status]}</span>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" aria-hidden="true" />{o.team}</span>
        <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{o.location}</span>
      </p>
      <p className="mt-1 text-sm font-semibold">{payText(o.payMin, o.payMax)} <span className="font-normal text-slate-500">· {o.jobType}</span></p>
      <p className="mt-3 line-clamp-2 text-sm text-slate-600">{o.description}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <span className="mr-auto text-sm text-slate-600">
          <b>{o.positions}</b> {o.positions === 1 ? "position" : "positions"} · <b>{o.applications}</b> {o.applications === 1 ? "applicant" : "applicants"} · hired <b>{o.hired}</b> of {o.positions}
          {o.hired >= o.positions && o.status !== "closed" && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">All filled. Consider closing.</span>}
        </span>
        {o.status === "open" && <button onClick={() => void setStatus(o, "paused")} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold">Pause</button>}
        {o.status === "paused" && <button onClick={() => void setStatus(o, "open")} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold">Resume</button>}
        {(o.status === "open" || o.status === "paused") ? (
          <button onClick={() => void close(o)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold">Close</button>
        ) : (
          <button onClick={() => void setStatus(o, "open")} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold">{o.status === "draft" ? "Publish" : "Reopen"}</button>
        )}
        <button onClick={() => start(o)} aria-label={`Edit ${o.title}`} className="rounded-md border border-slate-300 p-2"><Pencil className="h-4 w-4" aria-hidden="true" /></button>
        <button onClick={() => void remove(o)} aria-label={`Delete ${o.title}`} className="rounded-md border border-slate-300 p-2"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
      </div>
    </li>
  );

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm opacity-70">Only Open roles show on yugminds.org and accept applications.</p>
        <button onClick={() => start()} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 font-semibold text-white">
          <Plus className="h-4 w-4" aria-hidden="true" /> New opening
        </button>
      </div>

      {failed ? (
        <p role="alert" className="mt-6">Could not load openings. <button className="underline" onClick={onChanged}>Try again</button></p>
      ) : loading && openings.length === 0 ? (
        <div className="mt-6 h-40 animate-pulse rounded-xl bg-slate-200/60" aria-hidden="true" />
      ) : openings.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-lg font-bold">No openings yet</p>
          <p className="mt-1 text-slate-600">Create your first role. It goes live on yugminds.org when you publish it.</p>
          <button onClick={() => start()} className="mt-4 rounded-md bg-slate-900 px-4 py-2 font-semibold text-white">Create opening</button>
        </div>
      ) : (
        <>
          <h3 className="mt-6 text-sm font-semibold text-slate-600">Live now ({live.length})</h3>
          {live.length ? <ul className="mt-2 grid gap-4 lg:grid-cols-2">{live.map((o) => <Card key={o.id} o={o} />)}</ul> : <p className="mt-2 text-sm text-slate-500">Nothing is live. Publish a draft or create a new role.</p>}
          {other.length > 0 && (
            <>
              <h3 className="mt-8 text-sm font-semibold text-slate-600">Drafts and closed ({other.length})</h3>
              <ul className="mt-2 grid gap-4 lg:grid-cols-2">{other.map((o) => <Card key={o.id} o={o} />)}</ul>
            </>
          )}
        </>
      )}

      <Modal
        open={!!form}
        onClose={() => { if (!saving) setForm(null); }}
        title={editId ? "Edit opening" : "New opening"}
        subtitle={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
        wide
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-3">
            {err && <p role="alert" className="mr-auto text-sm text-red-600">{err}</p>}
            {step > 0 ? <button onClick={() => { setErr(""); setStep(step - 1); }} disabled={saving} className="rounded-md border border-slate-300 px-4 py-2 font-semibold">Back</button>
              : <button onClick={() => setForm(null)} className="rounded-md border border-slate-300 px-4 py-2 font-semibold">Cancel</button>}
            {step < STEPS.length - 1 ? (
              <button onClick={next} className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white">Next</button>
            ) : (
              <>
                <button onClick={() => void save(editId && form?.status !== "draft" ? form!.status : "draft")} disabled={saving} className="rounded-md border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50">
                  {editId ? "Save changes" : "Save as draft"}
                </button>
                {(!editId || form?.status !== "open") && (
                  <button onClick={() => void save("open")} disabled={saving} className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">
                    {saving ? "Saving…" : "Publish now"}
                  </button>
                )}
              </>
            )}
          </div>
        }
      >
        {form && (
          <>
            <ol className="mb-6 flex items-center gap-2" aria-label="Progress">
              {STEPS.map((s, i) => (
                <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === step ? "step" : undefined}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${i < step ? "bg-slate-900 text-white" : i === step ? "border-2 border-slate-900" : "border border-slate-300 text-slate-500"}`}>
                    {i < step ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
                  </span>
                  <span className={`hidden text-sm sm:inline ${i === step ? "font-semibold" : "text-slate-500"}`}>{s}</span>
                  {i < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-300" aria-hidden="true" />}
                </li>
              ))}
            </ol>

            {step === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2 text-sm font-semibold">Job title
                  <input className={field} value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={100} placeholder="Robotics Trainer" />
                </label>
                <label className="text-sm font-semibold">Team
                  <input className={field} value={form.team} onChange={(e) => set("team", e.target.value)} maxLength={50} />
                </label>
                <label className="text-sm font-semibold">Number of positions
                  <input className={field} inputMode="numeric" value={form.positions} onChange={(e) => set("positions", e.target.value.replace(/\D/g, "").slice(0, 3))} />
                </label>
                <label className="text-sm font-semibold">Job type
                  <select className={field} value={form.jobType} onChange={(e) => set("jobType", e.target.value)}>
                    {(JOB_TYPES.includes(form.jobType) ? JOB_TYPES : [form.jobType, ...JOB_TYPES]).map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
                <label className="sm:col-span-2 text-sm font-semibold">Based at
                  <input className={field} value={form.location} onChange={(e) => set("location", e.target.value)} maxLength={120} placeholder="Begumpet, Hyderabad" />
                </label>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <p className="sm:col-span-2 text-sm text-slate-600">Monthly pay in rupees. Leave both empty to hide pay on the site.</p>
                <label className="text-sm font-semibold">Lowest (₹)
                  <input className={field} inputMode="numeric" value={form.payMin} onChange={(e) => set("payMin", e.target.value.replace(/\D/g, ""))} placeholder="15000" />
                </label>
                <label className="text-sm font-semibold">Highest (₹)
                  <input className={field} inputMode="numeric" value={form.payMax} onChange={(e) => set("payMax", e.target.value.replace(/\D/g, ""))} placeholder="22000" />
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-4">
                <label className="text-sm font-semibold">Description
                  <textarea className={field} rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={5000} />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold">What you will teach
                    <span className="block text-xs font-normal text-slate-500">One item per line</span>
                    <textarea className={field} rows={5} value={form.teach} onChange={(e) => set("teach", e.target.value)} />
                  </label>
                  <label className="text-sm font-semibold">Who we are looking for
                    <span className="block text-xs font-normal text-slate-500">One item per line</span>
                    <textarea className={field} rows={5} value={form.seeking} onChange={(e) => set("seeking", e.target.value)} />
                  </label>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-semibold">When can someone apply again?</p>
                  <p className="text-xs text-slate-500">Counted from the day they were rejected or withdrew. Use 0 to allow it straight away.</p>
                  <div className="mt-2 grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-semibold">After a rejection (days)
                      <input className={field} inputMode="numeric" value={form.rejectCooldownDays} onChange={(e) => set("rejectCooldownDays", e.target.value.replace(/\D/g, "").slice(0, 3))} />
                    </label>
                    <label className="text-sm font-semibold">After they withdraw (days)
                      <input className={field} inputMode="numeric" value={form.withdrawCooldownDays} onChange={(e) => set("withdrawCooldownDays", e.target.value.replace(/\D/g, "").slice(0, 3))} />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <>
                <Preview f={form} />
                <p className="mt-3 text-sm text-slate-600">
                  {editId ? "Saving updates the live page straight away if this role is Open." : "Publish now to show it on yugminds.org, or save it as a draft and publish later."}
                </p>
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
