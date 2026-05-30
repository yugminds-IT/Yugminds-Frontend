"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Bell, Send, Search, CheckCircle, Clock, AlertCircle, Info,
  RefreshCw, Reply, MessageSquare, Users, School, User,
  Megaphone, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { adminApi } from "@/lib/api/admin.api";
import { commonApi } from "@/lib/api/common.api";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { toast } from "@/components/ui/toast";

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
  title: string;
  message: string;
  type: string;
  is_read: boolean;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  info:    { icon: <Info className="h-4 w-4" />,         label: "Info",    color: "text-blue-500" },
  success: { icon: <CheckCircle className="h-4 w-4" />,  label: "Success", color: "text-green-500" },
  warning: { icon: <AlertCircle className="h-4 w-4" />,  label: "Warning", color: "text-yellow-500" },
  error:   { icon: <AlertCircle className="h-4 w-4" />,  label: "Error",   color: "text-red-500" },
  general: { icon: <Bell className="h-4 w-4" />,         label: "General", color: "text-gray-500" },
};
function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.general;
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

// ─── Reply Dialog ─────────────────────────────────────────────────────────────
function ReplyDialog({
  notification,
  open,
  onClose,
  onReplySent,
}: {
  notification: NotificationItem | null;
  open: boolean;
  onClose: () => void;
  onReplySent: (notifId: string, replies: ReplyItem[]) => void;
}) {
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !notification) return;
    setReplies([]);
    setReplyText("");
    setLoading(true);
    commonApi.notifications.reply({ notification_id: notification.id })
      .then(({ data }) => {
        const payload = unwrapApiPayload<{ replies?: ReplyItem[] }>(data as Record<string, unknown>);
        const r = payload?.replies ?? [];
        setReplies(r);
      })
      .catch(() => toast.error("Failed to load replies"))
      .finally(() => setLoading(false));
  }, [open, notification]);

  useEffect(() => {
    if (replies.length) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies.length]);

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

  if (!notification) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl bg-white flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            {notification.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 mt-1 line-clamp-2">
            {notification.message}
          </DialogDescription>
        </DialogHeader>

        {/* Replies list */}
        <div className="flex-1 overflow-y-auto space-y-3 py-2 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : replies.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No replies yet</p>
            </div>
          ) : (
            replies.map((r) => (
              <div key={r.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-blue-600">
                  {(r.profiles?.full_name ?? r.profiles?.email ?? "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-800">
                      {r.profiles?.full_name || r.profiles?.email || "Unknown"}
                    </span>
                    <Badge variant="outline" className="text-xs h-4 px-1">{r.profiles?.role}</Badge>
                    <span className="text-xs text-gray-400 ml-auto">{timeAgo(r.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700">{r.reply_text}</p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Reply input */}
        <div className="border-t pt-3 space-y-2">
          <Textarea
            placeholder="Write a reply…"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={2}
            className="resize-none text-sm"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend(); }}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Ctrl+Enter to send</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
              <Button size="sm" onClick={handleSend} disabled={sending || !replyText.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                Send
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Notification Row ─────────────────────────────────────────────────────────
function NotifRow({
  notif,
  mode,
  onMarkRead,
  onReply,
}: {
  notif: NotificationItem;
  mode: "received" | "sent";
  onMarkRead: (id: string) => void;
  onReply: (n: NotificationItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = getTypeConfig(notif.type);

  return (
    <>
      <TableRow className={`${!notif.is_read && mode === "received" ? "bg-blue-50/40" : ""} hover:bg-gray-50`}>
        {/* Type */}
        <TableCell>
          <span className={cfg.color} title={cfg.label}>{cfg.icon}</span>
        </TableCell>

        {/* Title + message */}
        <TableCell className="max-w-xs">
          <p className={`text-sm ${!notif.is_read && mode === "received" ? "font-semibold text-gray-900" : "font-medium text-gray-800"}`}>
            {notif.title}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{notif.message}</p>
          {(notif.recipient_count ?? 0) > 1 && (
            <Badge variant="outline" className="mt-1 text-xs h-4 px-1.5">
              <Users className="h-2.5 w-2.5 mr-1" />{notif.recipient_count} recipients
            </Badge>
          )}
        </TableCell>

        {/* Sender / Recipient */}
        <TableCell>
          {notif.profiles ? (
            <div>
              <p className="text-sm font-medium text-gray-800">{notif.profiles.full_name || notif.profiles.email}</p>
              <p className="text-xs text-gray-400">{notif.profiles.email}</p>
              <Badge variant="outline" className="mt-1 text-xs h-4 px-1.5 capitalize">{notif.profiles.role}</Badge>
            </div>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </TableCell>

        {/* Status */}
        <TableCell>
          {mode === "received" ? (
            <Badge className={`text-xs ${notif.is_read ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
              {notif.is_read
                ? <><CheckCircle className="h-3 w-3 mr-1" />Read</>
                : <><Clock className="h-3 w-3 mr-1" />Unread</>}
            </Badge>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </TableCell>

        {/* Replies */}
        <TableCell>
          <button
            onClick={() => onReply(notif)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {notif.reply_count ?? 0}
          </button>
        </TableCell>

        {/* Date */}
        <TableCell>
          <div>
            <p className="text-xs text-gray-600">{formatDate(notif.created_at)}</p>
            <p className="text-xs text-gray-400">{timeAgo(notif.created_at)}</p>
          </div>
        </TableCell>

        {/* Actions */}
        <TableCell>
          <div className="flex items-center gap-1">
            {!notif.is_read && mode === "received" && (
              <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => onMarkRead(notif.id)}>
                <CheckCircle className="h-3 w-3 mr-1" />Mark Read
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => onReply(notif)}>
              <Reply className="h-3 w-3 mr-1" />Replies
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => setExpanded((p) => !p)}>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {/* Expanded message */}
      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-gray-50 py-3 px-6">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{notif.message}</p>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NotificationsManagement() {
  const [activeTab, setActiveTab] = useState<"send" | "sent" | "received">("received");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
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
  const [sending, setSending] = useState(false);

  // Recipients data
  const [roles, setRoles] = useState<RecipientOption[]>([]);
  const [schools, setSchools] = useState<RecipientOption[]>([]);
  const [users, setUsers] = useState<RecipientOption[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "read" | "unread">("all");

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
      const { data: responseBody } = await adminApi.notifications.list({ limit: 100, mode });
      const payload = unwrapApiPayload<{ notifications?: NotificationItem[] }>(
        responseBody as Record<string, unknown>,
      );
      const raw: NotificationItem[] = Array.isArray(payload.notifications)
        ? payload.notifications
        : [];

      // For sent mode: group by title+message+timestamp to collapse broadcasts
      let result: NotificationItem[];
      if (mode === "sent") {
        const map = new Map<string, NotificationItem & { recipient_count: number }>();
        for (const n of raw) {
          const key = `${n.title}|${n.message}|${(n.created_at ?? "").slice(0, 16)}`;
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
      // Keep unread badge in sync
      if (mode === "received") {
        setUnreadCount(result.filter((n) => !n.is_read).length);
      }
    } catch (err) {
      toast.error(`Failed to load notifications: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [activeTab]);

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
      });
      const sendPayload = unwrapApiPayload<{ recipients?: number; success?: boolean }>(
        sendBody as Record<string, unknown>,
      );
      toast.success(
        `Sent to ${sendPayload?.recipients ?? 0} recipient${(sendPayload?.recipients ?? 0) !== 1 ? "s" : ""}`,
      );
      setTitle(""); setMessage(""); setNotifType("general");
      setRecipientType("all"); setSelectedRecipients([]);
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

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = notifications.filter((n) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      n.title.toLowerCase().includes(q) ||
      n.message.toLowerCase().includes(q) ||
      (n.profiles?.full_name ?? "").toLowerCase().includes(q) ||
      (n.profiles?.email ?? "").toLowerCase().includes(q);
    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "read" && n.is_read) ||
      (filterStatus === "unread" && !n.is_read);
    return matchSearch && matchStatus;
  });

  // ── Recipient toggle helper ─────────────────────────────────────────────────
  const toggleRecipient = (id: string) =>
    setSelectedRecipients((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const filteredUsers = users.filter((u) =>
    !userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase()) || (u.email ?? "").toLowerCase().includes(userSearch.toLowerCase())
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 mt-1 text-sm">Communicate with all users in the system</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadNotifications(true)} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {([
          { key: "send",     label: "Send Notification", icon: <Send className="h-4 w-4" /> },
          { key: "received", label: `Received${unreadCount > 0 ? ` (${unreadCount})` : ""}`, icon: <Bell className="h-4 w-4" /> },
          { key: "sent",     label: "Sent",              icon: <Megaphone className="h-4 w-4" /> },
        ] as const).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ── SEND TAB ── */}
      {activeTab === "send" && (
        <div className="max-w-2xl space-y-5">
          <div className="bg-white border rounded-2xl p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-900">Compose Notification</h2>

            {/* Type */}
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={notifType} onValueChange={setNotifType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <span className={`flex items-center gap-2 ${v.color}`}>{v.icon}{v.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label>Title <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Notification title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
              <p className="text-xs text-gray-400 text-right">{title.length}/200</p>
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <Label>Message <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Write your message…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={1000}
                className="resize-none"
              />
              <p className="text-xs text-gray-400 text-right">{message.length}/1000</p>
            </div>

            {/* Recipients */}
            <div className="space-y-1.5">
              <Label>Send to</Label>
              <Select value={recipientType} onValueChange={(v) => { setRecipientType(v as typeof recipientType); setSelectedRecipients([]); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all"><span className="flex items-center gap-2"><Users className="h-4 w-4" />All Users</span></SelectItem>
                  <SelectItem value="role"><span className="flex items-center gap-2"><User className="h-4 w-4" />By Role</span></SelectItem>
                  <SelectItem value="school"><span className="flex items-center gap-2"><School className="h-4 w-4" />By School</span></SelectItem>
                  <SelectItem value="individual"><span className="flex items-center gap-2"><User className="h-4 w-4" />Individual Users</span></SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Recipient picker */}
            {recipientType !== "all" && (
              <div className="space-y-1.5">
                <Label>
                  Select {recipientType === "role" ? "Roles" : recipientType === "school" ? "Schools" : "Users"}
                  {selectedRecipients.length > 0 && <span className="ml-2 text-blue-600 font-normal">({selectedRecipients.length} selected)</span>}
                </Label>

                {recipientType === "individual" && (
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input placeholder="Search users…" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-9 h-8 text-sm" />
                  </div>
                )}

                <div className="border rounded-xl max-h-52 overflow-y-auto divide-y">
                  {loadingRecipients ? (
                    <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
                  ) : (
                    (recipientType === "role" ? roles : recipientType === "school" ? schools : filteredUsers).map((item) => (
                      <label key={item.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRecipients.includes(item.id)}
                          onChange={() => toggleRecipient(item.id)}
                          className="rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                          {item.email && <p className="text-xs text-gray-400 truncate">{item.email}</p>}
                        </div>
                        {item.count != null && <Badge variant="outline" className="text-xs">{item.count}</Badge>}
                        {item.role && <Badge variant="outline" className="text-xs capitalize">{item.role}</Badge>}
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-800">
              <span className="font-medium">Recipients: </span>
              {recipientType === "all" && "All users in the system"}
              {recipientType === "role" && (selectedRecipients.length === 0 ? "No roles selected" :
                roles.filter((r) => selectedRecipients.includes(r.id)).map((r) => `${r.name} (${r.count})`).join(", "))}
              {recipientType === "school" && (selectedRecipients.length === 0 ? "No schools selected" :
                `${selectedRecipients.length} school${selectedRecipients.length !== 1 ? "s" : ""}`)}
              {recipientType === "individual" && (selectedRecipients.length === 0 ? "No users selected" :
                `${selectedRecipients.length} user${selectedRecipients.length !== 1 ? "s" : ""}`)}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSend}
                disabled={
                  sending ||
                  !title.trim() ||
                  !message.trim() ||
                  (recipientType !== "all" && selectedRecipients.length === 0)
                }
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
              >
                {sending ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</> : <><Send className="h-4 w-4" />Send Notification</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── RECEIVED / SENT TABS ── */}
      {(activeTab === "received" || activeTab === "sent") && (
        <div className="space-y-4">
          {/* Filters bar */}
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search notifications…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="read">Read</SelectItem>
              </SelectContent>
            </Select>
            {activeTab === "received" && unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-1.5 text-xs">
                <CheckCircle className="h-3.5 w-3.5" />Mark all read
              </Button>
            )}
          </div>

          {/* Table card */}
          <div className="border rounded-2xl overflow-hidden bg-white">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {activeTab === "received" ? "Received Notifications" : "Sent Notifications"}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">{filtered.length} notification{filtered.length !== 1 ? "s" : ""} found</p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Bell className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">No notifications found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-10">Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>{activeTab === "received" ? "From" : "Recipient"}</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-16">Replies</TableHead>
                    <TableHead className="w-36">Sent</TableHead>
                    <TableHead className="w-40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((notif) => (
                    <NotifRow
                      key={notif.id}
                      notif={notif}
                      mode={activeTab}
                      onMarkRead={handleMarkRead}
                      onReply={setReplyTarget}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      )}

      {/* Reply dialog */}
      <ReplyDialog
        notification={replyTarget}
        open={!!replyTarget}
        onClose={() => setReplyTarget(null)}
        onReplySent={handleReplySent}
      />
    </div>
  );
}
