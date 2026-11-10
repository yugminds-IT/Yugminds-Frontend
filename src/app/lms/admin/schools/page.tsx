"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, KeyRound, Pencil, Plus, Power, RefreshCw, Search, Trash2 } from "lucide-react";
import AddSchoolDialog from "@/components/AddSchoolDialog";
import JoiningCodesDialog from "@/components/JoiningCodesDialog";
import ConfirmModal from "@/components/portal/ConfirmModal";
import RowMenu from "@/components/portal/RowMenu";
import { Pager, initialsOf } from "@/components/portal/notifications";
import SchoolRun from "@/components/admin/schools/SchoolRun";
import {
  STAGE_LABEL,
  mapApiSchoolToSchool,
  missingOf,
  placeOf,
  stageOf,
  type School,
  type Stage,
} from "@/components/admin/schools/utils";
import { adminApi, setAuthToken } from "@/lib/api";
import { getSession } from "@/lib/session-utils";
import { useAdminSchools, useInvalidateAdminSchools } from "@/hooks/useAdminSchools";
import { toast } from "@/components/ui/toast";
import "@/components/school-admin/overview.css"; // hero meta
import "@/components/teacher/overview/overview.css"; // track
import "@/components/admin/schools/schools.css";

export type { JoinCodeItem } from "@/components/admin/schools/utils";

const PAGE_SIZE = 15;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
type Sort = "name" | "newest" | "students" | "setup";
const SORTS: [Sort, string][] = [
  ["name", "Name, A to Z"],
  ["newest", "Newest first"],
  ["students", "Most students"],
  ["setup", "Needs setup first"],
];
const SETUP_ORDER: Record<Stage, number> = { setup: 0, off: 1, ready: 2 };

export default function SchoolsManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [codes, setCodes] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<School | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState<School[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toggling, setToggling] = useState<School | null>(null);

  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<Stage | null>(null);
  const [sort, setSort] = useState<Sort>("name");
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const { schools: rawSchools, data: schoolsData, isLoading, error, refetch } = useAdminSchools();
  const invalidateSchools = useInvalidateAdminSchools();

  // ?action=add comes from the dashboard's "Add school" button
  useEffect(() => {
    if (searchParams.get("action") === "add") {
      setAddOpen(true);
      router.replace("/lms/admin/schools");
    }
  }, [searchParams, router]);

  const schools = useMemo(() => (rawSchools ?? []).map((item) => mapApiSchoolToSchool(item as Record<string, unknown>)), [rawSchools]);

  // The backend caps one list response, so say so rather than show a short list as if it were complete.
  useEffect(() => {
    const total = schoolsData?.total;
    if (typeof total === "number" && total > rawSchools.length) {
      toast.error(`Showing ${rawSchools.length} of ${total} schools. The list is capped, so ask engineering to raise the limit.`);
    }
  }, [schoolsData?.total, rawSchools.length]);

  // Mutations need the token even when the list came from cache and its query never ran
  useEffect(() => {
    let mounted = true;
    getSession().then(({ data }) => {
      if (mounted && data?.session?.access_token) setAuthToken(data.session.access_token);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (error && typeof (error as Error)?.message === "string" && (error as Error).message.includes("Not authenticated")) {
      router.push("/lms/login");
    }
  }, [error, router]);

  const counts = useMemo(() => {
    const c: Record<Stage, number> = { ready: 0, setup: 0, off: 0 };
    for (const s of schools) c[stageOf(s)] += 1;
    return c;
  }, [schools]);
  const teacherTotal = schools.reduce((n, s) => n + (s.teacher_count ?? 0), 0);
  const studentTotal = schools.reduce((n, s) => n + (s.student_count ?? 0), 0);
  const codeTotal = schools.reduce((n, s) => n + (s.join_code_count ?? 0), 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = schools.filter((s) => {
      if (stage && stageOf(s) !== stage) return false;
      if (!q) return true;
      return [s.name, s.school_code, s.contact_email, s.contact_phone, s.school_admin_name, s.school_admin_email, s.city, s.state, s.address]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
    });
    return list.sort((a, b) => {
      if (sort === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sort === "students") return (b.student_count ?? 0) - (a.student_count ?? 0) || a.name.localeCompare(b.name);
      if (sort === "setup") return SETUP_ORDER[stageOf(a)] - SETUP_ORDER[stageOf(b)] || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  }, [schools, search, stage, sort]);

  const hasFilters = !!search.trim() || stage !== null;
  const lastPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
  const at = Math.min(page, lastPage);
  const visible = filtered.slice(at * PAGE_SIZE, at * PAGE_SIZE + PAGE_SIZE);
  const selected = schools.filter((s) => picked.has(s.id));
  const allOnPage = visible.length > 0 && visible.every((s) => picked.has(s.id));

  const clearFilters = () => { setSearch(""); setStage(null); setPage(0); };
  const pickStage = (s: Stage) => { setStage((cur) => (cur === s ? null : s)); setPage(0); };
  const toggleOne = (id: string) =>
    setPicked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const togglePage = () =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (allOnPage) visible.forEach((s) => next.delete(s.id));
      else visible.forEach((s) => next.add(s.id));
      return next;
    });

  const confirmToggle = async () => {
    if (!toggling) return;
    const s = toggling;
    try {
      setBusyId(s.id);
      await adminApi.schools.update(s.id, { is_active: !s.is_active });
      await invalidateSchools();
      toast.success(s.is_active ? `${s.name} is now inactive.` : `${s.name} is active again.`);
      setToggling(null);
    } catch (e) {
      console.error("Error updating school status:", e);
      toast.error("Could not update the school. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const s = deleting;
    try {
      setBusyId(s.id);
      await adminApi.schools.delete(s.id);
      await invalidateSchools();
      toast.success(`${s.name} was deleted.`);
      setDeleting(null);
    } catch (e) {
      console.error("Error deleting school:", e);
      toast.error("Could not delete the school. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmBulkDelete = async () => {
    if (!bulkDeleting?.length || bulkBusy) return;
    setBulkBusy(true);
    try {
      const targets = bulkDeleting;
      const results = await Promise.allSettled(targets.map((t) => adminApi.schools.delete(t.id)));
      const ok: string[] = [];
      const failed: string[] = [];
      results.forEach((r, i) => (r.status === "fulfilled" ? ok.push(targets[i].id) : failed.push(targets[i].name || targets[i].id)));
      if (ok.length > 0) {
        toast.success(`Deleted ${plural(ok.length, "school")}.`);
        setPicked((prev) => { const next = new Set(prev); ok.forEach((id) => next.delete(id)); return next; });
        await invalidateSchools();
      }
      if (failed.length > 0) {
        toast.error(`Could not delete ${plural(failed.length, "school")}: ${failed.slice(0, 5).join(", ")}${failed.length > 5 ? "…" : ""}`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Bulk delete failed unexpectedly.");
    } finally {
      setBulkBusy(false);
      setBulkDeleting(null);
    }
  };

  /* ───────── copy ───────── */
  const needSetup = counts.setup;
  let status: React.ReactNode;
  if (error) status = "The schools did not load. Try again.";
  else if (isLoading) status = "Loading schools…";
  else if (schools.length === 0) status = "No schools yet. Add the first one to get started.";
  else if (hasFilters) status = <><strong>{filtered.length} of {plural(schools.length, "school")}</strong> match your filters.</>;
  else if (needSetup > 0) status = <><strong>{plural(needSetup, "school")}</strong> {needSetup === 1 ? "needs" : "need"} a school admin or joining codes before students can join.</>;
  else status = <><strong>{plural(schools.length, "school")}</strong>, all set up.</>;

  const runCaption = isLoading
    ? "Loading…"
    : needSetup > 0
      ? `${plural(needSetup, "school")} still to set up`
      : schools.length > 0 ? "Every active school is ready" : "Nothing to show yet";

  const rowItems = (s: School) => [
    { label: "Open school", icon: Eye, onClick: () => router.push(`/lms/admin/schools/${s.id}`) },
    { label: "Joining codes", icon: KeyRound, onClick: () => setCodes({ id: s.id, name: s.name }) },
    { label: "Edit details", icon: Pencil, onClick: () => setEditingId(s.id) },
    { label: s.is_active ? "Make inactive" : "Make active", icon: Power, onClick: () => setToggling(s), separatorBefore: true },
    { label: "Delete school", icon: Trash2, onClick: () => setDeleting(s), danger: true },
  ];

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="sc-title">
        <div className="sd-hero-copy">
          <h1 id="sc-title" className="mc-hero-title">Schools</h1>
          <p className="sd-where">Every school on the platform</p>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            <button className="sd-btn sd-btn--amber" onClick={() => setAddOpen(true)}><Plus aria-hidden="true" />Add school</button>
            {needSetup > 0 && stage !== "setup" && (
              <button className="sd-btn sd-btn--ghost-dark" onClick={() => pickStage("setup")}>Show {needSetup} to set up</button>
            )}
          </div>
          <div className="so-meta">
            <button className="so-refresh" onClick={() => void refetch()} aria-label="Refresh" title="Refresh">
              <RefreshCw aria-hidden="true" />
            </button>
          </div>
        </div>
        {isLoading ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : (
          <SchoolRun counts={counts} selected={stage} onSelect={pickStage} caption={runCaption} />
        )}
      </section>

      <div className="sd-ledger" role="group" aria-label="Platform totals">
        <div><span className="sd-l">Schools</span>{isLoading ? <span className="sd-skel" style={{ height: "2.2rem", width: "4rem" }} /> : <b className="sd-n">{error ? "–" : schools.length}</b>}<small>{error ? "Not loaded" : `${counts.ready} ready to use`}</small></div>
        <div><span className="sd-l">Teachers</span>{isLoading ? <span className="sd-skel" style={{ height: "2.2rem", width: "4rem" }} /> : <b className="sd-n">{error ? "–" : teacherTotal.toLocaleString("en-IN")}</b>}<small>across all schools</small></div>
        <div><span className="sd-l">Students</span>{isLoading ? <span className="sd-skel" style={{ height: "2.2rem", width: "4rem" }} /> : <b className="sd-n">{error ? "–" : studentTotal.toLocaleString("en-IN")}</b>}<small>across all schools</small></div>
        <div><span className="sd-l">Joining codes</span>{isLoading ? <span className="sd-skel" style={{ height: "2.2rem", width: "4rem" }} /> : <b className="sd-n">{error ? "–" : codeTotal.toLocaleString("en-IN")}</b>}<small>handed out so far</small></div>
      </div>

      {schools.length > 0 && <div className="sc-bar">
        <div className="sd-search" style={{ flex: "1 1 18rem", maxWidth: "30rem", width: "auto" }}>
          <Search aria-hidden="true" />
          <input
            type="search"
            placeholder="Search by name, code, admin, email or city"
            aria-label="Search schools"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <select className="sd-field" aria-label="Sort schools" value={sort} onChange={(e) => { setSort(e.target.value as Sort); setPage(0); }}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {stage && <span className="sc-chip" data-s={stage}>{STAGE_LABEL[stage]}</span>}
        {hasFilters && <button className="sd-btn sd-btn--line" onClick={clearFilters}>Clear filters</button>}
      </div>}

      {isLoading ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : error ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>We could not load the schools</b>
            <p>Check your connection, then try again.</p>
            <button className="sd-btn sd-btn--amber" onClick={() => void refetch()}>Try again</button>
          </div>
        </section>
      ) : filtered.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>{schools.length === 0 ? "No schools yet" : "No schools match"}</b>
            <p>{schools.length === 0 ? "Add a school, then give it a school admin and joining codes so teachers and students can sign up." : "Try a different search, or clear the filters."}</p>
            {schools.length === 0
              ? <button className="sd-btn sd-btn--amber" onClick={() => setAddOpen(true)}><Plus aria-hidden="true" />Add school</button>
              : <button className="sd-btn sd-btn--line" onClick={clearFilters}>Clear filters</button>}
          </div>
        </section>
      ) : (
        <section className="sd-panel sc-list mc-swap" aria-label="Schools">
          <div className="sc-head">
            <input type="checkbox" className="sc-check" aria-label="Select every school on this page" checked={allOnPage} onChange={togglePage} />
            <span />
            <span>School</span>
            <span>School admin</span>
            <span>People</span>
            <span>Status</span>
            <span />
          </div>
          {visible.map((s) => {
            const st = stageOf(s);
            const missing = missingOf(s);
            const place = placeOf(s);
            return (
              <div key={s.id} className="sc-row" data-picked={picked.has(s.id)} data-off={st === "off"}>
                <input type="checkbox" className="sc-check" aria-label={`Select ${s.name}`} checked={picked.has(s.id)} onChange={() => toggleOne(s.id)} />
                <span className="sc-logo" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {s.logo_url ? <img src={s.logo_url} alt="" /> : initialsOf(s.name)}
                </span>
                <Link href={`/lms/admin/schools/${s.id}`} className="sc-name">
                  <b>{s.name}</b>
                  <small>{[s.school_code, place].filter(Boolean).join(" · ") || "No location yet"}</small>
                </Link>
                <span className="sc-admin">
                  {s.school_admin_name || s.school_admin_email ? (
                    <>
                      <b>{s.school_admin_name || s.school_admin_email}</b>
                      {s.school_admin_name && s.school_admin_email && <small>{s.school_admin_email}</small>}
                    </>
                  ) : (
                    <span className="sc-chip" data-s="none">No school admin</span>
                  )}
                </span>
                <span className="sc-people">
                  <b>{plural(s.student_count ?? 0, "student")}</b>
                  <small>{plural(s.teacher_count ?? 0, "teacher")}, {plural(s.join_code_count ?? 0, "code")}</small>
                </span>
                <span className="sc-chips"><span className="sc-chip" data-s={st}>{STAGE_LABEL[st]}</span></span>
                <span className="sc-menu">
                  {busyId === s.id ? <span className="sd-skel" style={{ width: "1.5rem", height: "1.5rem", borderRadius: "50%" }} /> : <RowMenu label={`Actions for ${s.name}`} items={rowItems(s)} />}
                </span>
                {st === "setup" && missing.length > 0 && (
                  <p className="sc-need">Still needs <b>{missing.join(" and ")}</b>.</p>
                )}
              </div>
            );
          })}
          <Pager
            offset={at * PAGE_SIZE}
            count={visible.length}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            noun="schools"
            onPrev={() => setPage(Math.max(0, at - 1))}
            onNext={() => setPage(at + 1)}
          />
        </section>
      )}

      {selected.length > 0 && (
        <div className="sc-selbar" role="region" aria-label="Selected schools">
          <b>{plural(selected.length, "school")} selected</b>
          <div>
            <button className="sd-btn sd-btn--line" onClick={() => setPicked(new Set())}>Clear</button>
            <button className="sd-btn sd-btn--danger" onClick={() => setBulkDeleting(selected)}><Trash2 aria-hidden="true" />Delete</button>
          </div>
        </div>
      )}

      <AddSchoolDialog isOpen={addOpen} onClose={() => setAddOpen(false)} onSuccess={() => { void invalidateSchools(); }} />
      <AddSchoolDialog
        isOpen={editingId !== null}
        editingSchoolId={editingId}
        onClose={() => setEditingId(null)}
        onSuccess={() => { void invalidateSchools(); }}
      />
      <JoiningCodesDialog isOpen={codes !== null} onClose={() => setCodes(null)} schoolId={codes?.id ?? ""} schoolName={codes?.name ?? ""} />

      <ConfirmModal
        open={toggling !== null}
        onClose={() => setToggling(null)}
        title={toggling?.is_active ? "Make this school inactive?" : "Make this school active?"}
        subtitle={toggling?.name}
        confirmLabel={toggling?.is_active ? "Make inactive" : "Make active"}
        busy={busyId !== null && busyId === toggling?.id}
        onConfirm={() => void confirmToggle()}
      >
        <p>{toggling?.is_active ? "People at this school will not be able to sign in until you make it active again. Nothing is deleted." : "People at this school will be able to sign in again."}</p>
      </ConfirmModal>

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this school?"
        subtitle={deleting?.name}
        confirmLabel="Delete school"
        danger
        busy={busyId !== null && busyId === deleting?.id}
        onConfirm={() => void confirmDelete()}
      >
        <p>This cannot be undone. The school admins, teachers and students of this school are removed with it. Course content is kept, but links to the school may be cleared.</p>
      </ConfirmModal>

      <ConfirmModal
        open={bulkDeleting !== null}
        onClose={() => setBulkDeleting(null)}
        title={`Delete ${plural(bulkDeleting?.length ?? 0, "school")}?`}
        confirmLabel="Delete schools"
        danger
        busy={bulkBusy}
        onConfirm={() => void confirmBulkDelete()}
      >
        <p>This cannot be undone. Their school admins, teachers and students may be removed too, according to server policy.</p>
        <ul className="sc-list-names">
          {(bulkDeleting ?? []).slice(0, 20).map((t) => <li key={t.id}>{t.name}</li>)}
          {(bulkDeleting?.length ?? 0) > 20 && <li style={{ listStyle: "none" }}>…and {(bulkDeleting?.length ?? 0) - 20} more</li>}
        </ul>
      </ConfirmModal>
    </div>
  );
}
