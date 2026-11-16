"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Download, Eye, Mail, MapPin, Phone, RefreshCw, Search, Star, Video } from "lucide-react";
import Modal from "@/components/portal/Modal";
import ConfirmModal from "@/components/portal/ConfirmModal";
import { ChipGroup, Pager } from "@/components/portal/notifications";
import OpeningsPanel, { type Opening } from "./OpeningsPanel";
import { adminApi } from "@/lib/api/admin.api";
import { toast } from "@/components/ui/toast";
import "@/components/school-admin/overview.css"; // hero meta
import "@/components/school-admin/students.css"; // sm- chips and forms

const LIMIT = 20;
const STAGES = ["new", "screening", "interview", "demo_class", "offer", "hired", "rejected", "on_hold", "withdrawn"] as const;
const LABEL: Record<string, string> = {
  all: "All", new: "New", screening: "Screening", interview: "Interview", demo_class: "Demo class",
  offer: "Offer", hired: "Hired", rejected: "Rejected", on_hold: "On hold", withdrawn: "Withdrawn",
};

type Row = {
  id: string; ref: string; role: string | null; full_name: string; email: string; phone: string; city: string;
  stage: string; rating: number | null; experience_years: number; qualification: string; created_at: string;
};
type Event = { id: string; type: string; from_stage: string | null; to_stage: string | null; body: string | null; created_at: string };
type Detail = Row & {
  will_travel: boolean; college: string | null; grad_year: number | null; current_status: string; skills: string[];
  grade_bands: string[]; english_level: number; has_two_wheeler: boolean; answers: { why?: string; explain?: string };
  expected_salary: number | null; join_date: string | null; heard_from: string | null; video_url: string | null;
  has_resume: boolean; resume_name: string | null; events: Event[];
};

const PIPE = ["new", "screening", "interview", "demo_class", "offer", "hired"] as const;
const MAILED = ["screening", "interview", "demo_class", "offer", "hired", "on_hold", "rejected"];
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function CareersAdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<"applications" | "openings">("applications");
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [roleId, setRoleId] = useState("");
  const [opLoading, setOpLoading] = useState(true);
  const [opFailed, setOpFailed] = useState(false);
  const [stage, setStage] = useState("all");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<Detail | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const [message, setMessage] = useState("");
  const [del, setDel] = useState(false);
  const [view, setView] = useState<{ url: string; pdf: boolean } | null>(null);
  const [ptab, setPtab] = useState<"overview" | "answers" | "notes">("overview");

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.careers.list({ stage, page, limit: LIMIT, search: search || undefined, opening: roleId || undefined });
      setRows(data.applications);
      setTotal(data.total);
      setCounts(data.stage_counts);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [stage, page, search, roleId]);
  useEffect(() => { void load(); }, [load]);

  const loadOpenings = useCallback(async () => {
    setOpLoading(true);
    try { setOpenings((await adminApi.careers.openings.list()).data.openings); setOpFailed(false); } catch { setOpFailed(true); } finally { setOpLoading(false); }
  }, []);
  useEffect(() => { void loadOpenings(); }, [loadOpenings]);

  async function show(id: string) {
    try {
      const { data } = await adminApi.careers.get(id);
      setOpen(data);
      setPtab("overview");
      setNote("");
      setPending(null);
    } catch {
      toast.error("Could not open this application.");
    }
  }

  async function act(data: { stage?: string; rating?: number | null; note?: string; notify?: boolean; message?: string }, done: string) {
    if (!open) return;
    setSaving(true);
    try {
      const res = await adminApi.careers.update(open.id, data);
      toast.success(data.notify && res.data?.emailed ? `${done}. Email sent.` : data.notify ? `${done}. Email not sent (mail is not set up).` : done);
      const [fresh] = await Promise.all([adminApi.careers.get(open.id), load()]);
      setOpen(fresh.data);
      setNote("");
      setPending(null);
      setMessage("");
    } catch {
      toast.error("That did not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function purge() {
    if (!open) return;
    setSaving(true);
    try {
      await adminApi.careers.purge(open.id);
      toast.success("Application deleted.");
      setDel(false);
      setOpen(null);
      await load();
    } catch {
      toast.error("Could not delete this application.");
    } finally {
      setSaving(false);
    }
  }

  function closeView() { if (view) URL.revokeObjectURL(view.url); setView(null); }

  async function preview() {
    if (!open) return;
    try {
      const res = await adminApi.careers.resume(open.id);
      const pdf = /\.pdf$/i.test(open.resume_name ?? "");
      setView({ pdf, url: URL.createObjectURL(pdf ? new Blob([res.data], { type: "application/pdf" }) : res.data) });
    } catch {
      toast.error("Could not open the resume.");
    }
  }

  async function resume() {
    if (!open) return;
    try {
      const res = await adminApi.careers.resume(open.id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${open.ref}-${open.resume_name ?? "resume.pdf"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download the resume.");
    }
  }

  const total_all = Object.values(counts).reduce((a, b) => a + b, 0);
  const options = (["all", ...STAGES] as const).map(
    (s) => [s, `${LABEL[s]} ${s === "all" ? total_all : counts[s] ?? 0}`] as const,
  );

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="cr-title">
        <div className="sd-hero-copy">
          <h1 id="cr-title" className="mc-hero-title">Careers</h1>
          <p className="sd-where">
            {(() => {
              const op = openings.filter((o) => o.status === "open"), pa = openings.filter((o) => o.status === "paused");
              const seats = op.reduce((n, o) => n + o.positions, 0);
              return `${op.length} open ${op.length === 1 ? "role" : "roles"} · ${seats} ${seats === 1 ? "position" : "positions"}${pa.length ? ` · ${pa.length} paused` : ""}`;
            })()}
          </p>
          <p className="sd-status">
            {counts.new ? `${counts.new} new to review` : "No new applications"} · {total_all} in total
          </p>
        </div>
        <div className="so-meta">
          <button className="so-refresh" onClick={() => void load()} disabled={loading} aria-label="Refresh" title="Refresh">
            <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
          </button>
        </div>
      </section>

      <ChipGroup label="View" value={tab} options={[["applications", "Applications"], ["openings", "Openings"]] as const} onChange={(v) => setTab(v as "applications" | "openings")} />
      {tab === "openings" ? (
        <OpeningsPanel openings={openings} loading={opLoading} failed={opFailed} onChanged={() => { void loadOpenings(); void load(); }} />
      ) : (<>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <ChipGroup label="Stage" value={stage} options={options} onChange={(v) => { setStage(v); setPage(1); }} />
        {openings.length > 1 && (
          <select value={roleId} onChange={(e) => { setRoleId(e.target.value); setPage(1); }} aria-label="Filter by role" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">All roles</option>
            {openings.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
        )}
        <label className="relative ml-auto block">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 opacity-60" aria-hidden="true" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email, phone, ref"
            aria-label="Search applications"
            className="w-64 rounded-md border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm"
          />
        </label>
      </div>

      {failed ? (
        <p role="alert" className="mt-6">Could not load applications. <button className="underline" onClick={() => void load()}>Try again</button></p>
      ) : !loading && rows.length === 0 ? (
        <p className="mt-6 opacity-70">{search || stage !== "all" ? "No applications match." : "No applications yet. They appear here when someone applies on yugminds.org/careers."}</p>
      ) : (
        <ul className="mt-5 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {rows.map((r) => (
            <li key={r.id}>
              <button onClick={() => void show(r.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-slate-50">
                <span className="min-w-40 font-semibold">{r.full_name}</span>
                {openings.length > 1 && r.role && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{r.role}</span>}
                <span className="text-sm opacity-70">{r.city} · {r.experience_years} yr · {r.qualification}</span>
                <span className="ml-auto flex items-center gap-3 text-sm">
                  {r.rating ? <span className="flex items-center gap-0.5"><Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />{r.rating}</span> : null}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold">{LABEL[r.stage] ?? r.stage}</span>
                  <span className="opacity-60">{day(r.created_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Pager
        offset={(page - 1) * LIMIT}
        count={rows.length}
        total={total}
        pageSize={LIMIT}
        busy={loading}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
        noun="applications"
      />
      </>)}

      <Modal
        open={!!open}
        onClose={() => { if (!saving && !pending && !view && !del) setOpen(null); }}
        title={open?.full_name ?? ""}
        subtitle={open ? `${open.role ?? "Application"} · ${open.ref} · applied ${day(open.created_at)}` : undefined}
        wide
        footer={open && ptab === "notes" && (
          <div className="flex w-full items-end gap-2">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} aria-label="Add a note"
              placeholder="Add a private note. Only admins see it." className="flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <button disabled={saving || !note.trim()} onClick={() => void act({ note }, "Note added")}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Add note</button>
          </div>
        )}
      >
        {open && (() => {
          const cur = PIPE.indexOf(open.stage as (typeof PIPE)[number]);
          const first = open.full_name.split(" ")[0];
          const notes = open.events.filter((e) => e.type === "note").length;
          const fact = (k: string, v: string) => (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">{k}</dt><dd className="mt-0.5 font-semibold">{v}</dd>
            </div>
          );
          const chips = (items: string[], empty: string) => items.length
            ? items.map((s) => <span key={s} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-ym-blue">{s}</span>)
            : <span className="text-slate-500">{empty}</span>;
          const tabs = [["overview", "Overview"], ["answers", "Answers"], ["notes", `Notes and history${notes ? ` (${notes})` : ""}`]] as const;
          const go = (s: string) => { setPending(s === pending ? null : s); setNotify(true); setMessage(""); };
          return (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <a className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1 hover:bg-slate-50" href={`mailto:${open.email}`}><Mail className="h-3.5 w-3.5" aria-hidden="true" />{open.email}</a>
              <a className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1 hover:bg-slate-50" href={`tel:${open.phone}`}><Phone className="h-3.5 w-3.5" aria-hidden="true" />{open.phone}</a>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{open.city}{open.will_travel ? "" : " · cannot travel"}</span>
              {open.has_resume && (
                <>
                  <button onClick={() => void preview()} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1 font-semibold hover:bg-slate-50">
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />View resume
                  </button>
                  <button onClick={() => void resume()} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1 font-semibold hover:bg-slate-50">
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />Download
                  </button>
                </>
              )}
              {open.video_url && (
                <a href={open.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1 font-semibold hover:bg-slate-50">
                  <Video className="h-3.5 w-3.5" aria-hidden="true" />Intro video
                </a>
              )}
            </div>

            <section aria-label="Hiring stage" className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">
                  Hiring stage
                  {!PIPE.includes(open.stage as (typeof PIPE)[number]) && <span className="ml-2 rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">{LABEL[open.stage]}</span>}
                </h3>
                <div className="flex gap-2">
                  {(["on_hold", "rejected"] as const).map((s) => (
                    <button key={s} disabled={saving || s === open.stage} onClick={() => go(s)}
                      className={`rounded-md border px-3 py-1 text-xs font-semibold disabled:opacity-40 ${s === "rejected" ? "border-red-200 text-red-700 hover:bg-red-50" : "border-slate-300 hover:bg-slate-100"}`}>
                      {s === "rejected" ? "Reject" : "Put on hold"}
                    </button>
                  ))}
                </div>
              </div>
              <ol className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {PIPE.map((s, i) => {
                  const done = cur > i, now = cur === i;
                  return (
                    <li key={s}>
                      <button disabled={saving || now} aria-current={now ? "step" : undefined} onClick={() => go(s)}
                        className={`flex w-full flex-col items-center gap-1.5 rounded-lg border px-1 py-2.5 text-xs font-semibold transition-colors ${now ? "border-slate-900 bg-slate-900 text-white" : done ? "border-blue-200 bg-blue-50 text-ym-blue hover:border-ym-blue" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                        <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${now ? "bg-white text-slate-900" : done ? "bg-ym-blue text-white" : "bg-slate-100"}`}>
                          {done ? <Check className="h-3 w-3" aria-hidden="true" /> : i + 1}
                        </span>
                        {LABEL[s]}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>

            <div role="tablist" aria-label="Application sections" className="flex gap-1 border-b border-slate-200">
              {tabs.map(([k, l]) => (
                <button key={k} role="tab" id={`cr-tab-${k}`} aria-selected={ptab === k} aria-controls="cr-panel" onClick={() => setPtab(k)}
                  className={`-mb-px border-b-2 px-3 py-2 font-semibold ${ptab === k ? "border-ym-blue text-ym-blue" : "border-transparent text-slate-500 hover:text-slate-900"}`}>
                  {l}
                </button>
              ))}
            </div>

            <div role="tabpanel" id="cr-panel" aria-labelledby={`cr-tab-${ptab}`} className="space-y-3">
              {ptab === "overview" && (<>
                <div className="flex items-center justify-between">
                  <p className="text-slate-600">{open.qualification}{open.college ? `, ${open.college}` : ""}{open.grad_year ? ` (${open.grad_year})` : ""}</p>
                  <div className="flex items-center gap-1" role="group" aria-label="Your rating">
                    <span className="mr-1 text-xs text-slate-500">{open.rating ? `You rated ${open.rating}/5` : "Rate this applicant"}</span>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} disabled={saving} aria-label={`${n} star${n > 1 ? "s" : ""}`} aria-pressed={open.rating === n}
                        onClick={() => void act({ rating: open.rating === n ? null : n }, "Rating saved")}>
                        <Star className={`h-5 w-5 ${open.rating && n <= open.rating ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-amber-300"}`} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {fact("Experience", `${open.experience_years} yr · ${open.current_status}`)}
                  {fact("English", `${open.english_level}/5`)}
                  {fact("Expects", open.expected_salary ? `₹${open.expected_salary.toLocaleString("en-IN")}` : "Not said")}
                  {fact("Can join", open.join_date ?? "Not said")}
                </dl>
                <p className="text-slate-600">{open.has_two_wheeler ? "Has a two-wheeler" : "No two-wheeler"}{open.heard_from ? ` · Heard from ${open.heard_from}` : ""}</p>
                <div className="flex flex-wrap items-center gap-1.5"><span className="mr-1 text-slate-500">Skills</span>{chips(open.skills, "None listed")}</div>
                <div className="flex flex-wrap items-center gap-1.5"><span className="mr-1 text-slate-500">Can teach</span>{chips(open.grade_bands, "Not said")}</div>
                <div className="border-t border-slate-200 pt-3">
                  <button onClick={() => setDel(true)} className="text-xs font-semibold text-red-700 hover:underline">Delete this application</button>
                </div>
              </>)}

              {ptab === "answers" && ([["Why do they want to be a trainer?", open.answers.why], ["How would they explain a sensor to a 10-year-old?", open.answers.explain]] as const).map(([q, a]) => (
                <figure key={q} className="rounded-lg border-l-4 border-ym-blue bg-slate-50 px-4 py-3">
                  <figcaption className="text-xs font-semibold text-slate-500">{q}</figcaption>
                  <p className="mt-1 whitespace-pre-wrap">{a || "No answer"}</p>
                </figure>
              ))}

              {ptab === "notes" && (
                <ul className="space-y-3 border-l border-slate-200 pl-4">
                  {[...open.events].reverse().map((e) => (
                    <li key={e.id} className="relative">
                      <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${e.type === "note" ? "bg-amber-400" : "bg-ym-blue"}`} aria-hidden="true" />
                      <p className="text-xs text-slate-500">{day(e.created_at)}</p>
                      {e.type === "note"
                        ? <p className="mt-1 whitespace-pre-wrap rounded-md bg-amber-50 px-3 py-2">{e.body}</p>
                        : <p>{e.type === "stage_change" ? `Moved from ${LABEL[e.from_stage ?? ""] ?? e.from_stage} to ${LABEL[e.to_stage ?? ""] ?? e.to_stage}`
                          : e.type === "submitted" ? (e.body || "Application submitted") : e.type === "email" ? `Emailed ${first}: ${LABEL[e.to_stage ?? ""] ?? e.to_stage}` : e.body}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          );
        })()}
      </Modal>

      <Modal
        open={!!open && !!pending}
        onClose={() => { if (!saving) { setPending(null); setMessage(""); } }}
        title={open && pending ? `${pending === "rejected" ? "Reject" : "Move"} ${open.full_name.split(" ")[0]}${pending === "rejected" ? "?" : ` to ${LABEL[pending]}?`}` : ""}
        subtitle={open && pending ? `Currently ${LABEL[open.stage]}. You can move them again later.` : undefined}
        footer={open && pending && (<>
          <button disabled={saving} onClick={() => { setPending(null); setMessage(""); }} className="rounded-md px-4 py-2 text-sm font-semibold hover:bg-slate-100">Cancel</button>
          <button disabled={saving} onClick={() => void act({ stage: pending, notify: MAILED.includes(pending) && notify, message: message.trim() || undefined }, `Moved to ${LABEL[pending]}`)}
            className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${pending === "rejected" ? "bg-red-600" : "bg-ym-blue"}`}>
            {saving ? "Saving…" : pending === "rejected" ? (notify ? "Reject and email" : "Reject") : MAILED.includes(pending) && notify ? "Move and email" : "Move"}
          </button>
        </>)}
      >
        {open && pending && (
          <div className="space-y-3 text-sm">
            {MAILED.includes(pending) ? (<>
              <label className="flex items-center gap-2 font-semibold">
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                Email {open.full_name.split(" ")[0]} about this
              </label>
              {notify && (
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={600}
                  aria-label="Message to include"
                  placeholder={pending === "interview" ? "Add the date, time and place" : pending === "rejected" ? "Optional personal note" : "Optional note, shown in the email"}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2" />
              )}
            </>) : <p>No email is sent for this stage.</p>}
          </div>
        )}
      </Modal>

      <Modal
        open={!!open && !!view}
        onClose={closeView}
        title={open ? `${open.full_name}'s resume` : ""}
        subtitle={open?.resume_name ?? undefined}
        wide
        footer={<button onClick={() => void resume()} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100"><Download className="h-4 w-4" aria-hidden="true" />Download</button>}
      >
        {view?.pdf ? (
          <iframe src={view.url} title="Resume preview" className="h-[70vh] w-full rounded-md border border-slate-200" />
        ) : (
          <p className="py-10 text-center text-sm text-slate-600">Word files can&apos;t be previewed in the browser. Download it to read it.</p>
        )}
      </Modal>

      <ConfirmModal
        open={!!open && del}
        onClose={() => setDel(false)}
        title={open ? `Delete ${open.full_name.split(" ")[0]}'s application?` : ""}
        subtitle="Use this for a data deletion request."
        confirmLabel="Delete for good"
        onConfirm={() => void purge()}
        busy={saving}
        danger
      >
        <p className="text-sm">This erases the application, notes and resume. It cannot be undone. To close an application and keep the record, move it to Rejected instead.</p>
      </ConfirmModal>
    </div>
  );
}
