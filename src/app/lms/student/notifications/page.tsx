"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Send } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { requestClose } from "@/hooks/useUnsavedCloseGuard";
import { useStudentNotifications, useMarkNotificationAsRead } from "@/hooks/useStudentData";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { commonApi, studentApi } from "@/lib/api";
import { getStoredUserId } from "@/lib/session-utils";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { queryKeys } from "@/lib/query-keys";
import Modal from "@/components/portal/Modal";
import {
  DAY,
  groupOf,
  initialsOf,
  InboxRun,
  NotificationRow,
  RepliesModal,
  type NotifItem,
  type ReplyItem,
} from "@/components/portal/notifications";

type Recipient = { id: string; name: string | null; email: string; role: string };


export default function NotificationsPage() {
  useDashboardRealtime('student', {
    enabled: true,
    debugLabel: 'student-notifications-page',
    customEventMap: {
      'notification:new': [queryKeys.student.notifications],
      'notification:read': [queryKeys.student.notifications],
      'dashboard:stats': [queryKeys.student.dashboardStats, queryKeys.student.courses, queryKeys.student.assignments],
    },
  });
  const { data: notifications, isLoading } = useStudentNotifications();
  const markAsRead = useMarkNotificationAsRead();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [markingAll, setMarkingAll] = useState(false);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const queryClient = useQueryClient();
  const toast = useToast();
  const myId = typeof window !== "undefined" ? getStoredUserId() : null;

  useEffect(() => {
    setNow(Date.now());
  }, []);

  // Reply thread state
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [activeNotif, setActiveNotif] = useState<{ id: string; title?: string; message?: string; allow_replies?: boolean } | null>(null);
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Send notification state
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendTitle, setSendTitle] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [sendRecipientType, setSendRecipientType] = useState<'role' | 'individual'>('role');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>(['role:teacher']);
  const [availableRecipients, setAvailableRecipients] = useState<Recipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [sending, setSending] = useState(false);

  const loadReplies = async (notificationId: string) => {
    try {
      setLoadingReplies(true);
      const { data } = await commonApi.notifications.reply({ notification_id: notificationId });
      setReplies((data as { replies?: ReplyItem[] })?.replies || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The replies did not load. Try again.');
    } finally {
      setLoadingReplies(false);
    }
  };

  const openReplies = async (notif: { id: string; title?: string; message?: string; allow_replies?: boolean }) => {
    setActiveNotif(notif);
    setReplies([]);
    setReplyText('');
    setReplyDialogOpen(true);
    await loadReplies(notif.id);
  };

  const handleSendReply = async () => {
    if (!activeNotif || !replyText.trim()) return;
    try {
      setSendingReply(true);
      await commonApi.notifications.createReply({
        notification_id: activeNotif.id,
        reply_text: replyText.trim(),
      });
      setReplyText('');
      await loadReplies(activeNotif.id);
      toast.success('Your reply was sent');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Your reply was not sent. Try again.');
    } finally {
      setSendingReply(false);
    }
  };

  const openSendDialog = async () => {
    setSendTitle('');
    setSendMessage('');
    setSendRecipientType('role');
    setSelectedRecipients(['role:teacher']);
    setAvailableRecipients([]);
    setSendDialogOpen(true);
    try {
      setLoadingRecipients(true);
      const { data } = await studentApi.notifications.recipients();
      setAvailableRecipients((data as { users?: Recipient[] })?.users ?? []);
    } catch {
      // silently ignore — user can still send to role:teacher
    } finally {
      setLoadingRecipients(false);
    }
  };

  const isSendDirty =
    sendTitle.trim() !== "" ||
    sendMessage.trim() !== "" ||
    sendRecipientType !== "role" ||
    selectedRecipients.join(",") !== "role:teacher";

  const requestCloseSendDialog = () => {
    void requestClose(isSendDirty, () => setSendDialogOpen(false));
  };

  const requestCloseReplyDialog = () => {
    void requestClose(replyText.trim() !== "", () => {
      setReplyDialogOpen(false);
      setReplyText("");
    });
  };

  const handleSend = async () => {
    if (!sendTitle.trim() || !sendMessage.trim()) {
      toast.error('Add a subject and a message first');
      return;
    }
    if (selectedRecipients.length === 0) {
      toast.error('Pick at least one teacher');
      return;
    }
    try {
      setSending(true);
      await studentApi.notifications.create({
        title: sendTitle.trim(),
        message: sendMessage.trim(),
        recipientType: sendRecipientType,
        recipients: selectedRecipients,
      });
      toast.success('Your message was sent');
      setSendDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Your message was not sent. Try again.');
    } finally {
      setSending(false);
    }
  };

  useSmartRefresh({
    queryKeys: [['studentNotifications']],
    minRefreshInterval: 60000,
  });

  const handleMarkAsRead = async (id?: string) => {
    if (!id) return;
    try {
      await markAsRead.mutateAsync(id as string);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!notifications || notifications.length === 0) return;
    const unread = (notifications as NotifItem[]).filter((n) => !n.is_read && n.id);
    if (unread.length === 0) return;
    try {
      setMarkingAll(true);
      // Single batch request, matching teacher/school-admin/admin — not one
      // PATCH per notification.
      await commonApi.notifications.user.update({ mark_all: true, is_read: true });
      queryClient.invalidateQueries({ queryKey: ["studentNotifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadNotificationCount"] });
    } catch (error) {
      console.error('Error marking all as read:', error);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    queryClient.setQueryData(["studentNotifications"], (prev: unknown) => {
      const arr = Array.isArray(prev) ? (prev as Array<{ id?: string }>) : [];
      return arr.filter((n) => String(n.id) !== String(id));
    });
    try {
      await commonApi.notifications.user.update({ notification_id: id, deleted: true });
      queryClient.invalidateQueries({ queryKey: ["studentNotifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadNotificationCount"] });
    } catch (e) {
      queryClient.invalidateQueries({ queryKey: ["studentNotifications"] });
      console.error(e instanceof Error ? e.message : "Failed to delete notification");
    }
  };

  const all = useMemo(
    () => [...((notifications as NotifItem[] | undefined) ?? [])].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()),
    [notifications],
  );
  const unreadCount = all.filter((n) => !n.is_read).length;
  const list = filter === 'unread' ? all.filter((n) => !n.is_read) : all;

  const startOfToday = now ? new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime() : 0;
  const todayCount = now ? all.filter((n) => new Date(n.created_at ?? 0).getTime() >= startOfToday).length : 0;
  const weekCount = now ? all.filter((n) => new Date(n.created_at ?? 0).getTime() >= now - 7 * DAY).length : 0;

  const groups = useMemo(() => {
    const order = ["Today", "Yesterday", "This week", "Earlier"];
    const map = new Map<string, NotifItem[]>();
    list.forEach((n) => {
      const g = now ? groupOf(n.created_at, startOfToday) : "Earlier";
      map.set(g, [...(map.get(g) ?? []), n]);
    });
    return order.filter((g) => map.has(g)).map((g) => ({ name: g, items: map.get(g)! }));
  }, [list, now, startOfToday]);

  const deleteWithExit = (id: string) => {
    setLeaving(id);
    setTimeout(() => { void handleDelete(id); setLeaving(null); }, 260);
  };

  let status: React.ReactNode;
  if (isLoading) status = "Checking your messages…";
  else if (unreadCount > 0) status = <>You have <strong>{unreadCount} unread</strong>.</>;
  else if (all.length > 0) status = "You are all caught up.";
  else status = "Nothing here yet. News from your teachers and school will show up here.";

  const sendFooter = (
    <>
      <button className="sd-btn sd-btn--line" onClick={requestCloseSendDialog}>Cancel</button>
      <button
        className="sd-btn sd-btn--amber"
        onClick={handleSend}
        disabled={sending || !sendTitle.trim() || !sendMessage.trim() || selectedRecipients.length === 0}
      >
        {sending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
        Send message
      </button>
    </>
  );

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="nt-title">
        <div className="sd-hero-copy">
          <h1 id="nt-title" className="mc-hero-title">Notifications</h1>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            {unreadCount > 0 && (
              <button className="sd-btn sd-btn--amber" onClick={handleMarkAllAsRead} disabled={markingAll}>
                {markingAll ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                Mark all as read
              </button>
            )}
            <button className="sd-btn sd-btn--ghost-dark" onClick={openSendDialog}>
              <Send aria-hidden="true" />Message a teacher
            </button>
          </div>
        </div>
        <div className="sd-run-card">
          <InboxRun items={all} />
          <div className="sd-run-foot">
            <b>{unreadCount}<small>unread</small></b>
            <span>{all.length > 12 ? "Your 12 newest, amber means unread" : "Amber means unread"}</span>
          </div>
        </div>
      </section>

      <div className="sd-ledger">
        <div><span className="sd-l">Unread</span><b className="sd-n">{unreadCount}</b><small>Still to read</small></div>
        <div><span className="sd-l">Today</span><b className="sd-n">{todayCount}</b><small>Arrived today</small></div>
        <div><span className="sd-l">This week</span><b className="sd-n">{weekCount}</b><small>Last 7 days</small></div>
        <div><span className="sd-l">All</span><b className="sd-n">{all.length}</b><small>In your inbox</small></div>
      </div>

      <div className="mc-tabs" role="tablist" aria-label="Which notifications to show" style={{ justifySelf: "start" }}>
        {([
          { id: "all", label: "All", count: all.length },
          { id: "unread", label: "Unread", count: unreadCount },
        ] as const).map((t) => (
          <button key={t.id} role="tab" className="mc-tab" aria-selected={filter === t.id} onClick={() => setFilter(t.id)}>
            {t.label}<b>{t.count}</b>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : list.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>{filter === 'unread' ? "You are all caught up" : "No notifications yet"}</b>
            <p>{filter === 'unread' ? "Nothing is waiting for you." : "Messages from your teachers and school will show up here."}</p>
            {filter === 'unread' && all.length > 0 && <button className="sd-btn sd-btn--line" onClick={() => setFilter('all')}>See everything</button>}
          </div>
        </section>
      ) : (
        <div key={filter} className="sd-panel as-list mc-swap">
          {groups.map((g) => (
            <div key={g.name}>
              <p className="as-group">{g.name}<span>{g.items.length}</span></p>
              {g.items.map((n, i) => (
                <NotificationRow
                  key={n.id ?? i}
                  n={n}
                  now={now || Date.now()}
                  leaving={leaving === n.id}
                  onRead={() => handleMarkAsRead(n.id)}
                  onReplies={() => openReplies(n)}
                  onDelete={() => deleteWithExit(n.id)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={sendDialogOpen}
        onClose={requestCloseSendDialog}
        title="Message your teacher"
        subtitle="Your message goes to teachers in your school."
        footer={sendFooter}
      >
        <div className="sd-field-wrap">
          <label>Who is it for?</label>
          <div className="as-chips" role="group" aria-label="Who is it for">
            <button className="as-chip" aria-pressed={sendRecipientType === 'role'} onClick={() => { setSendRecipientType('role'); setSelectedRecipients(['role:teacher']); }}>All teachers</button>
            <button className="as-chip" aria-pressed={sendRecipientType === 'individual'} onClick={() => { setSendRecipientType('individual'); setSelectedRecipients([]); }}>One or more teachers</button>
          </div>
        </div>

        {sendRecipientType === 'individual' && (
          <div className="sd-field-wrap">
            <label>Pick your teachers</label>
            {loadingRecipients ? (
              <p className="as-fine" style={{ margin: 0 }}><Loader2 className="mr-1 inline h-4 w-4 animate-spin" aria-hidden="true" />Finding teachers…</p>
            ) : availableRecipients.length === 0 ? (
              <p className="as-fine" style={{ margin: 0 }}>We could not find teachers in your school.</p>
            ) : (
              <div className="nt-pick">
                {availableRecipients.map((r) => {
                  const selected = selectedRecipients.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      aria-pressed={selected}
                      onClick={() => setSelectedRecipients((prev) => (selected ? prev.filter((x) => x !== r.id) : [...prev, r.id]))}
                    >
                      <span className="sd-avatar" aria-hidden="true">{initialsOf(r.name || r.email)}</span>
                      <span>{r.name || r.email}</span>
                      {selected && <Check className="nt-check" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="sd-field-wrap">
          <label htmlFor="send-title">Subject</label>
          <input id="send-title" className="sd-field" placeholder="What is it about?" value={sendTitle} onChange={(e) => setSendTitle(e.target.value)} />
        </div>
        <div className="sd-field-wrap">
          <label htmlFor="send-message">Message</label>
          <textarea id="send-message" className="sd-field" placeholder="Write your message" rows={4} value={sendMessage} onChange={(e) => setSendMessage(e.target.value)} />
        </div>
      </Modal>

      <RepliesModal
        open={replyDialogOpen}
        onClose={requestCloseReplyDialog}
        title={activeNotif?.title}
        subtitle={activeNotif?.message}
        allowReplies={activeNotif?.allow_replies}
        replies={replies}
        loading={loadingReplies}
        text={replyText}
        onText={setReplyText}
        onSend={handleSendReply}
        sending={sendingReply}
        myId={myId}
        now={now || Date.now()}
      />
    </div>
  );
}
