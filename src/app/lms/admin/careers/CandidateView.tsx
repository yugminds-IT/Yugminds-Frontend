"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Download, Mail, MapPin, Phone, Star, Trash2, Video } from "lucide-react";
import { adminApi } from "@/lib/api/admin.api";
import { toast } from "@/components/ui/toast";
import RowMenu from "@/components/portal/RowMenu";

export const STAGES = ["new", "screening", "interview", "demo_class", "offer", "hired", "rejected", "on_hold", "withdrawn"] as const;
export const LABEL: Record<string, string> = {
  all: "All", new: "New", screening: "Screening", interview: "Interview", demo_class: "Demo class",
  offer: "Offer", hired: "Hired", rejected: "Rejected", on_hold: "On hold", withdrawn: "Withdrawn",
};
export const PIPE = ["new", "screening", "interview", "demo_class", "offer", "hired"] as const;
export const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export type Row = {
  id: string; ref: string; role: string | null; full_name: string; email: string; phone: string; city: string;
  stage: string; rating: number | null; experience_years: number; qualification: string; created_at: string; updated_at?: string;
  english_level: number | null; has_two_wheeler: boolean | null; will_travel: boolean | null; skills: string[];
};
export type Event = { id: string; type: string; from_stage: string | null; to_stage: string | null; body: string | null; created_at: string };
export type Detail = Row & {
  college: string | null; grad_year: number | null; current_status: string;
  grade_bands: string[]; responses: { label: string; value: string }[];
  expected_salary: number | null; join_date: string | null; heard_from: string | null; video_url: string | null;
  has_resume: boolean; resume_name: string | null; events: Event[];
};

type Props = {
  open: Detail;
  rows: Row[];
  saving: boolean;
  onBack: () => void;
  onShow: (id: string) => void;
  onGo: (stage: string) => void;
  onResend: () => void;
  onAct: (data: { rating?: number | null; note?: string }, done: string) => Promise<void>;
  onDelete: () => void;
};

// Applicants often type in ALL CAPS; show those in normal case.
export const nice = (v?: string | null) => (v && v === v.toUpperCase() && /[A-Z]/.test(v) ? v.toLowerCase().replace(/(^|[\s.-])([a-z])/g, (_, p, c) => p + c.toUpperCase()) : v ?? "");
const DOT: Record<string, string> = { new: "var(--sd-amber-deep)", screening: "#93b4f5", interview: "var(--sd-blue)", demo_class: "var(--sd-blue-deep)", offer: "var(--sd-navy)", hired: "#1f8a4c", rejected: "var(--sd-late)", on_hold: "#b88a1b", withdrawn: "var(--sd-ink-soft)" };
const initials = (n: string) => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export default function CandidateView({ open, rows, saving, onBack, onShow, onGo, onResend, onAct, onDelete }: Props) {
  const [tab, setTab] = useState<"profile" | "resume" | "notes">("profile");
  const [note, setNote] = useState("");
  const [resume, setResume] = useState<{ url: string; pdf: boolean } | null>(null);

  // Load the resume only when its tab is opened.
  useEffect(() => {
    if (tab !== "resume" || !open.has_resume) return;
    let url = "";
    let gone = false;
    adminApi.careers.resume(open.id)
      .then((res) => {
        const pdf = /\.pdf$/i.test(open.resume_name ?? "");
        url = URL.createObjectURL(pdf ? new Blob([res.data], { type: "application/pdf" }) : res.data);
        if (!gone) setResume({ pdf, url });
      })
      .catch(() => toast.error("Could not open the resume."));
    return () => { gone = true; setResume(null); if (url) URL.revokeObjectURL(url); };
  }, [tab, open.id, open.has_resume, open.resume_name]);

  async function download() {
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

  const i = rows.findIndex((r) => r.id === open.id);
  const prev = i > 0 ? rows[i - 1] : null;
  const next = i >= 0 && i < rows.length - 1 ? rows[i + 1] : null;
  const cur = PIPE.indexOf(open.stage as (typeof PIPE)[number]);
  const nxt = cur >= 0 ? PIPE[cur + 1] : undefined;
  const name = nice(open.full_name);
  const first = name.split(" ")[0];
  const back = [...open.events].reverse().find((e) => e.type === "stage_change" && e.to_stage === open.stage)?.from_stage;
  const backTo = back && PIPE.includes(back as (typeof PIPE)[number]) ? back : null;
  const lastMail = [...open.events].reverse().find((e) => e.type === "email" || e.type === "email_failed");
  const notes = open.events.filter((e) => e.type === "note").length;
  const tabs = [["profile", "Profile"], ["resume", "Resume"], ["notes", `Notes and history${notes ? ` (${notes})` : ""}`]] as const;

  const fact = (k: string, v: string) => (
    <div className="cv-fact"><dt>{k}</dt><dd>{v}</dd></div>
  );
  const chips = (items: string[], empty: string) =>
    items.length ? items.map((s) => <span key={s} className="cv-chip">{s}</span>) : <span className="cr-muted">{empty}</span>;

  return (
    <div className="cv">
      <div className="cv-bar">
        <button className="cr-link inline-flex items-center gap-1.5" onClick={onBack}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to applications</button>
        <div className="cv-nav" role="group" aria-label="Candidates">
          <button disabled={!prev} onClick={() => prev && onShow(prev.id)} aria-label={prev ? `Previous: ${prev.full_name}` : "No previous candidate"}><ArrowLeft aria-hidden="true" /></button>
          <button disabled={!next} onClick={() => next && onShow(next.id)} aria-label={next ? `Next: ${next.full_name}` : "No next candidate"}><ArrowRight aria-hidden="true" /></button>
          <span>{i >= 0 ? `${i + 1} of ${rows.length}` : ""}</span>
        </div>
      </div>

      <div className="cv-grid" data-solo={rows.length < 2}>
        <aside className="cv-rail" aria-label="Candidates in this list">
          {rows.length > 1 && rows.map((r) => (
            <button key={r.id} className="cv-rail-item" aria-current={r.id === open.id ? "true" : undefined} onClick={() => r.id !== open.id && onShow(r.id)}>
              <span className="sd-avatar" aria-hidden="true">{initials(r.full_name)}</span>
              <span className="cv-rail-txt"><b>{nice(r.full_name)}</b><small>{LABEL[r.stage] ?? r.stage}{r.city ? ` · ${nice(r.city)}` : ""}</small></span>
            </button>
          ))}
        </aside>

        <section className="cv-main" aria-label={`${name}'s application`}>
          <header className="cv-head">
            <div>
              <div className="cv-title">
                <h2>{name}</h2>
                <span className="cv-pill" style={{ ["--c" as string]: DOT[open.stage] }}>{LABEL[open.stage]}</span>
              </div>
              <p className="cr-muted">{open.role ?? "Application"} · {open.ref} · applied {day(open.created_at)}</p>
              <p className="cv-contact">
                <a href={`mailto:${open.email}`}><Mail aria-hidden="true" />{open.email}</a>
                {open.phone && <a href={`tel:${open.phone}`}><Phone aria-hidden="true" />{open.phone}</a>}
                {open.city && <span><MapPin aria-hidden="true" />{nice(open.city)}</span>}
              </p>
            </div>
            <RowMenu label="More actions" items={[{ label: "Delete application", icon: Trash2, onClick: onDelete, danger: true }]} />
          </header>

          <div className="cv-actions">
            {nxt && <button className="sd-btn sd-btn--ink" disabled={saving} onClick={() => onGo(nxt)}>Move to {LABEL[nxt]}<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>}
            {open.has_resume && <button className="sd-btn sd-btn--line" onClick={() => void download()}><Download className="h-4 w-4" aria-hidden="true" />Download resume</button>}
            {open.video_url && <a className="sd-btn sd-btn--line" href={open.video_url} target="_blank" rel="noopener noreferrer"><Video className="h-4 w-4" aria-hidden="true" />Intro video</a>}
            <label className="cv-status">
              <span>Stage</span>
              <select className="sd-field" value={open.stage} disabled={saving} onChange={(e) => e.target.value !== open.stage && onGo(e.target.value)} aria-label="Change stage">
                {STAGES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
              </select>
            </label>
          </div>

          {cur < 0 && (
            <div className="cv-off" role="status">
              <p><b>{first} is {LABEL[open.stage].toLowerCase()}.</b> {open.stage === "rejected" ? "They are out of the process." : "They are paused outside the steps below."}</p>
              {backTo && <button className="sd-btn sd-btn--ink" disabled={saving} onClick={() => onGo(backTo)}>Move back to {LABEL[backTo]}</button>}
            </div>
          )}
          <ol className="cv-steps" aria-label="Hiring progress" data-off={cur < 0}>
            {PIPE.map((s, n) => {
              const done = cur > n, now = cur === n;
              return (
                <li key={s}>
                  <button disabled={saving || now} aria-current={now ? "step" : undefined} data-done={done} onClick={() => onGo(s)}>
                    <i>{done ? <Check aria-hidden="true" /> : n + 1}</i>{LABEL[s]}
                  </button>
                </li>
              );
            })}
          </ol>

          <div role="tablist" aria-label="Application sections" className="cv-tabs">
            {tabs.map(([k, l]) => (
              <button key={k} role="tab" id={`cv-tab-${k}`} aria-selected={tab === k} aria-controls="cv-panel" onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>

          <div role="tabpanel" id="cv-panel" aria-labelledby={`cv-tab-${tab}`} className="cv-panel">
            {tab === "profile" && (<>
              <div className="cv-row">
                <p>{open.qualification}{open.qualification && open.college ? ", " : ""}{open.college ? nice(open.college) : ""}{open.grad_year ? ` (${open.grad_year})` : ""}</p>
                <div className="cv-rate" role="group" aria-label="Your rating">
                  <span>{open.rating ? `You rated ${open.rating}/5` : "Rate this applicant"}</span>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} disabled={saving} aria-label={`${n} star${n > 1 ? "s" : ""}`} aria-pressed={open.rating === n}
                      onClick={() => void onAct({ rating: open.rating === n ? null : n }, "Rating saved")}>
                      <Star data-on={!!open.rating && n <= open.rating} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
              <dl className="cv-facts">
                {(open.experience_years > 0 || open.current_status) && fact("Experience", `${open.experience_years} yr${open.current_status ? ` · ${open.current_status}` : ""}`)}
                {open.english_level != null && fact("English", `${open.english_level} of 5`)}
                {open.expected_salary != null && fact("Expects", `₹${open.expected_salary.toLocaleString("en-IN")}`)}
                {open.join_date && fact("Can join", open.join_date)}
              </dl>
              {(open.will_travel != null || open.has_two_wheeler != null || open.heard_from) && (
                <p className="cv-line">{[
                  open.will_travel != null && (open.will_travel ? "Can travel" : "Cannot travel"),
                  open.has_two_wheeler != null && (open.has_two_wheeler ? "has a two-wheeler" : "no two-wheeler"),
                  open.heard_from && `heard from ${open.heard_from}`,
                ].filter(Boolean).join(" · ")}</p>
              )}
              {open.skills.length > 0 && <div className="cv-tags"><span>Skills</span>{chips(open.skills, "")}</div>}
              {open.grade_bands.length > 0 && <div className="cv-tags"><span>Can teach</span>{chips(open.grade_bands, "")}</div>}
              {open.responses.length > 0 && <h3 className="cv-h">Their answers</h3>}
              {open.responses.map((r) => (
                <figure key={r.label} className="cv-ans">
                  <figcaption>{r.label}</figcaption>
                  <p>{r.value}</p>
                </figure>
              ))}
            </>)}

            {tab === "resume" && (
              !open.has_resume ? <p className="cr-muted">{first} did not upload a resume.</p>
              : !resume ? <div className="cr-skel" aria-label="Loading resume" />
              : resume.pdf ? <iframe src={resume.url} title={`${name}'s resume`} className="cv-pdf" />
              : <div className="cr-empty"><b>Word files can&apos;t be previewed</b><p>Download the resume to read it.</p><button className="sd-btn sd-btn--ink" onClick={() => void download()}>Download resume</button></div>
            )}

            {tab === "notes" && (<>
              <div className="cv-note">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} aria-label="Add a note" className="sd-field" placeholder="Add a private note. Only admins see it." />
                <button className="sd-btn sd-btn--ink" disabled={saving || !note.trim()} onClick={() => void onAct({ note }, "Note added").then(() => setNote(""))}>Add note</button>
              </div>
              <ul className="cv-tl">
                {[...open.events].reverse().map((e) => (
                  <li key={e.id} data-note={e.type === "note"}>
                    <small>{day(e.created_at)}</small>
                    {e.type === "note" ? <p className="cv-note-body">{e.body}</p>
                      : <p>{e.type === "stage_change" ? `Moved from ${LABEL[e.from_stage ?? ""] ?? e.from_stage} to ${LABEL[e.to_stage ?? ""] ?? e.to_stage}`
                        : e.type === "submitted" ? (e.body || "Application submitted") : e.type === "email" ? `Emailed ${first}: ${LABEL[e.to_stage ?? ""] ?? e.to_stage}` : e.type === "email_failed" ? `Email to ${first} failed: ${LABEL[e.to_stage ?? ""] ?? e.to_stage}` : e.body}</p>}
                    {e.type === "email_failed" && e.to_stage === open.stage && e.id === lastMail?.id && (
                      <button className="sd-btn" disabled={saving} onClick={onResend}>Resend email</button>
                    )}
                  </li>
                ))}
              </ul>
            </>)}
          </div>
        </section>
      </div>
    </div>
  );
}
