"use client";

import { useEffect, useState } from "react";
import RowMenu from "@/components/portal/RowMenu";
import "./careers.css";
import { Check, ExternalLink, Link2, MapPin, Pencil, Plus, Search, Star, Trash2, Users, Wallet } from "lucide-react";
import Modal from "@/components/portal/Modal";
import { adminApi } from "@/lib/api/admin.api";
import { toast } from "@/components/ui/toast";
import { BRAND_ORIGINS } from "@/lib/brand-host";
import FormBuilder, { checkForm, countQuestions } from "./FormBuilder";
import type { FormConfig } from "@/lib/careers-form";

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
  formConfig?: FormConfig | null;
  status: "draft" | "open" | "paused" | "closed";
  positions: number;
  rejectCooldownDays: number;
  withdrawCooldownDays: number;
  applications: number;
  hired: number;
  newCount: number;
  stages?: Record<string, number>;
  createdAt: string;
};

const EMPTY = {
  title: "", team: "Teaching", positions: "1", location: "", jobType: "Full-time, Permanent",
  payMin: "", payMax: "", description: "", teach: "", seeking: "", status: "open",
  rejectCooldownDays: "90", withdrawCooldownDays: "30",
};
type Form = typeof EMPTY;
const STATUS_LABEL = { draft: "Draft", open: "Open", paused: "Paused", closed: "Closed" } as const;
const STEPS = ["Role", "Pay", "Details", "Application form", "Review"] as const;
const JOB_TYPES = ["Full-time, Permanent", "Part-time", "Contract", "Internship"];
const field = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal";
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const payText = (min: number | null, max: number | null) =>
  min && max ? `${inr(min)} – ${inr(max)} a month` : max ? `Up to ${inr(max)} a month` : min ? `From ${inr(min)} a month` : "Pay not shown";
const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return d < 1 ? "Today" : d < 31 ? `${d} ${d === 1 ? "day" : "days"} ago` : d < 365 ? `${Math.floor(d / 30)} months ago` : `${Math.floor(d / 365)} ${d < 730 ? "year" : "years"} ago`;
};
const FUNNEL = ["new", "screening", "interview", "demo_class", "offer", "hired"];
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
  openings, loading, failed, onChanged, onViewApplicants,
}: { openings: Opening[]; loading: boolean; failed: boolean; onChanged: () => void; onViewApplicants: (id: string, stage: string) => void }) {
  const [statusF, setStatusF] = useState("active");
  const [q, setQ] = useState("");
  const [locF, setLocF] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [starred, setStarred] = useState<string[]>([]);
  useEffect(() => { try { setStarred(JSON.parse(localStorage.getItem("careers-starred") || "[]")); } catch { /* none saved */ } }, []);
  const [form, setForm] = useState<Form | null>(null);
  const [fc, setFc] = useState<FormConfig | null>(null); // null = Teaching form
  const [editId, setEditId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof Form, v: string) => { setErr(""); setForm((f) => (f ? { ...f, [k]: v } : f)); };

  function start(o?: Opening) {
    setErr(""); setStep(0);
    setEditId(o?.id ?? null);
    setFc(o?.formConfig ?? null);
    setForm(o ? {
      title: o.title, team: o.team, positions: String(o.positions ?? 1), location: o.location, jobType: o.jobType,
      payMin: o.payMin?.toString() ?? "", payMax: o.payMax?.toString() ?? "", description: o.description,
      teach: (o.details?.teach ?? []).join("\n"), seeking: (o.details?.seeking ?? []).join("\n"), status: o.status,
      rejectCooldownDays: String(o.rejectCooldownDays ?? 90), withdrawCooldownDays: String(o.withdrawCooldownDays ?? 30),
    } : EMPTY);
  }

  function next() {
    if (!form) return;
    const p = step === 3 && fc ? checkForm(fc) : check(step, form);
    if (p) setErr(p); else { setErr(""); setStep((s) => s + 1); }
  }

  async function save(status: string) {
    if (!form) return;
    for (let i = 0; i < 3; i++) { const p = check(i, form); if (p) { setStep(i); setErr(p); return; } }
    const fp = fc ? checkForm(fc) : "";
    if (fp) { setStep(3); setErr(fp); return; }
    setSaving(true); setErr("");
    try {
      const data = { ...form, status, formConfig: fc };
      if (editId) await adminApi.careers.openings.update(editId, data);
      else await adminApi.careers.openings.create(data);
      toast.success(status === "open" ? "Opening is live on the site" : "Opening saved");
      setForm(null);
      onChanged();
    } catch (e) {
      setErr((e as Error).message || "That did not save. Try again.");
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

  async function copyLink(o: Opening) {
    try {
      await navigator.clipboard.writeText(`${BRAND_ORIGINS.yugminds}/careers/${o.slug}`);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy. Select the link from the Open page button.");
    }
  }

  async function remove(o: Opening) {
    if (!window.confirm(`Delete "${o.title}"? This cannot be undone.`)) return;
    try {
      await adminApi.careers.openings.delete(o.id);
      toast.success("Opening deleted");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message || "Could not delete.");
    }
  }

  const rows = openings.filter((o) =>
    (statusF === "all" ? true : statusF === "active" ? o.status === "open" || o.status === "paused" : o.status === statusF) &&
    (!q || o.title.toLowerCase().includes(q.toLowerCase())) && (!locF || o.location === locF));
  const locations = [...new Set(openings.map((o) => o.location))];
  const allSel = rows.length > 0 && rows.every((o) => sel.has(o.id));
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const star = (id: string) => setStarred((p) => {
    const n = p.includes(id) ? p.filter((x) => x !== id) : [...p, id];
    try { localStorage.setItem("careers-starred", JSON.stringify(n)); } catch { /* private mode */ }
    return n;
  });
  async function bulk(status: "paused" | "closed") {
    const ids = [...sel];
    if (status === "closed" && !window.confirm(`Close ${ids.length} opening(s)? They disappear from the site. Applications are kept.`)) return;
    try {
      await Promise.all(ids.map((id) => adminApi.careers.openings.update(id, { status })));
      toast.success(status === "paused" ? "Applications paused" : "Openings closed");
    } catch { toast.error("Some openings could not be changed."); }
    setSel(new Set()); onChanged();
  }
  const sorted = [...rows].sort((a, b) => Number(starred.includes(b.id)) - Number(starred.includes(a.id)));
  const filtered = statusF !== "active" || q !== "" || locF !== "";

  return (
    <div className="cr">
      <div className="cr-filters">
        <select aria-label="Status" value={statusF} onChange={(e) => setStatusF(e.target.value)} className="sd-field">
          <option value="active">Open and paused</option>
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v} only</option>)}
        </select>
        <label className="cr-search">
          <Search aria-hidden="true" />
          <input aria-label="Search by title" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title" className="sd-field" />
        </label>
        {locations.length > 1 && (
          <select aria-label="Location" value={locF} onChange={(e) => setLocF(e.target.value)} className="sd-field">
            <option value="">All locations</option>
            {locations.map((l) => <option key={l}>{l}</option>)}
          </select>
        )}
        {filtered && <button className="cr-link" onClick={() => { setStatusF("active"); setQ(""); setLocF(""); }}>Clear filters</button>}
        <span className="cr-count" aria-live="polite">{rows.length} {rows.length === 1 ? "opening" : "openings"}</span>
        <button onClick={() => start()} className="sd-btn sd-btn--ink"><Plus aria-hidden="true" />New opening</button>
      </div>

      {failed ? (
        <div className="cr-empty" role="alert"><b>Could not load openings</b><p>Check your connection and try again.</p><button className="sd-btn sd-btn--ink" onClick={onChanged}>Try again</button></div>
      ) : loading && openings.length === 0 ? (
        <div className="cr-list" aria-hidden="true"><div className="cr-skel" /><div className="cr-skel" /><div className="cr-skel" /></div>
      ) : openings.length === 0 ? (
        <div className="cr-empty">
          <b>No openings yet</b>
          <p>Create your first role. It goes live on yugminds.org when you publish it, and applications land here.</p>
          <button onClick={() => start()} className="sd-btn sd-btn--amber"><Plus aria-hidden="true" />Create opening</button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="cr-empty"><b>No openings match</b><p>Try a different status, title or location.</p></div>
      ) : (
        <div className="cr-list">
          <div className="cr-head cr-op-head">
            <input type="checkbox" className="cr-check" aria-label="Select all openings" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(rows.map((o) => o.id)))} />
            <span>Job title</span><span>Candidates by stage</span><span>Posted</span><span>Status</span><span />
          </div>
          {sorted.map((o) => {
            const filled = o.hired >= o.positions && o.status !== "closed";
            const banner = o.status === "draft" ? ["Draft. It is not on yugminds.org until you publish it.", "Publish", () => void setStatus(o, "open")] as const
              : filled ? ["All positions are filled. Close the role to stop new applications.", "Close role", () => void close(o)] as const : null;
            return (
              <div key={o.id} className="cr-row cr-op" data-selected={sel.has(o.id)} data-hot={o.newCount > 0}>
                <input type="checkbox" className="cr-check" aria-label={`Select ${o.title}`} checked={sel.has(o.id)} onChange={() => toggle(o.id)} />
                <div className="cr-title">
                  <button className="cr-star" onClick={() => star(o.id)} aria-label={starred.includes(o.id) ? `Unstar ${o.title}` : `Star ${o.title}`} aria-pressed={starred.includes(o.id)}><Star aria-hidden="true" /></button>
                  <div className="cr-name">
                    <button onClick={() => start(o)}>{o.title}</button>
                    <small>{o.location} · {o.team}</small>
                    <small>{payText(o.payMin, o.payMax)}</small>
                  </div>
                </div>
                <button className="cr-funnel" onClick={() => onViewApplicants(o.id, "all")} aria-label={`View ${o.applications} candidates for ${o.title}`}>
                  <span className="cr-bar" aria-hidden="true">
                    {FUNNEL.filter((st) => (o.stages?.[st] ?? 0) > 0).map((st) => <i key={st} style={{ flexGrow: o.stages![st], ["--seg" as string]: `var(--cr-${st})` }} />)}
                  </span>
                  <span className="cr-funnel-txt">
                    <span><b>{o.applications}</b> {o.applications === 1 ? "candidate" : "candidates"}</span>
                    {o.newCount > 0 && <span className="cr-new">{o.newCount} new</span>}
                    <span>{o.hired} of {o.positions} hired</span>
                  </span>
                </button>
                <p className="cr-muted cr-posted">{ago(o.createdAt)}<br />{new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                <div className="cr-statuscell">
                  <select aria-label={`Status of ${o.title}`} data-s={o.status} value={o.status} className="sd-field cr-select"
                    onChange={(e) => e.target.value === "closed" ? void close(o) : void setStatus(o, e.target.value)}>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <RowMenu label={`Actions for ${o.title}`} items={[
                  { label: "Edit", icon: Pencil, onClick: () => start(o) },
                  { label: "View candidates", icon: Users, onClick: () => onViewApplicants(o.id, "all") },
                  ...(o.status === "draft" ? [] : [{ label: "Copy link", icon: Link2, onClick: () => void copyLink(o) }]),
                  ...(o.status === "open" ? [{ label: "View on site", icon: ExternalLink, onClick: () => { window.open(`${BRAND_ORIGINS.yugminds}/careers/${o.slug}`, "_blank", "noopener"); } }] : []),
                  { label: "Delete", icon: Trash2, onClick: () => void remove(o), danger: true, separatorBefore: true },
                ]} />
                {banner && (
                  <div className="cr-banner"><span>{banner[0]}</span><button onClick={banner[2]} className="sd-btn sd-btn--ink">{banner[1]}</button></div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sel.size > 0 && (
        <div role="region" aria-label="Bulk actions" className="cr-bulk">
          <b>{sel.size} selected</b>
          <button onClick={() => void bulk("paused")} className="sd-btn sd-btn--line">Pause</button>
          <button onClick={() => void bulk("closed")} className="sd-btn sd-btn--line">Close</button>
          <button onClick={() => setSel(new Set())} className="cr-link" style={{ color: "inherit" }}>Clear</button>
        </div>
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

            {step === 3 && <FormBuilder value={fc} onChange={(v) => { setErr(""); setFc(v); }} title={form.title} slug={editId ? (openings.find((o) => o.id === editId)?.slug ?? "") : ""} />}

            {step === 4 && (
              <>
                <Preview f={form} />
                <p className="mt-3 text-sm text-slate-600">Application form: {fc ? `${fc.steps.length} ${fc.steps.length === 1 ? "step" : "steps"}, ${countQuestions(fc)} questions` : "Teaching form (standard)"}.</p>
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
