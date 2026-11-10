"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import ConfirmModal from "@/components/portal/ConfirmModal";
import { ChipGroup, Pager } from "@/components/portal/notifications";
import MessageRun from "@/components/admin/inbox/MessageRun";
import MessageList from "@/components/admin/inbox/MessageList";
import MessageModal from "@/components/admin/inbox/MessageModal";
import { FLOW, NO_COUNTS, STATUS_LABEL, nameOf, plural, type Counts, type Message, type Status, type View } from "@/components/admin/inbox/utils";
import { adminApi } from "@/lib/api/admin.api";
import { toast } from "@/components/ui/toast";
import { requestClose } from "@/hooks/useUnsavedCloseGuard";
import "@/components/school-admin/overview.css"; // hero meta
import "@/components/teacher/overview/overview.css"; // track
import "@/components/school-admin/students.css"; // sm- chips and forms
import "@/components/school-admin/teachers.css"; // tm- track nodes
import "@/components/admin/inbox/inbox.css";

const LIMIT = 20;
type Filter = View | "all";

export default function ContactSubmissionsPage() {
  const [rows, setRows] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts>(NO_COUNTS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const [view, setView] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  // searchInput is what the box shows; search is the debounced value sent to the server.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const [selected, setSelected] = useState<Message | null>(null);
  const [statusEdit, setStatusEdit] = useState<Status>("read");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<Message | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.contactSubmissions.list({
        status: view === "all" ? undefined : view,
        page,
        limit: LIMIT,
        search: search || undefined,
      });
      const data = res.data as { submissions: Message[]; total: number; status_counts: Counts };
      setRows(data.submissions);
      setTotal(data.total);
      setCounts({ ...NO_COUNTS, ...data.status_counts });
      setNow(Date.now());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [view, page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const pickView = (v: Filter) => {
    setView(v);
    setPage(1);
  };

  const openMessage = async (m: Message) => {
    setSelected(m);
    setStatusEdit(m.status);
    setNotes(m.admin_notes ?? "");
    // Opening a new message marks it read.
    if (m.status === "new") {
      try {
        await adminApi.contactSubmissions.update(m.id, { status: "read" });
        setRows((prev) => prev.map((r) => (r.id === m.id ? { ...r, status: "read" } : r)));
        setCounts((prev) => ({ ...prev, new: Math.max(0, prev.new - 1), read: prev.read + 1 }));
        setSelected((prev) => (prev && prev.id === m.id ? { ...prev, status: "read" } : prev));
        setStatusEdit((s) => (s === "new" ? "read" : s));
      } catch {
        /* not critical */
      }
    }
  };

  const dirty = !!selected && (notes !== (selected.admin_notes ?? "") || statusEdit !== selected.status);
  const closeMessage = () => { void requestClose(dirty, () => setSelected(null)); };

  const saveChanges = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await adminApi.contactSubmissions.update(selected.id, { status: statusEdit, admin_notes: notes });
      toast.success("Saved");
      setSelected(null);
      void load();
    } catch {
      toast.error("We could not save your changes. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (m: Message, s: Status) => {
    setBusyId(m.id);
    try {
      await adminApi.contactSubmissions.update(m.id, { status: s });
      toast.success(s === "replied" ? "Marked as replied" : "Archived");
      await load();
    } catch {
      toast.error("We could not update this message. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setConfirming(true);
    try {
      await adminApi.contactSubmissions.delete(deleteTarget.id);
      toast.success("Moved to Deleted. You can restore it from there.");
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error("We could not delete this message. Try again.");
    } finally {
      setConfirming(false);
    }
  };

  const restore = async (m: Message) => {
    setBusyId(m.id);
    try {
      await adminApi.contactSubmissions.restore(m.id);
      toast.success("Message restored");
      await load();
    } catch {
      toast.error("We could not restore this message. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmPurge = async () => {
    if (!purgeTarget) return;
    setConfirming(true);
    try {
      await adminApi.contactSubmissions.purge(purgeTarget.id);
      toast.success("Message deleted forever");
      setPurgeTarget(null);
      await load();
    } catch {
      toast.error("We could not delete this message. Try again.");
    } finally {
      setConfirming(false);
    }
  };

  const filed = FLOW.reduce((n, s) => n + counts[s], 0);
  const hasFilters = view !== "all" || searchInput.trim() !== "";
  const dash = loadError && rows.length === 0;
  const first = loading && rows.length === 0;

  let statusLine: React.ReactNode;
  if (dash) statusLine = "The messages did not load. Try refreshing.";
  else if (first) statusLine = "Checking the inbox…";
  else if (filed === 0 && counts.deleted === 0) statusLine = <><strong>No messages yet.</strong> Messages from the website contact form show up here.</>;
  else if (counts.new > 0) statusLine = <><strong>{plural(counts.new, "new message")}</strong> {counts.new === 1 ? "is" : "are"} waiting for you.{counts.read > 0 && <> {counts.read} more {counts.read === 1 ? "has" : "have"} been read but not answered.</>}</>;
  else if (counts.read > 0) statusLine = <><strong>Nothing new.</strong> {plural(counts.read, "message")} read but not answered yet.</>;
  else statusLine = <><strong>All caught up.</strong> Every message has been answered or filed away.</>;

  const runCaption = first ? "Loading…" : counts.new + counts.read > 0 ? `${counts.new + counts.read} to answer` : filed > 0 ? "Nothing waiting" : "No messages yet";
  const runSelected = view !== "all" && view !== "deleted" ? view : null;
  const repliedPct = filed > 0 ? Math.round((counts.replied / filed) * 100) : 0;

  const options = [
    ["all", "All"],
    ...(["new", "read", "replied", "archived", "deleted"] as const).map((s) => [s, counts[s] > 0 ? `${STATUS_LABEL[s]} ${counts[s]}` : STATUS_LABEL[s]] as const),
  ] as const;

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="ib-title">
        <div className="sd-hero-copy">
          <h1 id="ib-title" className="mc-hero-title">Contact submissions</h1>
          <p className="sd-where">Messages from the website contact form</p>
          <p className="sd-status">{statusLine}</p>
          {counts.new > 0 && view !== "new" && (
            <div className="sd-hero-actions">
              <button className="sd-btn sd-btn--amber" onClick={() => pickView("new")}>Show {plural(counts.new, "new message")}</button>
            </div>
          )}
          <div className="so-meta">
            <button className="so-refresh" onClick={() => void load()} disabled={loading} aria-label={loading ? "Refreshing" : "Refresh"} title="Refresh">
              <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
            </button>
          </div>
        </div>
        {first ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : (
          <MessageRun counts={counts} selected={runSelected} onSelect={(s) => pickView(s ?? "all")} caption={runCaption} />
        )}
      </section>

      <div className="sd-ledger" role="group" aria-label="Message numbers">
        <button type="button" aria-pressed={view === "all"} onClick={() => pickView("all")}>
          <span className="sd-l">Messages</span><b className="sd-n">{dash || first ? "–" : filed}</b><small>{dash ? "Not loaded" : first ? " " : "Not counting deleted"}</small>
        </button>
        <button type="button" aria-pressed={view === "replied"} onClick={() => pickView(view === "replied" ? "all" : "replied")}>
          <span className="sd-l">Replied</span><b className="sd-n">{dash || first ? "–" : `${repliedPct}%`}</b><small>{dash ? "Not loaded" : first ? " " : `${plural(counts.replied, "message")} answered`}</small>
        </button>
        <button type="button" aria-pressed={view === "deleted"} onClick={() => pickView(view === "deleted" ? "all" : "deleted")}>
          <span className="sd-l">Deleted</span><b className="sd-n">{dash || first ? "–" : counts.deleted}</b><small>{dash ? "Not loaded" : first ? " " : counts.deleted > 0 ? "Restore or delete forever" : "Nothing in the bin"}</small>
        </button>
      </div>

      <div className="ib-bar">
        <div className="sd-search" style={{ flex: "1 1 16rem", maxWidth: "26rem", width: "auto" }}>
          <Search aria-hidden="true" />
          <input type="search" placeholder="Search by name, email or message" aria-label="Search messages" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
        <ChipGroup label="Show messages" value={view} options={options} onChange={pickView} />
        {hasFilters && <button className="sm-reset" style={{ color: "var(--sd-ink)" }} onClick={() => { setSearchInput(""); pickView("all"); }}>Clear</button>}
      </div>

      {first ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : dash ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>We could not load the messages</b>
            <p>Check your connection, then try again.</p>
            <button className="sd-btn sd-btn--amber" onClick={() => void load()}>Try again</button>
          </div>
        </section>
      ) : rows.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>{search ? "No messages match" : view === "new" ? "No new messages" : view === "deleted" ? "Nothing deleted" : view === "all" ? "No messages yet" : `No ${STATUS_LABEL[view].toLowerCase()} messages`}</b>
            <p>{search ? "Try a different name, email or word." : view === "new" ? "You are all caught up." : view === "deleted" ? "Deleted messages wait here until you restore them or delete them forever." : view === "all" ? "Messages from the website contact form show up here." : "Nothing is at this stage right now."}</p>
            {hasFilters && <button className="sd-btn sd-btn--line" onClick={() => { setSearchInput(""); pickView("all"); }}>Show all messages</button>}
          </div>
        </section>
      ) : (
        <>
          <MessageList rows={rows} view={view} now={now} busyId={busyId} onOpen={(m) => void openMessage(m)} onStatus={(m, s) => void setStatus(m, s)} onDelete={setDeleteTarget} onRestore={(m) => void restore(m)} onPurge={setPurgeTarget} />
          <Pager offset={(page - 1) * LIMIT} count={rows.length} total={total} pageSize={LIMIT} busy={loading} noun="messages" onPrev={() => setPage(Math.max(1, page - 1))} onNext={() => setPage(page + 1)} />
        </>
      )}

      <MessageModal message={selected} status={statusEdit} onStatus={setStatusEdit} notes={notes} onNotes={setNotes} saving={saving} onSave={() => void saveChanges()} onClose={closeMessage} />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Move this message to Deleted?"
        subtitle={deleteTarget ? nameOf(deleteTarget) : undefined}
        confirmLabel="Move to Deleted"
        busy={confirming}
        onConfirm={() => void confirmDelete()}
      >
        <p style={{ margin: 0 }}>It leaves the inbox. You can restore it from the Deleted view at any time before it is deleted forever.</p>
      </ConfirmModal>

      <ConfirmModal
        open={!!purgeTarget}
        onClose={() => setPurgeTarget(null)}
        title="Delete this message forever?"
        subtitle={purgeTarget ? nameOf(purgeTarget) : undefined}
        confirmLabel="Delete forever"
        danger
        busy={confirming}
        onConfirm={() => void confirmPurge()}
      >
        <p style={{ margin: 0 }}>The message and your notes on it are removed for good. This cannot be undone.</p>
      </ConfirmModal>
    </div>
  );
}
