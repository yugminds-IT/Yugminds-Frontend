"use client";

import { useState, useEffect } from "react";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { Check, RefreshCw, Send } from "lucide-react";
import { ChipGroup, NotificationComposer, NotificationRow, NotificationsHero, Pager, RecipientList, RepliesModal } from "@/components/portal/notifications";
import { getStoredUserId } from "@/lib/session-utils";
import { useTeacherSchool } from "../context";
import { commonApi, teacherApi } from "@/lib/api";
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
  recipient_count?: number;
  notification_ids?: string[]; // All notification IDs in this group
}

interface RecipientOption {
  id: string;
  name: string;
  count?: number;
  email?: string;
  role?: string;
  isActive?: boolean;
}

const PAGE_SIZE = 20;

export default function TeacherNotifications() {
  const { selectedSchool } = useTeacherSchool();
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'send' | 'view'>('send');

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
  // Default to "received" — the previous unconditional mode='all' fetch
  // silently mixed sent notifications into what this tab labeled "Sent".
  const [notificationMode, setNotificationMode] = useState<'all' | 'sent' | 'received'>('received');

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

  useDashboardRealtime('teacher', {
    enabled: !!selectedSchool?.id,
    debugLabel: 'teacher-notifications-page',
    onEvent: ({ eventType }) => {
      if (eventType === 'notification:new' || eventType === 'notification:read') {
        loadNotifications();
      }
    },
  });

  useEffect(() => {
    loadNotifications();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- loadNotifications reads current state directly
  }, [selectedSchool, notificationMode, offset, searchQuery, filterStatus]);

  useEffect(() => {
    loadRecipients();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- load when school changes only
  }, [selectedSchool]);

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

  const loadNotifications = async () => {
    try {
      setLoading(true);
      if (!selectedSchool?.id) {
        setLoading(false);
        return;
      }
      const { data } = await teacherApi.notifications.list({
        limit: PAGE_SIZE,
        offset,
        mode: notificationMode,
        search: searchQuery.trim() || undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
      });
      const typed = data as { notifications?: Notification[]; total?: number };
      const rawNotifications: (Notification & { broadcast_id?: string | null })[] =
        typed.notifications || [];
      setTotal(typed.total ?? rawNotifications.length);
      // Dedupe/group notifications for "sent/all" views: the DB stores one
      // notification row per recipient (user_id), so a single broadcast
      // looks like many rows. Group by the notification's own broadcast_id
      // (falls back to its own id for legacy single-recipient sends, i.e.
      // no merge) — matches the admin/school-admin dashboards exactly,
      // instead of a fragile type+title+message+second-granularity
      // heuristic that could mis-merge or mis-split two same-second sends.
      const groupedNotifications: (Notification & { recipient_count?: number; notification_ids?: string[] })[] =
        notificationMode === 'received'
          ? rawNotifications
          : (() => {
              const byKey = new Map<string, (Notification & { recipient_count?: number; notification_ids?: string[] })>();
              for (const n of rawNotifications) {
                const key = n.broadcast_id ?? n.id;
                const existing = byKey.get(key);
                if (existing) {
                  existing.recipient_count = (existing.recipient_count || 1) + 1;
                  if (!existing.notification_ids) existing.notification_ids = [existing.id];
                  existing.notification_ids.push(n.id);
                  if (!n.is_read) existing.is_read = false;
                } else {
                  byKey.set(key, { ...n, recipient_count: 1, notification_ids: [n.id] });
                }
              }
              return Array.from(byKey.values());
            })();

        // Load reply counts for each notification
        const notificationsWithReplies = await Promise.all(
          groupedNotifications.map(async (notif: Notification) => {
            const { data: repliesData } = await commonApi.notifications.reply({ notification_id: notif.id });
            const repliesTyped = repliesData as { replies?: Reply[] };
            return {
              ...notif,
              replies: repliesTyped.replies || [],
              reply_count: repliesTyped.replies?.length || 0
            };
          })
        );
        setNotifications(notificationsWithReplies);

    } catch (error: unknown) {
      console.error('Error loading notifications:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error loading notifications: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Any filter/mode change invalidates the current page.
  useEffect(() => {
    setOffset(0);
  }, [notificationMode, searchQuery, filterStatus]);

  const loadReplies = async (notificationId: string) => {
    try {
      setLoadingReplies(true);
      const { data } = await commonApi.notifications.reply({ notification_id: notificationId });
      const typed = data as { replies?: Reply[] };
      setReplies(typed.replies || []);
     
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
      await commonApi.notifications.createReply({
        notification_id: selectedNotification.id,
        reply_text: replyText.trim(),
      });
      setReplyText('');
      await loadReplies(selectedNotification.id);
      // Keep the reply_count badge in the list in sync
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

  const loadRecipients = async () => {
    try {
      setLoadingRecipients(true);
      const { data } = await teacherApi.notifications.recipients({ school_id: selectedSchool?.id });
      const typed = data as { roles?: RecipientOption[]; users?: RecipientOption[] };
      setRoles(typed.roles || []);
      setUsers(typed.users || []);
     
    } catch (error: unknown) {
      console.error('Error loading recipients:', error);
    } finally {
      setLoadingRecipients(false);
    }
  };

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
      const { data } = await teacherApi.notifications.create({
        title: title.trim(),
        message: message.trim(),
        type,
        recipientType,
        recipients: selectedRecipients,
        school_id: selectedSchool?.id,
        allowReplies,
      });
      const typed = data as { sent?: number };
      toast.success(`Successfully sent ${typed.sent || 0} notifications`);
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
     
    } catch (error: unknown) {
      console.error('Error sending notification:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error sending notification: ${msg}`);
    } finally {
      setSending(false);
    }
  };

  const handleMarkAsRead = async (notification: Notification) => {
    try {
      // Get all notification IDs in this group (if grouped) or just the single ID
      const notificationIds = notification.notification_ids || [notification.id];
      
      // Optimistically update local state immediately
      setNotifications(prev =>
        prev.map((n: Notification) => 
          n.id === notification.id 
            ? { ...n, is_read: true } 
            : n
        )
      );
      
      // Mark all notifications in the group as read
      const updatePromises = notificationIds.map(async (id: string) => {
        try {
          await teacherApi.notifications.markRead(id);
          return { ok: true, id, errorData: {} as { error?: string; details?: string; message?: string } };
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          return { ok: false, id, errorData: { error: msg } as { error?: string; details?: string; message?: string } };
        }
      });

      const results = await Promise.all(updatePromises);
      const allSuccessful = results.every(r => r.ok);

      if (allSuccessful) {
        toast.success('Notification marked as read');
      } else {
        // Revert optimistic update on error
        setNotifications(prev =>
          prev.map((n: Notification) => 
            n.id === notification.id 
              ? { ...n, is_read: false } 
              : n
          )
        );
        
        // Extract error messages
        const failedResults = results.filter(r => !r.ok);
        const errorMessages = failedResults.map(r => 
          r.errorData.details || r.errorData.error || r.errorData.message || 'Unknown error'
        );
        const uniqueErrors = [...new Set(errorMessages)];
        
        console.error('Failed to mark teacher notification as read:', {
          failedCount: failedResults.length,
          totalCount: notificationIds.length,
          errors: uniqueErrors,
          failedIds: failedResults.map(r => r.id)
        });
        
        if (failedResults.length < notificationIds.length) {
          toast.error(`Some notifications could not be marked as read: ${uniqueErrors.join(', ')}`);
        } else {
          toast.error(`Failed to mark as read: ${uniqueErrors.join(', ') || 'Unknown error'}`);
        }
      }
    } catch (error: unknown) {
      setNotifications(prev =>
        prev.map((n: Notification) => 
          n.id === notification.id 
            ? { ...n, is_read: false } 
            : n
        )
      );
      console.error('Error marking teacher notification as read:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error marking as read: ${msg}`);
    }
  };

  // Delete/mark-all-read only make sense for "received" — the underlying
  // rows in "sent"/"all" mode belong to the recipient, not this teacher, so
  // the backend's ownership check on these actions would reject them (same
  // class of bug the mark-as-read button used to hit for sent rows).
  const handleDelete = async (notification: Notification) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    setTotal((t) => Math.max(0, t - 1));
    try {
      await commonApi.notifications.user.update({ notification_id: notification.id, deleted: true });
      toast.success('Notification dismissed');
    } catch (err) {
      await loadNotifications();
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
          description="Send to teachers or students in your school."
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
              {notifications.map((n) => {
                const who = n.profiles?.full_name || 'Unknown user';
                const more = (n.recipient_count ?? 1) - 1;
                return (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    now={now || Date.now()}
                    replyCount={n.reply_count}
                    meta={<span>{who}{more > 0 ? ` and ${more} more` : ''}</span>}
                    onRead={notificationMode === 'received' ? () => handleMarkAsRead(n) : undefined}
                    onReplies={() => handleViewReplies(n)}
                    onDelete={notificationMode === 'received' ? () => handleDelete(n) : undefined}
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
