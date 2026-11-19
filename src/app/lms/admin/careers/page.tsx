"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Eye, HelpCircle, RefreshCw, Search, Star, Trash2, X } from "lucide-react";
import ConfirmModal from "@/components/portal/ConfirmModal";
import StageDialog, { STAGE_COLOR, MAILED } from "./StageDialog";
import { ChipGroup, Pager } from "@/components/portal/notifications";
import RowMenu from "@/components/portal/RowMenu";
import "./careers.css";
import OpeningsPanel, { type Opening } from "./OpeningsPanel";
import CandidateView, { STAGES, LABEL, PIPE, day, type Row, type Detail } from "./CandidateView";
import { adminApi } from "@/lib/api/admin.api";
import { toast } from "@/components/ui/toast";
import "@/components/school-admin/overview.css"; // hero meta
import "@/components/school-admin/students.css"; // sm- chips and forms

const LIMIT = 20;

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
  const [city, setCity] = useState("");
  const [sort, setSort] = useState("newest");
  const [cities, setCities] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<Detail | null>(null);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const [message, setMessage] = useState("");
  const [resend, setResend] = useState(false);
  const [del, setDel] = useState(false);
  const [rowDel, setRowDel] = useState<Row | null>(null);
  const [fromRow, setFromRow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.careers.list({ stage, page, limit: LIMIT, search: search || undefined, opening: roleId || undefined, city: city || undefined, sort });
      setRows(data.applications);
      setTotal(data.total);
      setCounts(data.stage_counts);
      setCities(data.cities ?? []);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [stage, page, search, roleId, city, sort]);
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
      setFromRow(false);
      setPending(null);
    } catch {
      toast.error("Could not open this application.");
    }
  }

  function closeModal() {
    if (fromRow) { setOpen(null); setFromRow(false); }
    setPending(null); setMessage(""); setResend(false);
  }

  async function act(data: { stage?: string; rating?: number | null; note?: string; notify?: boolean; message?: string }, done: string) {
    if (!open) return;
    setSaving(true);
    try {
      const res = resend ? await adminApi.careers.resendEmail(open.id, { message: data.message }) : await adminApi.careers.update(open.id, data);
      if (!data.notify) toast.success(done);
      else if (res.data?.emailed) toast.success(resend ? "Email sent." : `${done}. Email sent.`);
      else if (res.data?.reason === "not_configured") toast.error(`${done}, but mail is not set up on the server.`);
      else toast.error(`${done}, but the email failed. Use Resend in Notes and history.`);
      const [fresh] = await Promise.all([adminApi.careers.get(open.id), load()]);
      if (fromRow) { setOpen(null); setFromRow(false); } else setOpen(fresh.data);
      closeModal();
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "That did not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  /** Row buttons use the same dialog as the application page: email choice, preview, required interview details. */
  async function decide(r: Row, to: string) {
    try {
      const { data } = await adminApi.careers.get(r.id);
      setOpen(data);
      setFromRow(true);
      setNotify(true); setMessage(""); setResend(false);
      setPending(to);
    } catch { toast.error("Could not open this application."); }
  }

  async function purge() {
    const t = rowDel ?? open;
    if (!t) return;
    setSaving(true);
    try {
      await adminApi.careers.purge(t.id);
      toast.success("Application deleted.");
      setDel(false);
      setRowDel(null);
      setOpen(null);
      await load();
    } catch {
      toast.error("Could not delete this application.");
    } finally {
      setSaving(false);
    }
  }

  const total_all = Object.values(counts).reduce((a, b) => a + b, 0);
  const role = openings.find((o) => o.id === roleId);
  const reset = () => { setRoleId(""); setStage("all"); setCity(""); setSort("newest"); setSearchInput(""); setPage(1); };
  const nextStage = (st: string) => PIPE[PIPE.indexOf(st as (typeof PIPE)[number]) + 1];
  const ago = (iso?: string) => { const d = iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 864e5) : 0; return d < 1 ? "today" : `${d} ${d === 1 ? "day" : "days"} ago`; };

  return (
    <div className="sd-page">
      {(!open || fromRow) && (<>
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
        <OpeningsPanel openings={openings} loading={opLoading} failed={opFailed} onChanged={() => { void loadOpenings(); void load(); }} onViewApplicants={(id, st) => { setRoleId(id); setStage(st); setPage(1); setTab("applications"); }} />
      ) : (<>
      <div className="cr">
      {roleId && (
        <div className="cr-role">
          <button onClick={() => { setRoleId(""); setPage(1); }} className="cr-link inline-flex items-center gap-1.5"><ArrowLeft className="h-4 w-4" aria-hidden="true" />All openings</button>
          <h2>{role?.title ?? "Role"}</h2>
          <p className="cr-muted">{role?.location}</p>
        </div>
      )}

      <nav aria-label="Stage" className="cr-tabs">
        {(["all", ...STAGES] as const).map((s) => {
          const n = s === "all" ? total_all : counts[s] ?? 0;
          return (
            <button key={s} className="cr-tab" onClick={() => { setStage(s); setPage(1); }} aria-current={stage === s ? "true" : undefined} data-hot={s === "new" && n > 0}>
              {s === "all" ? "All applications" : LABEL[s]}<span>{n}</span>
            </button>
          );
        })}
      </nav>

      <div className="cr-filters">
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label="Sort by" className="sd-field">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        <select value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }} aria-label="Location" className="sd-field">
          <option value="">All locations</option>
          {cities.map((c) => <option key={c}>{c}</option>)}
        </select>
        {openings.length > 0 && (
          <select value={roleId} onChange={(e) => { setRoleId(e.target.value); setCity(""); setPage(1); }} aria-label="Filter by role" className="sd-field">
            <option value="">All roles</option>
            {openings.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
        )}
        <label className="cr-search">
          <Search aria-hidden="true" />
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search name, email, phone" aria-label="Search applications" className="sd-field" />
        </label>
        <button className="cr-link" onClick={reset} disabled={stage === "all" && !city && !roleId && !searchInput && sort === "newest"}>Clear filters</button>
        <span className="cr-count" aria-live="polite">{total} {total === 1 ? "candidate" : "candidates"}</span>
      </div>

      {failed ? (
        <div className="cr-empty" role="alert"><b>Could not load applications</b><p>Check your connection and try again.</p><button className="sd-btn sd-btn--ink" onClick={() => void load()}>Try again</button></div>
      ) : loading && rows.length === 0 ? (
        <div className="cr-list" aria-hidden="true"><div className="cr-skel" /><div className="cr-skel" /><div className="cr-skel" /></div>
      ) : rows.length === 0 ? (
        <div className="cr-empty">
          <b>{search || city || stage !== "all" ? "No candidates match" : "No applications yet"}</b>
          <p>{search || city || stage !== "all" ? "Try another stage, location or search." : "They appear here when someone applies on yugminds.org/careers."}</p>
        </div>
      ) : (
        <div className="cr-list">
          <div className="cr-head cr-cd-head"><span>Candidate</span><span>Matches the role</span><span>Stage</span><span>Your call</span></div>
          {rows.map((r) => {
            const nxt = nextStage(r.stage);
            const tags = [
              r.english_level != null && r.english_level >= 3 && `English ${r.english_level} of 5`,
              r.has_two_wheeler && "Two-wheeler",
              r.will_travel && "Can travel",
              ...(r.skills ?? []).slice(0, 2),
            ].filter(Boolean) as string[];
            const initials = r.full_name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
            return (
              <div key={r.id} className="cr-row cr-cd" data-hot={r.stage === "new"}>
                <div className="cr-who">
                  <span className="sd-avatar" aria-hidden="true">{initials}</span>
                  <div className="cr-name">
                    <button onClick={() => void show(r.id)}>{r.full_name}</button>
                    <small>{r.city} · {r.experience_years} yr · {r.qualification}</small>
                    <small>Applied {day(r.created_at)}{!roleId && openings.length > 1 && r.role ? ` · ${r.role}` : ""}</small>
                  </div>
                </div>
                <div className="cr-match">
                  {tags.length ? tags.map((c) => <span key={c} className="cr-tag"><Check aria-hidden="true" />{c}</span>) : <span className="cr-muted">No matches noted</span>}
                </div>
                <div>
                  <span className="cr-stage" style={{ ["--c" as string]: STAGE_COLOR[r.stage] }}>{LABEL[r.stage] ?? r.stage}</span>
                  <p className="cr-stage-sub">Updated {ago(r.updated_at ?? r.created_at)}{r.rating ? <><Star aria-hidden="true" />{r.rating}</> : null}</p>
                </div>
                <div className="cr-act">
                  <div className="cr-judge" role="group" aria-label={`Decide on ${r.full_name}`}>
                    <button data-t="yes" disabled={!nxt} onClick={() => nxt && void decide(r, nxt)} aria-label={nxt ? `Move ${r.full_name} to ${LABEL[nxt]}` : "Already at the last step"} title={nxt ? `Move to ${LABEL[nxt]}` : ""}><Check aria-hidden="true" /></button>
                    <button data-t="hold" disabled={r.stage === "on_hold"} onClick={() => void decide(r, "on_hold")} aria-label={`Put ${r.full_name} on hold`} title="Put on hold"><HelpCircle aria-hidden="true" /></button>
                    <button data-t="no" disabled={r.stage === "rejected"} onClick={() => void decide(r, "rejected")} aria-label={`Reject ${r.full_name}`} title="Reject"><X aria-hidden="true" /></button>
                  </div>
                  <RowMenu label={`Actions for ${r.full_name}`} items={[
                    { label: "View application", icon: Eye, onClick: () => void show(r.id) },
                    { label: "Delete", icon: Trash2, onClick: () => setRowDel(r), danger: true, separatorBefore: true },
                  ]} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

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
      </>)}
      {open && !fromRow && (
        <CandidateView
          key={open.id}
          open={open}
          rows={rows}
          saving={saving}
          onBack={() => { if (!saving) setOpen(null); }}
          onShow={(id) => void show(id)}
          onGo={(s) => { setPending(s); setNotify(true); setMessage(""); setResend(false); }}
          onResend={() => { setPending(open.stage); setNotify(true); setMessage(""); setResend(true); }}
          onAct={(d, done) => act(d, done)}
          onDelete={() => setDel(true)}
        />
      )}

      <StageDialog
        open={open}
        pending={pending}
        resend={resend}
        notify={notify}
        message={message}
        saving={saving}
        onNotify={setNotify}
        onMessage={setMessage}
        onClose={closeModal}
        onConfirm={() => pending && void act({ stage: pending, notify: MAILED.includes(pending) && (resend || notify), message: message.trim() || undefined }, `Moved to ${LABEL[pending]}`)}
      />


      <ConfirmModal
        open={del || !!rowDel}
        onClose={() => { setDel(false); setRowDel(null); }}
        title={(rowDel ?? open) ? `Delete ${(rowDel ?? open)!.full_name.split(" ")[0]}'s application?` : ""}
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
