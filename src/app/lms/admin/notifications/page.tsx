"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Check, RefreshCw, Send } from "lucide-react";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { adminApi } from "@/lib/api/admin.api";
import { commonApi } from "@/lib/api/common.api";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { toast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { requestClose } from "@/hooks/useUnsavedCloseGuard";
import { getStoredUserId } from "@/lib/session-utils";
import { ChipGroup, NotificationComposer, NotificationRow, NotificationsHero, Pager, RecipientList, RepliesModal } from "@/components/portal/notifications";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReplyItem {
  id: string;
  notification_id: string;
  user_id: number;
  reply_text: string;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string | null; email: string; role: string };
}

interface NotificationItem {
  id: string;
  user_id: number;
  broadcast_id?: string | null;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  allow_replies?: boolean;
  created_at: string;
  profiles?: { id: string; full_name: string; email: string; role: string };
  replies?: ReplyItem[];
  reply_count?: number;
  recipient_count?: number;
}

interface RecipientOption {
  id: string;
  name: string;
  count?: number;
  email?: string;
  role?: string;
}

/** Unwrap `{ data: { ... } }` from gateways/proxies while keeping a flat body working */
function unwrapApiPayload<T extends Record<string, unknown>>(body: unknown): T {
  if (body && typeof body === "object" && "data" in body && (body as { data?: unknown }).data != null) {
    const inner = (body as { data: unknown }).data;
    if (typeof inner === "object" && inner !== null && !Array.isArray(inner)) {
      return inner as T;
    }
  }
  return (body ?? {}) as T;
}

// ─── Reply thread ─────────────────────────────────────────────────────────────
function ReplyDialog({
  notification,
  onClose,
  onReplySent,
}: {
  notification: NotificationItem | null;
  onClose: () => void;
  onReplySent: (notifId: string, replies: ReplyItem[]) => void;
}) {
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(0);
  const myId = typeof window !== "undefined" ? getStoredUserId() : null;

  useEffect(() => {
    if (!notification) return;
    setReplies([]);
    setReplyText("");
    setNow(Date.now());
    setLoading(true);
    commonApi.notifications.reply({ notification_id: notification.id })
      .then(({ data }) => {
        const payload = unwrapApiPayload<{ replies?: ReplyItem[] }>(data as Record<string, unknown>);
        setReplies(payload?.replies ?? []);
      })
      .catch(() => toast.error("Failed to load replies"))
      .finally(() => setLoading(false));
  }, [notification]);

  const handleSend = async () => {
    if (!notification || !replyText.trim()) return;
    setSending(true);
    try {
      await commonApi.notifications.createReply({
        notification_id: notification.id,
        reply_text: replyText.trim(),
      });
      const { data } = await commonApi.notifications.reply({ notification_id: notification.id });
      const updated = unwrapApiPayload<{ replies?: ReplyItem[] }>(data as Record<string, unknown>)?.replies ?? [];
      setReplies(updated);
      onReplySent(notification.id, updated);
      setReplyText("");
      toast.success("Reply sent");
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  return (
    <RepliesModal
      open={!!notification}
      onClose={() => { void requestClose(replyText.trim() !== "", () => { setReplyText(""); onClose(); }); }}
      title={notification?.title}
      subtitle={notification?.message}
      allowReplies={notification?.allow_replies}
      replies={replies}
      loading={loading}
      text={replyText}
      onText={setReplyText}
      onSend={handleSend}
      sending={sending}
      myId={myId}
      now={now || Date.now()}
    />
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;

export default function NotificationsManagement() {
  const [now, setNow] = useState(0);
  const [activeTab, setActiveTab] = useState<"send" | "sent" | "received">("received");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pageOffset, setPageOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Rate-limit guard: prevent hammering the API from realtime events / focus / visibility
  const lastFetchRef = useRef(0);
  const realtimeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightRef = useRef(false); // prevent concurrent duplicate requests
  const MIN_AUTO_FETCH_MS = 10_000; // 10 s between non-manual fetches

  // Send form
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [notifType, setNotifType] = useState("general");
  const [recipientType, setRecipientType] = useState<"all" | "role" | "school" | "individual">("all");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [allowReplies, setAllowReplies] = useState(true);
  const [sending, setSending] = useState(false);

  // Recipients data
  const [roles, setRoles] = useState<RecipientOption[]>([]);
  const [schools, setSchools] = useState<RecipientOption[]>([]);
  const [users, setUsers] = useState<RecipientOption[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  // Filters — searchInput is what the box shows; searchQuery is the
  // debounced value actually sent to the backend (avoids a request per keystroke).
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "read" | "unread">("all");

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to page 1 whenever the tab, search, or status filter changes.
  useEffect(() => {
    setPageOffset(0);
  }, [activeTab, searchQuery, filterStatus]);

  // Reply dialog
  const [replyTarget, setReplyTarget] = useState<NotificationItem | null>(null);

  // ── Load notifications ──────────────────────────────────────────────────────
  const loadUnreadCount = useCallback(async () => {
    try {
      const { data } = await commonApi.notifications.user.getUnreadCount();
      const c = unwrapApiPayload<{ count?: number }>(data as Record<string, unknown>)?.count;
      setUnreadCount(Number(c ?? 0));
    } catch {
      // non-critical — badge just won't update
    }
  }, []);

  const loadNotifications = useCallback(async (force = false) => {
    if (activeTab === "send") return;
    if (inFlightRef.current) return; // already fetching — drop duplicate
    const now = Date.now();
    if (!force && now - lastFetchRef.current < MIN_AUTO_FETCH_MS) return;
    lastFetchRef.current = now;
    inFlightRef.current = true;
    setLoading(true);
    try {
      const mode = activeTab === "sent" ? "sent" : "received";
      const { data: responseBody } = await adminApi.notifications.list({
        limit: PAGE_SIZE,
        offset: pageOffset,
        mode,
        search: searchQuery || undefined,
        status: filterStatus !== "all" ? filterStatus : undefined,
      });
      const payload = unwrapApiPayload<{ notifications?: NotificationItem[]; total?: number }>(
        responseBody as Record<string, unknown>,
      );
      const raw: NotificationItem[] = Array.isArray(payload.notifications)
        ? payload.notifications
        : [];
      setTotal(payload.total ?? raw.length);

      // For sent mode: group by broadcast_id (falls back to the row's own id
      // for legacy single-recipient sends, i.e. no merge) to collapse a
      // broadcast's recipient fan-out into one row.
      let result: NotificationItem[];
      if (mode === "sent") {
        const map = new Map<string, NotificationItem & { recipient_count: number }>();
        for (const n of raw) {
          const key = n.broadcast_id ?? n.id;
          const ex = map.get(key);
          if (ex) {
            ex.recipient_count += 1;
            ex.reply_count = Math.max(ex.reply_count ?? 0, n.reply_count ?? 0);
          } else {
            map.set(key, { ...n, recipient_count: 1 });
          }
        }
        result = Array.from(map.values());
      } else {
        result = raw;
      }

      // Attach reply counts from already-loaded data if available, else default 0
      setNotifications(result.map((n) => ({ ...n, reply_count: n.reply_count ?? 0 })));
      setNow(Date.now());
    } catch (err) {
      toast.error(`Failed to load notifications: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [activeTab, pageOffset, searchQuery, filterStatus]);

  const loadRecipients = useCallback(async () => {
    setLoadingRecipients(true);
    try {
      const { data: recipientsBody } = await adminApi.notifications.recipients();
      const recPayload = unwrapApiPayload<{
        roles?: RecipientOption[];
        schools?: RecipientOption[];
        users?: RecipientOption[];
      }>(recipientsBody as Record<string, unknown>);
      setRoles(recPayload?.roles ?? []);
      setSchools(recPayload?.schools ?? []);
      setUsers(recPayload?.users ?? []);
    } catch (err) {
      toast.warning(
        `Could not load recipient list: ${err instanceof Error ? err.message : "Unknown error"}. Try refreshing the page.`,
      );
    } finally {
      setLoadingRecipients(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications(true);
  }, [loadNotifications]);

  useEffect(() => {
    loadRecipients();
  }, [loadRecipients]);

  // Always fetch unread count on mount so the tab badge is correct immediately
  useEffect(() => {
    void loadUnreadCount();
  }, [loadUnreadCount]);

  useSmartRefresh({
    customRefresh: () => loadNotifications(), // non-forced, respects MIN_AUTO_FETCH_MS
    minRefreshInterval: 60000,
    hasUnsavedData: () => (title.trim() !== "" || message.trim() !== "") && activeTab === "send",
  });

  useDashboardRealtime("admin", {
    enabled: true,
    debugLabel: "admin-notifications-page",
    customEventMap: { "notification:new": [], "notification:read": [] },
    onEvent: ({ eventType }) => {
      if (eventType === "notification:new" || eventType === "notification:read") {
        // Debounce: collapse rapid-fire WebSocket events into a single refresh
        if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = setTimeout(() => {
          loadNotifications(); // non-forced — respects MIN_AUTO_FETCH_MS
        }, 800);
      }
    },
  });

  // ── Mark as read ────────────────────────────────────────────────────────────
  const handleMarkRead = useCallback(async (notifId: string) => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => n.id === notifId ? { ...n, is_read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await commonApi.notifications.user.update({ notification_id: notifId, is_read: true });
    } catch (err) {
      // Revert
      setNotifications((prev) => prev.map((n) => n.id === notifId ? { ...n, is_read: false } : n));
      setUnreadCount((c) => c + 1);
      toast.error(`Failed to mark as read: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, []);

  // ── Delete / dismiss ────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (notifId: string) => {
    const removed = notifications.find((n) => n.id === notifId);
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    setTotal((t) => Math.max(0, t - 1));
    if (removed && !removed.is_read) setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await commonApi.notifications.user.update({ notification_id: notifId, deleted: true });
      toast.success("Notification dismissed");
    } catch (err) {
      loadNotifications(true);
      loadUnreadCount();
      toast.error(`Failed to dismiss: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [notifications, loadNotifications, loadUnreadCount]);

  const handleMarkAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await commonApi.notifications.user.update({ mark_all: true, is_read: true });
      toast.success("All notifications marked as read");
    } catch (err) {
      loadNotifications();
      loadUnreadCount();
      toast.error(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [loadNotifications, loadUnreadCount]);

  // ── Send notification ───────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required");
      return;
    }
    if (recipientType !== "all" && selectedRecipients.length === 0) {
      toast.error("Select at least one recipient");
      return;
    }
    setSending(true);
    try {
      const { data: sendBody } = await adminApi.notifications.create({
        title: title.trim(),
        message: message.trim(),
        type: notifType,
        recipientType,
        recipients: recipientType === "all" ? [] : selectedRecipients,
        allowReplies,
      });
      const sendPayload = unwrapApiPayload<{ recipients?: number; success?: boolean }>(
        sendBody as Record<string, unknown>,
      );
      toast.success(
        `Sent to ${sendPayload?.recipients ?? 0} recipient${(sendPayload?.recipients ?? 0) !== 1 ? "s" : ""}`,
      );
      setTitle(""); setMessage(""); setNotifType("general");
      setRecipientType("all"); setSelectedRecipients([]); setAllowReplies(true);
      setActiveTab("sent");
    } catch (err) {
      toast.error(`Failed to send: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSending(false);
    }
  };

  // ── Reply callback ──────────────────────────────────────────────────────────
  const handleReplySent = useCallback((notifId: string, replies: ReplyItem[]) => {
    setNotifications((prev) =>
      prev.map((n) => n.id === notifId ? { ...n, reply_count: replies.length } : n)
    );
  }, []);

  // Search/status filtering now happens server-side (see loadNotifications),
  // so `notifications` already reflects the current filters — no client-side
  // re-filtering needed, and none would work correctly anyway once paginated.

  // ── Recipient toggle helper ─────────────────────────────────────────────────
  const toggleRecipient = (id: string) =>
    setSelectedRecipients((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const filteredUsers = users.filter((u) =>
    !userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase()) || (u.email ?? "").toLowerCase().includes(userSearch.toLowerCase())
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  const canSend =
    !sending && !!title.trim() && !!message.trim() && (recipientType === "all" || selectedRecipients.length > 0);
  const pickList = recipientType === "role" ? roles : recipientType === "school" ? schools : filteredUsers;
  const picked = selectedRecipients.length;
  const recipientSummary =
    recipientType === "all" ? "Everyone in the system"
    : picked === 0 ? `Nobody picked yet`
    : recipientType === "role" ? roles.filter((r) => selectedRecipients.includes(r.id)).map((r) => `${r.name} (${r.count})`).join(", ")
    : recipientType === "school" ? `${picked} school${picked === 1 ? "" : "s"}`
    : `${picked} ${picked === 1 ? "person" : "people"}`;

  return (
    <div className="sd-page">
      <NotificationsHero
        items={notifications}
        unread={unreadCount}
        unreadNote="unread in your inbox"
        status={
          activeTab === "send" ? "Write a message for people across the system. Pick who gets it."
          : loading ? "Checking your messages…"
          : <><strong>{total}</strong> {activeTab === "sent" ? "sent" : "received"}{activeTab === "received" && unreadCount > 0 ? <> · <strong>{unreadCount} unread</strong></> : null}.</>
        }
        actions={
          <>
            {activeTab === "received" && unreadCount > 0 && (
              <button className="sd-btn sd-btn--amber" onClick={handleMarkAllRead}><Check aria-hidden="true" />Mark all read</button>
            )}
            {activeTab !== "send" && (
              <button className="sd-btn sd-btn--ghost-dark" onClick={() => setActiveTab("send")}><Send aria-hidden="true" />New notification</button>
            )}
          </>
        }
      />

      <div className="mc-tabs" role="tablist" aria-label="Notifications" style={{ justifySelf: "start" }}>
        {([
          { key: "received", label: "Received", count: unreadCount },
          { key: "sent", label: "Sent", count: 0 },
          { key: "send", label: "Send notification", count: 0 },
        ] as const).map(({ key, label, count }) => (
          <button key={key} role="tab" className="mc-tab" aria-selected={activeTab === key} onClick={() => setActiveTab(key)}>
            {label}{count > 0 && <b>{count}</b>}
          </button>
        ))}
      </div>

      {activeTab === "send" ? (
        <NotificationComposer
          description="Send to everyone, a group, a school or specific people."
          title={title} onTitle={setTitle} titleMax={200}
          message={message} onMessage={setMessage} messageMax={1000}
          type={notifType} onType={setNotifType}
          allowReplies={allowReplies} onAllowReplies={setAllowReplies}
          canSend={canSend} sending={sending} onSend={handleSend}
        >
          <div className="sd-field-wrap">
            <label>Who is it for?</label>
            <ChipGroup
              label="Who is it for?"
              value={recipientType}
              options={[["all", "Everyone"], ["role", "Whole groups"], ["school", "Schools"], ["individual", "Individual people"]] as const}
              onChange={(v) => { setRecipientType(v); setSelectedRecipients([]); }}
            />
          </div>
          {recipientType !== "all" && (
            <div className="sd-field-wrap">
              <label>
                {recipientType === "role" ? "Pick groups" : recipientType === "school" ? "Pick schools" : "Pick people"}
                {selectedRecipients.length > 0 && ` (${selectedRecipients.length} picked)`}
              </label>
              {recipientType === "individual" && (
                <input type="search" className="sd-field" placeholder="Search people" aria-label="Search people" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
              )}
              <RecipientList
                items={pickList}
                selected={selectedRecipients}
                onToggle={toggleRecipient}
                loading={loadingRecipients}
                avatars={recipientType === "individual"}
                emptyText={userSearch ? "Nobody matches that search." : "Nobody to pick yet."}
              />
            </div>
          )}
          <p className="nt-summary"><b>Goes to: </b>{recipientSummary}</p>
        </NotificationComposer>
      ) : (
        <>
          <div className="nt-bar">
            <input
              type="search"
              className="sd-field"
              placeholder="Search notifications"
              aria-label="Search notifications"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <ChipGroup label="Read status" value={filterStatus} options={[["all", "Any"], ["unread", "Unread"], ["read", "Read"]] as const} onChange={setFilterStatus} />
            <button className="pl-ico" onClick={() => loadNotifications(true)} disabled={loading} aria-label="Refresh" title="Refresh">
              <RefreshCw className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {loading ? (
            <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
          ) : notifications.length === 0 ? (
            <section className="sd-panel">
              <div className="sd-empty">
                <b>No notifications found</b>
                <p>{searchQuery || filterStatus !== "all" ? "Try a different search or filter." : activeTab === "sent" ? "Notifications you send will show up here." : "Messages for you will show up here."}</p>
              </div>
            </section>
          ) : (
            <div className="sd-panel as-list mc-swap">
              {notifications.map((n) => {
                const person = n.profiles ? n.profiles.full_name || n.profiles.email : null;
                const more = (n.recipient_count ?? 1) - 1;
                return (
                  <NotificationRow
                    key={n.id}
                    // read state only means something in your own inbox
                    n={activeTab === "received" ? n : { ...n, is_read: true }}
                    now={now || Date.now()}
                    replyCount={n.reply_count}
                    meta={
                      (person || more > 0) && (
                        <span>
                          {activeTab === "sent" ? "To " : "From "}
                          {person ?? "recipients"}
                          {n.profiles?.role && ` (${n.profiles.role})`}
                          {more > 0 && person ? ` and ${more} more` : ""}
                        </span>
                      )
                    }
                    onRead={activeTab === "received" ? () => handleMarkRead(n.id) : undefined}
                    onReplies={() => setReplyTarget(n)}
                    onDelete={
                      activeTab === "received"
                        ? async () => {
                            if (await confirmDialog({
                              title: "Dismiss this notification?",
                              description: "It will be removed from your inbox.",
                              confirmText: "Dismiss",
                            })) void handleDelete(n.id);
                          }
                        : undefined
                    }
                  />
                );
              })}
              <Pager
                offset={pageOffset} count={notifications.length} total={total} pageSize={PAGE_SIZE} busy={loading}
                onPrev={() => setPageOffset((o) => Math.max(0, o - PAGE_SIZE))}
                onNext={() => setPageOffset((o) => o + PAGE_SIZE)}
              />
            </div>
          )}
        </>
      )}

      <ReplyDialog notification={replyTarget} onClose={() => setReplyTarget(null)} onReplySent={handleReplySent} />
    </div>
  );
}
