"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import ConfirmModal from "../../portal/ConfirmModal";
import RowMenu from "../../portal/RowMenu";
import { ChipGroup, Pager, ago, initialsOf } from "../../portal/notifications";
import ResetRun, { type Stop } from "./ResetRun";
import { ApproveModal, DetailModal, RejectModal } from "./ResetModals";
import { fullDate, isOverdue, nameOf, roleLabel, STATUS_LABEL, waited, type ResetCounts, type ResetRequest } from "./types";
import "../students.css";
import "./resets.css";

const PAGE_SIZE = 20;
type Tab = "pending" | "history";
type Filter = "all" | "approved" | "rejected" | "completed";
type Dialog = { type: "view" | "approve" | "reject" | "delete"; request: ResetRequest } | null;

type ListResult = { requests: ResetRequest[]; total: number };
const parseList = (data: unknown): ListResult => {
  if (Array.isArray(data)) return { requests: data as ResetRequest[], total: data.length };
  const d = data as { requests?: ResetRequest[]; total?: number } | null;
  const requests = Array.isArray(d?.requests) ? d.requests : [];
  return { requests, total: d?.total ?? requests.length };
};

const errText = (err: unknown) =>
  (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ?? (err instanceof Error ? err.message : "Try again.");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The password-reset endpoints, the same shape for the admin and the school admin. */
export interface ResetApi {
  pendingCount(): Promise<{ data: unknown }>;
  list(params?: { status?: string; limit?: number; offset?: number; search?: string }): Promise<{ data: unknown }>;
  update(data: Record<string, unknown>): Promise<unknown>;
  delete(id: string): Promise<unknown>;
}

/**
 * The password reset requests screen, shared by the admin and the school admin.
 * Both see the same flow: who is locked out, approve with a temporary password or reject, and a history.
 */
export default function ResetRequestsView({
  api,
  keyPrefix,
  audience,
  where,
  showSchool = false,
}: {
  api: ResetApi;
  /** React Query key prefix, so each portal caches on its own */
  keyPrefix: string;
  /** who asks, in plain words: "your students and teachers" */
  audience: string;
  /** a short line under the title, optional */
  where?: string;
  /** show each person's school (the admin sees every school) */
  showSchool?: boolean;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [filter, setFilter] = useState<Filter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pageState, setPageState] = useState({ key: "", offset: 0 });
  const [dialog, setDialog] = useState<Dialog>(null);
  const [deleting, setDeleting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { const t = setTimeout(() => setSearch(searchInput.trim()), 400); return () => clearTimeout(t); }, [searchInput]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);

  // How many requests sit in each state: one cheap query each, the track and tabs read from these.
  const countsQuery = useQuery({
    queryKey: [keyPrefix, "counts"],
    queryFn: async (): Promise<ResetCounts> => {
      const total = async (status: string) => parseList((await api.list({ status, limit: 1 })).data).total;
      const [pending, approved, rejected, completed] = await Promise.all([
        api.pendingCount().then((r) => Number((r.data as { count?: number })?.count ?? 0)),
        total("approved"),
        total("rejected"),
        total("completed"),
      ]);
      return { pending, approved, rejected, completed };
    },
  });
  const counts = countsQuery.data;
  const pending = counts?.pending ?? 0;
  const resolved = counts ? counts.approved + counts.rejected + counts.completed : 0;

  // The longest wait is the oldest pending request, which is the last one in a newest-first list.
  const oldestQuery = useQuery({
    queryKey: [keyPrefix, "oldest", pending],
    enabled: pending > 0,
    queryFn: async () => parseList((await api.list({ status: "pending", limit: 1, offset: pending - 1 })).data).requests[0],
  });
  const oldest = pending > 0 ? oldestQuery.data : undefined;

  // "resolved" is the server's word for "anything but pending", used by History when no status is picked.
  const status = tab === "pending" ? "pending" : filter === "all" ? "resolved" : filter;
  const filterKey = `${tab}|${filter}|${search}`;
  const offset = pageState.key === filterKey ? pageState.offset : 0;
  const listQuery = useQuery({
    queryKey: [keyPrefix, "list", status, search, offset],
    placeholderData: keepPreviousData,
    queryFn: async () => parseList((await api.list({ status, limit: PAGE_SIZE, offset, search: search || undefined })).data),
  });
  const rows = listQuery.data?.requests ?? [];
  const total = listQuery.data?.total ?? 0;
  const refreshing = countsQuery.isFetching || listQuery.isFetching;

  const refresh = () => { void qc.invalidateQueries({ queryKey: [keyPrefix] }); };
  // The sidebar badge listens for this, so it drops as soon as a request is resolved.
  const resolvedElsewhere = () => { refresh(); window.dispatchEvent(new Event("password-reset-resolved")); };

  const approve = async (r: ResetRequest, password: string, notes: string) => {
    try {
      await api.update({ id: r.id, status: "approved", temp_password: password, ...(notes ? { notes } : {}) });
      toast.success(`Approved. ${nameOf(r)} has been told.`);
      resolvedElsewhere();
      return true;
    } catch (err) {
      toast.error(`Could not approve: ${errText(err)}`);
      return false;
    }
  };
  const reject = async (r: ResetRequest, notes: string) => {
    try {
      await api.update({ id: r.id, status: "rejected", ...(notes ? { notes } : {}) });
      toast.success(`Rejected. ${nameOf(r)} has been told.`);
      resolvedElsewhere();
      return true;
    } catch (err) {
      toast.error(`Could not reject: ${errText(err)}`);
      return false;
    }
  };
  const remove = async (r: ResetRequest) => {
    setDeleting(true);
    try {
      await api.delete(r.id);
      toast.success("Request deleted.");
      setDialog(null);
      refresh();
    } catch (err) {
      toast.error(`Could not delete it: ${errText(err)}`);
    } finally {
      setDeleting(false);
    }
  };

  const selected: Stop | null = tab === "pending" ? "pending" : filter === "approved" || filter === "rejected" ? filter : null;
  const pickStop = (s: Stop) => {
    if (s === "pending") { setTab("pending"); return; }
    setTab("history");
    setFilter(selected === s ? "all" : s);
  };

  let statusLine: React.ReactNode;
  if (countsQuery.error) statusLine = "The requests did not load. Try again.";
  else if (!counts) statusLine = "Checking for requests…";
  else if (pending > 0) statusLine = <><strong>{plural(pending, "person", "people")}</strong> {pending === 1 ? "is" : "are"} locked out and waiting for a new password.{oldest ? <> The longest wait is {waited(oldest.requested_at, now)}.</> : null}</>;
  else statusLine = resolved > 0 ? "Nobody is waiting. You have cleared every request." : "Nobody has asked for a password reset yet. Requests from " + audience + " show up here.";

  const hasFilters = !!searchInput || (tab === "history" && filter !== "all");
  const clear = () => { setSearchInput(""); setSearch(""); setFilter("all"); };

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="rs-title">
        <div className="sd-hero-copy">
          <h1 id="rs-title" className="mc-hero-title">Password reset requests</h1>
          {where && <p className="sd-where">{where}</p>}
          <p className="sd-status">{statusLine}</p>
          <div className="sd-hero-actions">
            <button className="sd-btn sd-btn--ghost-dark" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={refreshing ? "animate-spin" : ""} aria-hidden="true" />{refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>
        <ResetRun
          counts={counts}
          selected={selected}
          onSelect={pickStop}
          caption={<><b>{counts ? pending : "–"}<small>{pending === 1 ? "person waiting" : "people waiting"}</small></b><span>Pick a stop to filter</span></>}
        />
      </section>

      <div className="mc-tabs" role="tablist" aria-label="Request views" style={{ justifySelf: "start" }}>
        {([["pending", "Waiting", pending], ["history", "History", resolved]] as const).map(([id, label, n]) => (
          <button key={id} role="tab" className="mc-tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}<b>{counts ? n : "–"}</b></button>
        ))}
      </div>

      <div className="rs-bar">
        <input type="search" className="sd-field" placeholder={showSchool ? "Search by name, email, role or school" : "Search by name, email or role"} aria-label="Search requests" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        {tab === "history" && (
          <ChipGroup
            label="Outcome"
            value={filter}
            options={[
              ["all", "All"],
              ["approved", `Approved${counts ? ` ${counts.approved}` : ""}`],
              ["rejected", `Rejected${counts ? ` ${counts.rejected}` : ""}`],
              ...(counts && counts.completed > 0 ? [["completed", `Completed ${counts.completed}`] as const] : []),
            ] as readonly (readonly [Filter, string])[]}
            onChange={setFilter}
          />
        )}
        {hasFilters && <button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button>}
      </div>

      {listQuery.error ? (
        <section className="sd-panel">
          <div className="sd-empty"><b>We could not load the requests</b><p>Check your connection, then try again.</p><button className="sd-btn sd-btn--amber" onClick={refresh}>Try again</button></div>
        </section>
      ) : listQuery.isLoading ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : rows.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>{search ? "No requests match" : tab === "pending" ? "Nobody is waiting" : "Nothing in the history yet"}</b>
            <p>{search ? "Try a different name or email, or clear the search." : tab === "pending" ? `When ${audience} ask for a password reset, it shows up here and in the sidebar.` : "Approved and rejected requests are kept here."}</p>
            {hasFilters && <button className="sd-btn sd-btn--line" onClick={clear}>Clear filters</button>}
          </div>
        </section>
      ) : (
        <section className="sd-panel as-list mc-swap" aria-label={tab === "pending" ? "Waiting requests" : "Request history"} data-busy={listQuery.isPlaceholderData}>
          {rows.map((r) => {
            const late = r.status === "pending" && isOverdue(r.requested_at, now);
            return (
              <article key={r.id} className="rs-row" data-kind={tab} data-late={late}>
                <span className="sd-avatar" aria-hidden="true">{initialsOf(nameOf(r))}</span>
                <button className="sm-who" onClick={() => setDialog({ type: "view", request: r })} aria-label={`See details for ${nameOf(r)}`}>
                  <b>{nameOf(r)}</b>
                  <small>{r.email}</small>
                  {showSchool && r.schools?.name && <small>{r.schools.name}</small>}
                </button>
                {tab === "pending" ? (
                  <>
                    <span className="sm-chip" data-class="true">{roleLabel(r.user_role)}</span>
                    <span className="rs-when" data-late={late}>
                      <b>{late ? `Waiting ${waited(r.requested_at, now)}` : `Asked ${ago(r.requested_at, now).toLowerCase()}`}</b>
                      <small>{fullDate(r.requested_at)}</small>
                    </span>
                    <span className="rs-acts">
                      <button className="sd-btn sd-btn--amber" onClick={() => setDialog({ type: "approve", request: r })} aria-label={`Approve ${nameOf(r)}`}>Approve</button>
                      <button className="sd-btn sd-btn--line" onClick={() => setDialog({ type: "reject", request: r })} aria-label={`Reject ${nameOf(r)}`}>Reject</button>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="rs-status" data-s={r.status}>{STATUS_LABEL[r.status] ?? r.status}</span>
                    <span className="rs-when">
                      <b>{r.approved_by_name ? `By ${r.approved_by_name}` : "Resolved"}</b>
                      <small>{r.approved_at ? fullDate(r.approved_at) : "No date"} · {roleLabel(r.user_role)}</small>
                    </span>
                    <span className="rs-acts">
                      <RowMenu
                        label={`More actions for ${nameOf(r)}`}
                        items={[
                          { label: "See details", icon: Eye, onClick: () => setDialog({ type: "view", request: r }) },
                          { label: "Delete request", icon: Trash2, danger: true, separatorBefore: true, onClick: () => setDialog({ type: "delete", request: r }) },
                        ]}
                      />
                    </span>
                  </>
                )}
              </article>
            );
          })}
          <Pager
            offset={offset}
            count={rows.length}
            total={total}
            pageSize={PAGE_SIZE}
            noun="requests"
            busy={listQuery.isPlaceholderData}
            onPrev={() => setPageState({ key: filterKey, offset: Math.max(0, offset - PAGE_SIZE) })}
            onNext={() => setPageState({ key: filterKey, offset: offset + PAGE_SIZE })}
          />
        </section>
      )}

      {dialog?.type === "view" && <DetailModal request={dialog.request} onClose={() => setDialog(null)} />}
      {dialog?.type === "approve" && <ApproveModal key={dialog.request.id} request={dialog.request} onClose={() => setDialog(null)} onApprove={(pw, notes) => approve(dialog.request, pw, notes)} />}
      {dialog?.type === "reject" && <RejectModal key={dialog.request.id} request={dialog.request} onClose={() => setDialog(null)} onReject={(notes) => reject(dialog.request, notes)} />}
      <ConfirmModal
        open={dialog?.type === "delete"}
        onClose={() => setDialog(null)}
        title="Delete this request?"
        confirmLabel="Delete request"
        danger
        busy={deleting}
        onConfirm={() => { if (dialog?.type === "delete") void remove(dialog.request); }}
      >
        {dialog?.type === "delete" && <p>The record for <b>{nameOf(dialog.request)}</b> will be removed for good. Their password stays as it is.</p>}
      </ConfirmModal>
    </div>
  );
}
