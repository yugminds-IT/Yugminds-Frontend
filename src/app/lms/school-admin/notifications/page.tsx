"use client";

import { useState, useEffect, useCallback } from "react";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { 
  Bell, 
  Send, 
  User,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  Info,
  RefreshCw,
  Reply,
  MessageSquare
} from "lucide-react";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useSchoolAdmin } from "@/contexts/SchoolAdminContext";
import { useRouter } from "next/navigation";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { commonApi, setAuthToken } from "@/lib/api";
import { getSession } from "@/lib/session-utils";
import { queryKeys } from "@/lib/query-keys";
import { useToast } from "@/components/ui/toast";
import { formatNotificationType } from "@/lib/notification-format";

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-600 mt-2">Send and manage notifications for your school</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'send' | 'view')}>
        <TabsList>
          <TabsTrigger value="send">Send Notification</TabsTrigger>
          <TabsTrigger value="view">View Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send Notification
              </CardTitle>
              <CardDescription>
                Send notifications to teachers, students, or specific users in your school
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
                <Input
                  id="title"
                  placeholder="Enter notification title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message <span className="text-red-500">*</span></Label>
                <Textarea
                  id="message"
                  placeholder="Enter notification message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Recipients <span className="text-red-500">*</span></Label>
                <Select value={recipientType} onValueChange={(v) => {
                  setRecipientType(v as 'role' | 'individual');
                  setSelectedRecipients([]);
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="role">By Role (Teachers, Students)</SelectItem>
                    <SelectItem value="individual">Individual Users</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recipientType === 'role' && (
                <div className="space-y-2">
                  <Label>Select Roles</Label>
                  {loadingRecipients ? (
                    <p className="text-sm text-gray-500">Loading roles...</p>
                  ) : (
                    <div className="space-y-2 border rounded-lg p-4 max-h-48 overflow-y-auto">
                      {roles.map((role) => (
                        <label key={role.id} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedRecipients.includes(role.id)}
                            onChange={() => handleRecipientToggle(role.id)}
                            className="rounded border-gray-300 text-blue-600"
                          />
                          <span className="text-sm">
                            {role.name} {role.count && `(${role.count})`}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {recipientType === 'individual' && (
                <div className="space-y-2">
                  <Label>Select Users</Label>
                  {loadingRecipients ? (
                    <p className="text-sm text-gray-500">Loading users...</p>
                  ) : (
                    <div className="space-y-2 border rounded-lg p-4 max-h-48 overflow-y-auto">
                      {users.map((user) => (
                        <label key={user.id} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedRecipients.includes(user.id)}
                            onChange={() => handleRecipientToggle(user.id)}
                            className="rounded border-gray-300 text-blue-600"
                          />
                          <span className="text-sm">
                            {user.name} {user.email && `(${user.email})`}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Allow replies toggle */}
              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="allow-replies" className="flex items-center gap-2">
                    <Reply className="h-4 w-4 text-muted-foreground" />
                    Allow recipients to reply
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {allowReplies
                      ? 'Recipients can reply to start a conversation.'
                      : 'One-way announcement — replies are turned off.'}
                  </p>
                </div>
                <Switch id="allow-replies" checked={allowReplies} onCheckedChange={setAllowReplies} />
              </div>

              <Button
                onClick={handleSendNotification}
                disabled={sending || !title.trim() || !message.trim() || selectedRecipients.length === 0}
                className="w-full"
              >
                {sending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Notification
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="view" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    {notificationMode === 'sent' ? 'Sent Notifications' : 
                     notificationMode === 'received' ? 'Received Notifications' : 
                     'All Notifications'}
                  </CardTitle>
                  <CardDescription>
                    {notificationMode === 'sent' ? 'View all notifications you\'ve sent' :
                     notificationMode === 'received' ? 'View all notifications you\'ve received' :
                     'View all notifications'}
                    {' '}· {total} notification{total !== 1 ? 's' : ''}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {notificationMode === 'received' && notifications.some((n) => !n.is_read) && (
                    <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark all read
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={loadNotifications}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search notifications..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as 'all' | 'read' | 'unread')}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={notificationMode} onValueChange={(v) => setNotificationMode(v as 'all' | 'sent' | 'received')}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="received">Received by Me</SelectItem>
                    <SelectItem value="sent">Sent (Grouped)</SelectItem>
                    <SelectItem value="all">All (Grouped)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">Loading notifications...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">No notifications found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`border rounded-lg p-4 ${notification.is_read ? 'bg-gray-50' : 'bg-white border-blue-200'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {(() => {
                              const TypeIcon = formatNotificationType(notification.type).icon;
                              return <TypeIcon className="h-4 w-4 text-gray-500" />;
                            })()}
                            <h3
                              className={`font-semibold ${!notification.is_read ? 'font-bold' : ''} text-gray-900 cursor-pointer hover:text-blue-600`}
                              onClick={() => {
                                if (notification.title.toLowerCase().includes('password reset request')) {
                                  router.push('/lms/school-admin/password-reset-requests');
                                }
                              }}
                            >
                              {notification.title}
                            </h3>
                            <Badge className={formatNotificationType(notification.type).badgeClassName}>
                              {formatNotificationType(notification.type).label}
                            </Badge>
                            {(notification as Notification & { recipient_count?: number }).recipient_count != null && (notification as Notification & { recipient_count?: number }).recipient_count! > 1 && (
                              <Badge variant="outline" className="bg-gray-50 text-gray-700">
                                {(notification as Notification & { recipient_count?: number }).recipient_count ?? 0} recipients
                              </Badge>
                            )}
                            {!notification.is_read && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                Unread
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                          {notification.title.toLowerCase().includes('password reset request') && (
                            <Button
                              variant="link"
                              size="sm"
                              className="mt-2 p-0 h-auto text-blue-600 hover:text-blue-800"
                              onClick={() => router.push('/lms/school-admin/password-reset-requests')}
                            >
                              View Password Reset Requests →
                            </Button>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {notification.profiles?.full_name || 'Unknown User'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(notification.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {notification.reply_count && notification.reply_count > 0 && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {notification.reply_count}
                            </Badge>
                          )}
                          {notificationMode === 'received' && !notification.is_read && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarkAsRead(notification.id)}
                            >
                              Mark as read
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewReplies(notification)}
                            className="flex items-center gap-1"
                          >
                            <Reply className="h-3 w-3" />
                            View Replies
                          </Button>
                          {notificationMode === 'received' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(notification.id)}
                            >
                              Dismiss
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {total > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-4 mt-4 border-t text-sm text-gray-600">
                  <span>
                    Showing {notifications.length === 0 ? 0 : offset + 1}–{offset + notifications.length} of {total}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset === 0 || loading}
                      onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset + PAGE_SIZE >= total || loading}
                      onClick={() => setOffset((o) => o + PAGE_SIZE)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Replies Dialog */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Replies to &quot;{selectedNotification?.title}&quot;
            </DialogTitle>
            <DialogDescription>
              View all replies to this notification
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {loadingReplies ? (
              <div className="text-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Loading replies...</p>
              </div>
            ) : replies.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">No replies yet</p>
              </div>
            ) : (
              replies.map((reply) => (
                <Card key={reply.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        {reply.profiles?.full_name || 'Unknown User'}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {reply.profiles?.role || 'Unknown'}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(reply.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2">{reply.reply_text}</p>
                  {reply.updated_at !== reply.created_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Edited: {formatDate(reply.updated_at)}
                    </p>
                  )}
                </Card>
              ))
            )}
          </div>
          {/* Reply composer */}
          {selectedNotification?.allow_replies === false ? (
            <div className="border-t pt-4 mt-2 flex items-center justify-between">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" />
                Replies are disabled for this notification.
              </p>
              <Button variant="outline" onClick={() => setReplyDialogOpen(false)}>
                Close
              </Button>
            </div>
          ) : (
            <div className="border-t pt-4 mt-2 space-y-2">
              <Textarea
                placeholder="Write a reply…"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={2}
                className="resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSendReply();
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Ctrl+Enter to send</span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setReplyDialogOpen(false)}>
                    Close
                  </Button>
                  <Button
                    onClick={handleSendReply}
                    disabled={sendingReply || !replyText.trim()}
                  >
                    {sendingReply ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Reply
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

