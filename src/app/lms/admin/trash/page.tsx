"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, Trash2, Undo2 } from "lucide-react";
import ConfirmModal from "@/components/portal/ConfirmModal";
import { Pager } from "@/components/portal/notifications";
import AgeRun from "@/components/admin/trash/AgeRun";
import TrashList from "@/components/admin/trash/TrashList";
import { KINDS, NOTE, ageOf, plural, type Age, type Kind, type TrashItem } from "@/components/admin/trash/utils";
import { adminApi } from "@/lib/api/admin.api";
import { toast } from "@/components/ui/toast";
import "@/components/school-admin/overview.css"; // hero meta
import "@/components/teacher/overview/overview.css"; // track
import "@/components/school-admin/students.css"; // sm- chips and forms
import "@/components/school-admin/teachers.css"; // tm- track nodes
import "@/components/admin/trash/trash.css";

type TrashData = Record<Kind, TrashItem[]>;
const EMPTY: TrashData = { teachers: [], courses: [] };
const PAGE_SIZE = 50;

// Students and schools are deleted at once and for good everywhere else in the admin area (the backend never
// sets deletedAt for them), so they can never be in the trash and are not shown. Only teachers and courses are.

export default function TrashPage() {
  const [data, setData] = useState<TrashData>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const [tab, setTab] = useState<Kind | null>(null);
  const [age, setAge] = useState<Age | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<{ kind: Kind; items: TrashItem[] } | null>(null);
  const [purging, setPurging] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await adminApi.trash.list();
      const p = (res.data ?? {}) as Partial<TrashData>;
      setData({ teachers: p.teachers ?? [], courses: p.courses ?? [] });
      setNow(Date.now());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setRefreshing(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Open on whichever tab has something in it.
  const kind: Kind = tab ?? (data.teachers.length === 0 && data.courses.length > 0 ? "courses" : "teachers");
  const meta = KINDS.find((k) => k.key === kind)!;
  const all = data[kind];
  const totalCount = data.teachers.length + data.courses.length;

  const counts = useMemo(() => {
    const c: Record<Age, number> = { today: 0, week: 0, month: 0, older: 0 };
    for (const i of all) c[ageOf(i.deleted_at, now)] += 1;
    return c;
  }, [all, now]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((i) => (!age || ageOf(i.deleted_at, now) === age) && (!q || i.name.toLowerCase().includes(q) || i.detail.toLowerCase().includes(q)));
  }, [all, age, search, now]);

  const lastPage = Math.max(0, Math.ceil(shown.length / PAGE_SIZE) - 1);
  const at = Math.min(page, lastPage);
  const pageRows = shown.slice(at * PAGE_SIZE, (at + 1) * PAGE_SIZE);
  const selectedItems = all.filter((i) => picked.has(i.id));
  const allPicked = pageRows.length > 0 && pageRows.every((i) => picked.has(i.id));

  const pickTab = (k: Kind) => { setTab(k); setAge(null); setSearch(""); setPage(0); setPicked(new Set()); };
  const pickAge = (a: Age | null) => { setAge(a); setPage(0); setPicked(new Set()); };
  const toggle = (id: string) => setPicked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const togglePage = () => setPicked((prev) => { const n = new Set(prev); for (const i of pageRows) { if (allPicked) n.delete(i.id); else n.add(i.id); } return n; });

  /** Runs `action` for each item and returns the names that failed. */
  const runEach = async (items: TrashItem[], action: (i: TrashItem) => Promise<unknown>) => {
    const results = await Promise.allSettled(items.map(action));
    return items.filter((_, i) => results[i].status === "rejected").map((i) => i.name);
  };
  const failure = (verb: string, failed: string[]) => {
    const preview = failed.slice(0, 3).map((n) => `"${n}"`).join(", ");
    setError(`We could not ${verb} ${preview}${failed.length > 3 ? ` and ${failed.length - 3} more` : ""}. Try again.`);
  };

  const restore = async (k: Kind, items: TrashItem[]) => {
    if (items.length === 1) setBusyId(items[0].id);
    else setBusy(true);
    setError(null);
    const failed = await runEach(items, (i) => adminApi.trash.restore(k, i.id));
    await load();
    const word = KINDS.find((x) => x.key === k)!;
    const done = items.length - failed.length;
    if (done > 0) toast.success(`Restored ${plural(done, word.one)}`);
    if (failed.length) failure("restore", failed);
    setPicked(new Set());
    setBusyId(null);
    setBusy(false);
  };

  const purge = async () => {
    if (!purgeTarget) return;
    setPurging(true);
    setError(null);
    const { kind: k, items } = purgeTarget;
    const failed = await runEach(items, (i) => adminApi.trash.purge(k, i.id));
    setPurgeTarget(null);
    await load();
    const done = items.length - failed.length;
    if (done > 0) toast.success(`Deleted ${plural(done, KINDS.find((x) => x.key === k)!.one)} forever`);
    if (failed.length) failure("delete", failed);
    setPicked(new Set());
    setPurging(false);
  };

  const first = !loaded;
  const dash = loadFailed && totalCount === 0;
  const week = counts.today + counts.week;

  let statusLine: React.ReactNode;
  if (dash) statusLine = "The trash did not load. Try refreshing.";
  else if (first) statusLine = "Checking the trash…";
  else if (totalCount === 0) statusLine = <><strong>The trash is empty.</strong> Deleted teachers and courses wait here.</>;
  else statusLine = <><strong>{plural(totalCount, "item")}</strong> can be restored.{counts.older > 0 && <> {counts.older} {meta.key === "teachers" ? "teacher" : "course"}{counts.older === 1 ? " has" : "s have"} been here over a month.</>}</>;

  const runCaption = first ? "Loading…" : week > 0 ? `${week} deleted this week` : all.length > 0 ? "Nothing recent" : `No ${meta.many}`;
  const purgeCount = purgeTarget?.items.length ?? 0;
  const purgeWord = purgeTarget ? KINDS.find((k) => k.key === purgeTarget.kind)! : meta;

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="tr-title">
        <div className="sd-hero-copy">
          <h1 id="tr-title" className="mc-hero-title">Trash</h1>
          <p className="sd-where">Deleted teachers and courses</p>
          <p className="sd-status">{statusLine}</p>
          <div className="so-meta">
            <button className="so-refresh" onClick={() => void load()} disabled={refreshing} aria-label={refreshing ? "Refreshing" : "Refresh"} title="Refresh">
              <RefreshCw className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
            </button>
          </div>
        </div>
        {first ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : (
          <AgeRun counts={counts} selected={age} onSelect={pickAge} caption={runCaption} noun={meta.many} />
        )}
      </section>

      <div className="sd-ledger" role="group" aria-label="Trash numbers">
        <button type="button" aria-pressed={kind === "teachers"} onClick={() => pickTab("teachers")}>
          <span className="sd-l">Teachers</span><b className="sd-n">{dash || first ? "–" : data.teachers.length}</b><small>{dash ? "Not loaded" : first ? " " : data.teachers.length > 0 ? "Tap to see them" : "None deleted"}</small>
        </button>
        <button type="button" aria-pressed={kind === "courses"} onClick={() => pickTab("courses")}>
          <span className="sd-l">Courses</span><b className="sd-n">{dash || first ? "–" : data.courses.length}</b><small>{dash ? "Not loaded" : first ? " " : data.courses.length > 0 ? "Tap to see them" : "None deleted"}</small>
        </button>
        <button type="button" aria-pressed={age === "today" || age === "week"} onClick={() => pickAge(age === "week" ? null : "week")}>
          <span className="sd-l">Deleted this week</span><b className="sd-n">{dash || first ? "–" : week}</b><small>{dash ? "Not loaded" : first ? " " : `Among ${meta.many}`}</small>
        </button>
      </div>

      {error && (
        <div className="tr-error" role="alert">
          {error}
          <button className="sd-btn sd-btn--line" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="mc-tabs" role="tablist" aria-label="What was deleted" style={{ justifySelf: "start" }}>
        {KINDS.map((k) => (
          <button key={k.key} role="tab" className="mc-tab" aria-selected={kind === k.key} onClick={() => pickTab(k.key)}>{k.label}{loaded && !loadFailed && <b>{data[k.key].length}</b>}</button>
        ))}
      </div>
      <p className="tr-note">{NOTE[kind]}</p>

      {all.length > 6 && (
        <div className="tr-bar">
          <div className="sd-search" style={{ flex: "1 1 16rem", maxWidth: "26rem", width: "auto" }}>
            <Search aria-hidden="true" />
            <input type="search" placeholder={`Search deleted ${meta.many}`} aria-label={`Search deleted ${meta.many}`} value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          </div>
          {(search || age) && <button className="sd-btn sd-btn--line" onClick={() => { setSearch(""); pickAge(null); }}>Clear filters</button>}
        </div>
      )}

      {first ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : dash ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>We could not load the trash</b>
            <p>Check your connection, then try again.</p>
            <button className="sd-btn sd-btn--amber" onClick={() => void load()}>Try again</button>
          </div>
        </section>
      ) : all.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>No deleted {meta.many}</b>
            <p>{totalCount === 0 ? "When you delete a teacher or a course it waits here, and you can restore it." : `Nothing deleted here. ${kind === "teachers" ? "Courses" : "Teachers"} in the trash are on the other tab.`}</p>
            {totalCount > 0 && <button className="sd-btn sd-btn--line" onClick={() => pickTab(kind === "teachers" ? "courses" : "teachers")}>Show {kind === "teachers" ? "courses" : "teachers"}</button>}
          </div>
        </section>
      ) : shown.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>Nothing matches</b>
            <p>Try a different search, or show everything again.</p>
            <button className="sd-btn sd-btn--line" onClick={() => { setSearch(""); pickAge(null); }}>Clear filters</button>
          </div>
        </section>
      ) : (
        <>
          <TrashList kind={kind} rows={pageRows} now={now} picked={picked} onPick={toggle} onPickAll={togglePage} allPicked={allPicked} busyId={busyId} onRestore={(i) => void restore(kind, [i])} onPurge={(i) => setPurgeTarget({ kind, items: [i] })} />
          <Pager offset={at * PAGE_SIZE} count={pageRows.length} total={shown.length} pageSize={PAGE_SIZE} noun={meta.many} onPrev={() => setPage(Math.max(0, at - 1))} onNext={() => setPage(at + 1)} />
        </>
      )}

      <p className="tr-fine">Students and schools are deleted at once and cannot be recovered, so they never appear here.</p>

      {selectedItems.length > 0 && (
        <div className="tr-selbar" role="region" aria-label="Selected items">
          <b>{plural(selectedItems.length, meta.one)} selected</b>
          <div>
            <button className="sd-btn sd-btn--line" onClick={() => setPicked(new Set())} disabled={busy}>Clear</button>
            <button className="sd-btn sd-btn--amber" onClick={() => void restore(kind, selectedItems)} disabled={busy}><Undo2 aria-hidden="true" />Restore</button>
            <button className="sd-btn sd-btn--danger" onClick={() => setPurgeTarget({ kind, items: selectedItems })} disabled={busy}><Trash2 aria-hidden="true" />Delete forever</button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!purgeTarget}
        onClose={() => { if (!purging) setPurgeTarget(null); }}
        title={purgeCount === 1 ? "Delete this forever?" : `Delete ${purgeCount} ${purgeWord.many} forever?`}
        subtitle={purgeCount === 1 ? purgeTarget?.items[0].name : undefined}
        confirmLabel={purgeCount > 1 ? `Delete ${purgeCount} forever` : "Delete forever"}
        danger
        busy={purging}
        onConfirm={() => void purge()}
      >
        <p style={{ margin: 0 }}>
          {purgeCount === 1 ? "This removes it" : "This removes them"} and all {purgeCount === 1 ? "its" : "their"} related data for good. It cannot be undone.
        </p>
        {purgeCount > 1 && (
          <ul className="tr-names">
            {purgeTarget?.items.map((i) => <li key={i.id}>{i.name}</li>)}
          </ul>
        )}
      </ConfirmModal>
    </div>
  );
}
