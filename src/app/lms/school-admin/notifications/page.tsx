"use client";

import { useState, useEffect, useCallback } from "react";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { Check, RefreshCw, Send } from "lucide-react";
import { BulkBar, ChipGroup, NotificationComposer, NotificationRow, NotificationsHero, Pager, RecipientList, RepliesModal, SelectStrip } from "@/components/portal/notifications";
import { useBulkNotifications } from "@/hooks/useBulkNotifications";
import { useSchoolAdmin } from "@/contexts/SchoolAdminContext";
import { useRouter } from "next/navigation";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { commonApi, setAuthToken } from "@/lib/api";
import { getSession, getStoredUserId } from "@/lib/session-utils";
import { queryKeys } from "@/lib/query-keys";
import { useToast } from "@/components/ui/toast";
import { requestClose } from "@/hooks/useUnsavedCloseGuard";

interface Reply {
  id: string;
  notification_id: string;
  user_id: string;
  reply_text: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
}

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  allow_replies?: boolean;
  created_at: string;
  profiles?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    school_id: string;
  };
  replies?: Reply[];
  reply_count?: number;
}

interface RecipientOption {
  id: string;
  name: string;
  count?: number;
  email?: string;
  role?: string;
  isActive?: boolean;
}

export default function SchoolAdminNotifications() {
  const router = useRouter();
  const { schoolInfo } = useSchoolAdmin();
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'send' | 'view'>('view');

  // Send notification form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('general');
  const [recipientType, setRecipientType] = useState<'role' | 'individual'>('role');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [allowReplies, setAllowReplies] = useState(true);

  // Recipients data
  const [roles, setRoles] = useState<RecipientOption[]>([]);
  const [users, setUsers] = useState<RecipientOption[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // View filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'read' | 'unread'>('all');
  // Default to "received" to avoid showing one row per-recipient when admins broadcast.
  const [notificationMode, setNotificationMode] = useState<'all' | 'sent' | 'received'>('received');
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 20;

  // Reply dialog state
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const requestCloseReplyDialog = () => {
    void requestClose(replyText.trim() !== "", () => {
      setReplyDialogOpen(false);
      setReplyText("");
    });
  };

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await schoolAdminApi.notifications.list({
        limit: PAGE_SIZE,
        offset,
        school_id: schoolInfo?.id,
        mode: notificationMode,
        search: searchQuery.trim() || undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
      });

      const data = response.data ?? {};

      if (true) {
        // Dedupe notifications for "sent/all" views:
        // The DB stores one notification row per recipient (user_id),
        // so a single broadcast looks like many rows. Group by the
        // notification's own broadcast_id (falls back to its own id for
        // legacy single-recipient sends, i.e. no merge) — matches the
        // admin dashboard's grouping exactly, instead of a fragile
        // type+title+message+second-granularity heuristic that could
        // mis-merge or mis-split two same-second broadcasts.
        const rawNotifications: (Notification & { broadcast_id?: string | null })[] =
          (data as { notifications?: Notification[] }).notifications ??
          ((Array.isArray(data) ? data : []) as Notification[]);
        setTotal((data as { total?: number }).total ?? rawNotifications.length);
        const normalizedNotifications: (Notification & { recipient_count?: number })[] =
          notificationMode === 'received'
            ? rawNotifications
            : (() => {
                const byKey = new Map<string, (Notification & { recipient_count: number })>();
                for (const n of rawNotifications) {
                  const key = n.broadcast_id ?? n.id;
                  const existing = byKey.get(key);
                  if (existing) {
                    existing.recipient_count += 1;
                  } else {
                    byKey.set(key, { ...n, recipient_count: 1 });
                  }
                }
                return Array.from(byKey.values());
              })();

        // Load reply counts for each notification
        const notificationsWithReplies = await Promise.all(
          normalizedNotifications.map(async (notif: Notification) => {
            const { data: repliesData } = await commonApi.notifications.reply({
              notification_id: notif.id,
            });
            return {
              ...notif,
              replies: (repliesData as { replies?: Reply[] })?.replies || [],
              reply_count: (repliesData as { replies?: Reply[] })?.replies?.length || 0
            };
          })
        );
        setNotifications(notificationsWithReplies);
      }
    } catch (error: unknown) {
      console.error('Error loading notifications:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error loading notifications: ${msg}`);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationMode, schoolInfo?.id, offset, searchQuery, filterStatus]);

  // Any filter/mode change invalidates the current page.
  useEffect(() => {
    setOffset(0);
  }, [notificationMode, searchQuery, filterStatus]);

  useDashboardRealtime('school_admin', {
    enabled: true,
    debugLabel: 'school-admin-notifications-page',
    customEventMap: {
      'notification:new': [queryKeys.schoolAdmin.notifications],
      'notification:read': [queryKeys.schoolAdmin.notifications],
      'dashboard:stats': [queryKeys.schoolAdmin.dashboardStats],
    },
    onEvent: ({ eventType }) => {
      if (eventType === 'notification:new' || eventType === 'notification:read') {
        loadNotifications();
      }
    },
  });

  const loadReplies = async (notificationId: string) => {
    try {
      setLoadingReplies(true);
      const { data: { session } } = await getSession();
      
      if (!session?.access_token) {
        toast.error('Authentication error. Please log in again.');
        setLoadingReplies(false);
        return;
      }

      setAuthToken(session.access_token);
      
      const { data } = await commonApi.notifications.reply({ notification_id: notificationId });
      setReplies((data as { replies?: Reply[] })?.replies || []);
     
    } catch (error: unknown) {
      console.error('Error loading replies:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error loading replies: ${msg}`);
    } finally {
      setLoadingReplies(false);
    }
  };

  const handleViewReplies = async (notification: Notification) => {
    setSelectedNotification(notification);
    setReplyText('');
    setReplyDialogOpen(true);
    await loadReplies(notification.id);
  };

  const handleSendReply = async () => {
    if (!selectedNotification || !replyText.trim()) return;
    try {
      setSendingReply(true);
      const { data: { session } } = await getSession();
      if (!session?.access_token) {
        toast.error('Authentication error. Please log in again.');
        return;
      }
      setAuthToken(session.access_token);
      await commonApi.notifications.createReply({
        notification_id: selectedNotification.id,
        reply_text: replyText.trim(),
      });
      setReplyText('');
      await loadReplies(selectedNotification.id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === selectedNotification.id
            ? { ...n, reply_count: (n.reply_count ?? 0) + 1 }
            : n
        )
      );
      toast.success('Reply sent');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to send reply: ${msg}`);
    } finally {
      setSendingReply(false);
    }
  };

  const loadRecipients = useCallback(async () => {
    try {
      setLoadingRecipients(true);
      const response = await schoolAdminApi.notifications.recipients({
        school_id: schoolInfo?.id,
      });
      const data = response.data ?? {};

      setRoles((data as { roles?: RecipientOption[] }).roles || []);
      setUsers((data as { users?: RecipientOption[] }).users || []);
    } catch (error: unknown) {
      console.error('Error loading recipients:', error);
    } finally {
      setLoadingRecipients(false);
    }
  }, [schoolInfo?.id]);

  useEffect(() => {
    loadNotifications();
    loadRecipients();
  }, [loadNotifications, loadRecipients]);

  // Use smart refresh for tab switching
  useSmartRefresh({
    customRefresh: () => {
      loadNotifications();
      loadRecipients();
    },
    minRefreshInterval: 60000, // 1 minute minimum between refreshes
    hasUnsavedData: () => {
      // Check if form has unsaved data
      return (title.trim() !== '' || message.trim() !== '') && activeTab === 'send';
    },
  });

  const handleSendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    if (selectedRecipients.length === 0) {
      toast.error('Please select at least one recipient');
      return;
    }

    setSending(true);
    try {
      const response = await schoolAdminApi.notifications.create({
        title: title.trim(),
        message: message.trim(),
        type,
        recipientType,
        recipients: selectedRecipients,
        school_id: schoolInfo?.id,
        allowReplies,
      });

      const data = response.data ?? {};

      if (true) {
        toast.success(`Successfully sent ${(data as { sent?: number }).sent || 0} notifications`);
        setTitle('');
        setMessage('');
        setType('general');
        setRecipientType('role');
        setSelectedRecipients([]);
        setAllowReplies(true);
        // Reload notifications
        await loadNotifications();
        // Switch to view tab
        setActiveTab('view');
      }
    } catch (error: unknown) {
      console.error('Error sending notification:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error sending notification: ${msg}`);
    } finally {
      setSending(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      // Find the notification to update optimistically
      const notification = notifications.find((n: Notification) => n.id === notificationId);
      setNotifications(prev =>
        prev.map((n: Notification) => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      
      console.log('Marking school-admin notification as read via schoolAdminApi:', {
        notificationId,
        notification,
      });

      try {
        await schoolAdminApi.notifications.update(notificationId, { is_read: true });
      } catch (err) {
        setNotifications(prev =>
          prev.map((n: Notification) => n.id === notificationId ? { ...n, is_read: false } : n)
        );
        console.error('Failed to mark school-admin notification as read:', err);
        toast.error(`Failed to mark as read: ${err instanceof Error ? err.message : 'Unknown error'}`);
        return;
      }
    } catch (error: unknown) {
      setNotifications(prev =>
        prev.map((n: Notification) => n.id === notificationId ? { ...n, is_read: false } : n)
      );
      console.error('Error marking school-admin notification as read:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error marking as read: ${msg}`);
    }
  };

  // Delete/mark-all-read only make sense for "received" — the underlying
  // rows in "sent"/"all" mode belong to the recipient (userId), not this
  // school admin, so the backend's ownership check on these actions would
  // reject them (same class of bug the mark-as-read button used to hit).
  const handleDelete = async (notificationId: string) => {
    const removed = notifications.find((n) => n.id === notificationId);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    setTotal((t) => Math.max(0, t - 1));
    try {
      await commonApi.notifications.user.update({ notification_id: notificationId, deleted: true });
      toast.success('Notification dismissed');
    } catch (err) {
      if (removed) setNotifications((prev) => [...prev, removed].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ));
      setTotal((t) => t + 1);
      toast.error(`Failed to dismiss: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await commonApi.notifications.user.update({ mark_all: true, is_read: true });
      toast.success('All notifications marked as read');
    } catch (err) {
      await loadNotifications();
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleRecipientToggle = (id: string) => {
    setSelectedRecipients(prev =>
      prev.includes(id)
        ? prev.filter((r: string) => r !== id)
        : [...prev, id]
    );
  };

  const unreadShown = notifications.filter((n) => !n.is_read).length;
  const modeWord = notificationMode === 'sent' ? 'sent' : notificationMode === 'received' ? 'received' : 'in your list';
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); }, [notifications]);
  const myId = typeof window !== 'undefined' ? getStoredUserId() : null;
  const canSend = !sending && !!title.trim() && !!message.trim() && selectedRecipients.length > 0;


  // Select several and mark read / unread, or delete (your own inbox only).
  const bulk = useBulkNotifications({
    items: notifications,
    setItems: setNotifications,
    status: filterStatus,
    resetKey: `${notificationMode}|${filterStatus}|${searchQuery}|${offset}`,
    onRemoved: (n) => setTotal((t) => Math.max(0, t - n)),
  });
  return (
    <div className="sd-page">
      <NotificationsHero
        items={notifications}
        unread={unreadShown}
        status={
          activeTab === 'send'
            ? 'Write a message for your school. Pick who gets it.'
            : loading
              ? 'Checking your messages…'
              : <><strong>{total}</strong> {modeWord}{notificationMode === 'received' && unreadShown > 0 ? <> · <strong>{unreadShown} unread</strong> here</> : null}.</>
        }
        actions={activeTab === 'view' && (
          <>
            {notificationMode === 'received' && unreadShown > 0 && (
              <button className="sd-btn sd-btn--amber" onClick={handleMarkAllRead}><Check aria-hidden="true" />Mark all read</button>
            )}
            <button className="sd-btn sd-btn--ghost-dark" onClick={() => setActiveTab('send')}><Send aria-hidden="true" />New notification</button>
          </>
        )}
      />

      <div className="mc-tabs" role="tablist" aria-label="Notifications" style={{ justifySelf: "start" }}>
        {([['view', 'View notifications'], ['send', 'Send notification']] as const).map(([id, label]) => (
          <button key={id} role="tab" className="mc-tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </div>

      {activeTab === 'send' ? (
        <NotificationComposer
          description="Send to teachers, students or specific people in your school."
          title={title} onTitle={setTitle}
          message={message} onMessage={setMessage}
          type={type} onType={setType}
          allowReplies={allowReplies} onAllowReplies={setAllowReplies}
          canSend={canSend} sending={sending} onSend={handleSendNotification}
        >
          <div className="sd-field-wrap">
            <label>Who is it for?</label>
            <ChipGroup
              label="Who is it for?"
              value={recipientType}
              options={[['role', 'Whole groups'], ['individual', 'Individual people']] as const}
              onChange={(v) => { setRecipientType(v); setSelectedRecipients([]); }}
            />
          </div>
          <div className="sd-field-wrap">
            <label>{recipientType === 'role' ? 'Pick groups' : 'Pick people'}</label>
            <RecipientList
              items={recipientType === 'role' ? roles : users}
              selected={selectedRecipients}
              onToggle={handleRecipientToggle}
              loading={loadingRecipients}
              avatars={recipientType === 'individual'}
            />
          </div>
        </NotificationComposer>
      ) : (
        <>
          <div className="nt-bar">
            <input
              type="search"
              className="sd-field"
              placeholder="Search notifications"
              aria-label="Search notifications"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <ChipGroup label="Which notifications" value={notificationMode} options={[['received', 'Received'], ['sent', 'Sent'], ['all', 'All']] as const} onChange={setNotificationMode} />
            <ChipGroup label="Read status" value={filterStatus} options={[['all', 'Any'], ['unread', 'Unread'], ['read', 'Read']] as const} onChange={setFilterStatus} />
            <button className="pl-ico" onClick={loadNotifications} aria-label="Refresh" title="Refresh"><RefreshCw /></button>
          </div>

          {loading ? (
            <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
          ) : notifications.length === 0 ? (
            <section className="sd-panel">
              <div className="sd-empty">
                <b>No notifications found</b>
                <p>{searchQuery || filterStatus !== 'all' ? 'Try a different search or filter.' : 'Messages you send or receive will show up here.'}</p>
              </div>
            </section>
          ) : (
            <div className="sd-panel as-list mc-swap">
              {notificationMode === 'received' && (
                <SelectStrip count={notifications.length} picked={bulk.selected.size} onToggleAll={bulk.toggleAll} />
              )}
              {notifications.map((n) => {
                const who = n.profiles?.full_name || 'Unknown user';
                const count = (n as Notification & { recipient_count?: number }).recipient_count ?? 1;
                const isReset = n.title.toLowerCase().includes('password reset request');
                return (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    now={now || Date.now()}
                    replyCount={n.reply_count}
                    meta={<span>{who}{count > 1 ? ` and ${count - 1} more` : ''}</span>}
                    extra={isReset && (
                      <button className="nt-more" onClick={() => router.push('/lms/school-admin/password-reset-requests')}>
                        Open password reset requests
                      </button>
                    )}
                    onRead={notificationMode === 'received' ? () => handleMarkAsRead(n.id) : undefined}
                    onUnread={notificationMode === 'received' ? () => void bulk.run('unread', [n.id]) : undefined}
                    selected={bulk.selected.has(n.id)}
                    onSelect={notificationMode === 'received' ? () => bulk.toggleOne(n.id) : undefined}
                    onReplies={() => handleViewReplies(n)}
                    onDelete={notificationMode === 'received' ? () => handleDelete(n.id) : undefined}
                  />
                );
              })}
              <Pager
                offset={offset} count={notifications.length} total={total} pageSize={PAGE_SIZE} busy={loading}
                onPrev={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                onNext={() => setOffset((o) => o + PAGE_SIZE)}
              />
            </div>
          )}
        </>
      )}

      {notificationMode === 'received' && bulk.selected.size > 0 && (
        <BulkBar
          count={bulk.selected.size}
          busy={bulk.busy}
          onRead={() => void bulk.run('read', [...bulk.selected])}
          onUnread={() => void bulk.run('unread', [...bulk.selected])}
          onDelete={() => void bulk.remove([...bulk.selected])}
          onClear={bulk.clear}
        />
      )}

      <RepliesModal
        open={replyDialogOpen}
        onClose={requestCloseReplyDialog}
        title={selectedNotification?.title}
        subtitle={selectedNotification?.message}
        allowReplies={selectedNotification?.allow_replies}
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
