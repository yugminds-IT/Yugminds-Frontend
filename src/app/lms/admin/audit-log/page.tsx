"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, RefreshCw, Search } from "lucide-react";
import { Pager, ago } from "@/components/portal/notifications";
import SavedViewsBar from "@/components/admin/SavedViewsBar";
import ActionRun from "@/components/admin/audit/ActionRun";
import AuditList from "@/components/admin/audit/AuditList";
import EntryModal from "@/components/admin/audit/EntryModal";
import SummaryPanel from "@/components/admin/audit/SummaryPanel";
import { ChipGroup } from "@/components/portal/notifications";
import { useAdminSchools } from "@/hooks/useAdminSchools";
import { ACTOR_ROLES, METHODS, NO_FILTERS, ROLE_LABEL, describe, plural, toParams, whoOf, type AuditLogRow, type AuditSummary, type Filters, type Method } from "@/components/admin/audit/utils";
import { adminApi } from "@/lib/api/admin.api";
import { toast } from "@/components/ui/toast";
import "@/components/school-admin/overview.css"; // hero meta
import "@/components/teacher/overview/overview.css"; // track
import "@/components/school-admin/students.css"; // sm- chips and forms
import "@/components/school-admin/teachers.css"; // tm- track nodes
import "@/components/admin/audit/audit.css";

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<Method, number>>({ POST: 0, PATCH: 0, PUT: 0, DELETE: 0 });
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [method, setMethod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [role, setRole] = useState("all");
  const [schoolId, setSchoolId] = useState("");
  const [actorId, setActorId] = useState("");
  const [attention, setAttention] = useState(false);
  const [summary, setSummary] = useState<AuditSummary>({ by_role: [], top_people: [] });
  const { schools: rawSchools } = useAdminSchools();
  const schools = useMemo(() => (rawSchools ?? []).map((x) => ({ id: String(x.id), name: x.name })).sort((a, b) => a.name.localeCompare(b.name)), [rawSchools]);

  const [detail, setDetail] = useState<AuditLogRow | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filters: Filters = useMemo(() => ({ search, entityType, method, from, to, role, schoolId, actorId, attention }), [search, entityType, method, from, to, role, schoolId, actorId, attention]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.auditLogs.list({ page, limit: window.matchMedia("(max-width: 767px)").matches ? 20 : 50, ...toParams(filters) });
      setLogs(data?.logs ?? []);
      setTotal(data?.total ?? 0);
      setLimit(data?.limit ?? 50);
      setNow(Date.now());
      setError(false);
      setLoaded(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  // How many entries each kind of change has under the other filters, so the track can show the split.
  useEffect(() => {
    const base = toParams({ ...filters, method: "all" });
    void Promise.allSettled(METHODS.map((m) => adminApi.auditLogs.list({ page: 1, limit: 1, ...base, method: m }))).then((rs) => {
      const next = { POST: 0, PATCH: 0, PUT: 0, DELETE: 0 } as Record<Method, number>;
      rs.forEach((r, i) => { if (r.status === "fulfilled") next[METHODS[i]] = (r.value.data as { total?: number })?.total ?? 0; });
      setCounts(next);
    });
  }, [filters]);

  // Who is behind the failures and deletions, under the same filters (the server leaves out the role and person so everyone shows).
  useEffect(() => {
    adminApi.auditLogs.summary(toParams(filters)).then(({ data }) => setSummary({ by_role: data?.by_role ?? [], top_people: data?.top_people ?? [] })).catch(() => {});
  }, [filters]);

  useEffect(() => {
    adminApi.auditLogs.entityTypes().then(({ data }) => setEntityTypes(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { data } = await adminApi.auditLogs.exportCsv(toParams(filters));
      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Saved the audit log");
    } catch {
      toast.error("We could not export the audit log. Try again.");
    } finally {
      setExporting(false);
    }
  };

  const hasFilters = !!(searchInput.trim() || entityType !== "all" || method !== "all" || from || to || role !== "all" || schoolId || actorId || attention);
  const clear = () => { setSearchInput(""); setSearch(""); setEntityType("all"); setMethod("all"); setFrom(""); setTo(""); setRole("all"); setSchoolId(""); setActorId(""); setAttention(false); setPage(1); };
  const personRow = logs.find((l) => String(l.actorId) === actorId);
  const personName = summary.top_people.find((p) => String(p.actor_id) === actorId)?.name ?? (personRow ? whoOf(personRow) : "one person");
  const failed = logs.filter((l) => !l.success).length;
  const latest = page === 1 ? logs[0] : undefined;
  const first = loading && !loaded;
  const dash = error && !loaded;

  let statusLine: React.ReactNode;
  if (dash) statusLine = "The log did not load. Try refreshing.";
  else if (first) statusLine = "Reading the log…";
  else if (total === 0 && !hasFilters) statusLine = <><strong>Nothing recorded yet.</strong> Changes made by anyone who signs in show up here.</>;
  else if (total === 0) statusLine = <><strong>No entries match</strong> these filters.</>;
  else statusLine = <><strong>{plural(total, "change")}</strong> {hasFilters ? "match these filters" : "recorded"}.{latest && <> The latest was “{describe(latest).headline}” by {whoOf(latest)}, {ago(latest.createdAt, now).toLowerCase()}.</>}</>;

  const runCaption = first ? "Loading…" : hasFilters ? "With your filters" : "Every kind of change";

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="aud-title">
        <div className="sd-hero-copy">
          <h1 id="aud-title" className="mc-hero-title">Audit log</h1>
          <p className="sd-where">Every change made by admins, school admins, teachers and students</p>
          <p className="sd-status">{statusLine}</p>
          <div className="sd-hero-actions">
            <button className="sd-btn sd-btn--amber" onClick={() => void exportCsv()} disabled={exporting || !loaded || total === 0}>
              {exporting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}Export CSV
            </button>
            <button className="so-refresh" style={{ alignSelf: "center" }} onClick={() => void fetchLogs()} disabled={loading} aria-label={loading ? "Refreshing" : "Refresh"} title="Refresh">
              <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
            </button>
          </div>
        </div>
        {first ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : (
          <ActionRun counts={counts} selected={method === "all" ? null : (method as Method)} onSelect={(m) => { setMethod(m ?? "all"); setPage(1); }} caption={runCaption} />
        )}
      </section>

      <div className="sd-ledger" role="group" aria-label="Audit numbers">
        <div>
          <span className="sd-l">Entries</span>
          {first ? <span className="sd-skel" style={{ height: "2.2rem", width: "4rem" }} /> : <b className="sd-n">{dash ? "–" : total.toLocaleString("en-IN")}</b>}
          <small>{hasFilters ? "With these filters" : "Since logging began"}</small>
        </div>
        <div>
          <span className="sd-l">Latest change</span>
          {first ? <span className="sd-skel" style={{ height: "2.2rem", width: "4rem" }} /> : <b className="sd-n">{latest ? ago(latest.createdAt, now) : "–"}</b>}
          <small>{latest ? `By ${whoOf(latest)}` : page === 1 ? "Nothing yet" : "Go to the first page"}</small>
        </div>
        <div className={failed > 0 ? "aud-hot" : undefined}>
          <span className="sd-l">Failed</span>
          {first ? <span className="sd-skel" style={{ height: "2.2rem", width: "4rem" }} /> : <b className="sd-n">{dash ? "–" : failed}</b>}
          <small>On this page</small>
        </div>
      </div>

      <div className="aud-bar">
        <div className="sd-search" style={{ flex: "1 1 16rem", maxWidth: "26rem", width: "auto" }}>
          <Search aria-hidden="true" />
          <input type="search" placeholder="Search by address, email or record ID" aria-label="Search the audit log" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
        {entityTypes.length > 0 && (
          <select className="sd-field" aria-label="Show one area" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }}>
            <option value="all">All areas</option>
            {entityTypes.map((t) => <option key={t} value={t}>{t.replace(/[-_]/g, " ")}</option>)}
          </select>
        )}
        <span className="aud-dates">
          <input type="date" className="sd-field" aria-label="From date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <span aria-hidden="true">to</span>
          <input type="date" className="sd-field" aria-label="To date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </span>
        {hasFilters && <button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button>}
      </div>

      <div className="aud-bar" role="group" aria-label="Who did it">
        <select className="sd-field" aria-label="Show one kind of user" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="all">All users</option>
          {ACTOR_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <select className="sd-field" aria-label="Show one school" value={schoolId} onChange={(e) => { setSchoolId(e.target.value); setPage(1); }}>
          <option value="">All schools</option>
          {schools.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <ChipGroup label="What to show" value={attention ? "attention" : "all"} options={[["all", "Everything"], ["attention", "Failed or deleted"]] as const} onChange={(v) => { setAttention(v === "attention"); setPage(1); }} />
        {actorId && <span className="sm-chip" data-class="true">Only {personName} <button type="button" className="sm-reset" style={{ color: "var(--sd-ink)", marginLeft: "0.4rem" }} onClick={() => { setActorId(""); setPage(1); }} aria-label="Show everyone again">Show everyone</button></span>}
      </div>

      <SummaryPanel summary={summary} actorId={actorId} onPerson={(id) => { setActorId(id); setPage(1); }} />

      <SavedViewsBar
        tableKey="audit-log"
        currentState={{ search: searchInput.trim(), entityType, method, from, to, role, schoolId, attention }}
        onApply={(s) => {
          const f = { ...NO_FILTERS, ...(s as Partial<Filters>) };
          setSearchInput(String(f.search ?? ""));
          setSearch(String(f.search ?? ""));
          setEntityType(String(f.entityType ?? "all"));
          setMethod(String(f.method ?? "all"));
          setFrom(String(f.from ?? ""));
          setTo(String(f.to ?? ""));
          setRole(String(f.role ?? "all"));
          setSchoolId(String(f.schoolId ?? ""));
          setAttention(Boolean(f.attention));
          setActorId("");
          setPage(1);
        }}
      />

      {first ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : dash ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>We could not load the audit log</b>
            <p>Check your connection, then try again.</p>
            <button className="sd-btn sd-btn--amber" onClick={() => void fetchLogs()}>Try again</button>
          </div>
        </section>
      ) : logs.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>{hasFilters ? "No entries match" : "Nothing recorded yet"}</b>
            <p>{hasFilters ? "Try a wider date range or a different search." : "When someone adds, changes or deletes something, it is recorded here."}</p>
            {hasFilters && <button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button>}
          </div>
        </section>
      ) : (
        <>
          {error && <p className="aud-note" role="alert">The latest refresh failed. These entries are from the last time it worked.</p>}
          <AuditList rows={logs} now={now} onOpen={setDetail} />
          <Pager offset={(page - 1) * limit} count={logs.length} total={total} pageSize={limit} busy={loading} noun="entries" onPrev={() => setPage(Math.max(1, page - 1))} onNext={() => setPage(page + 1)} />
          <p className="aud-note">Only changes are recorded: adding, changing and deleting. Looking at a page or signing in is not. For students only key actions are kept, such as handing in work and asking for a retake. Entries from school admins, teachers and students are deleted after 90 days. Export CSV saves up to 5,000 of the newest entries that match your filters.</p>
        </>
      )}

      <EntryModal entry={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
