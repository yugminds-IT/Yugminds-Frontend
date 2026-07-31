"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  Bell,
  CheckCircle,
  AlertCircle,
  Check,
  Trash2,
  MessageSquare,
  Send,
  Loader2,
  User,
  PlusCircle,
} from "lucide-react";
import { useStudentNotifications, useMarkNotificationAsRead } from "@/hooks/useStudentData";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useQueryClient } from "@tanstack/react-query";
import { commonApi, studentApi } from "@/lib/api";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { queryKeys } from "@/lib/query-keys";
import { formatNotificationType } from "@/lib/notification-format";

type NotifItem = {
  id: string;
  is_read?: boolean;
  type?: string;
  title?: string;
  message?: string;
  created_at?: string;
  allow_replies?: boolean;
};

type ReplyItem = {
  id: string;
  notification_id: string;
  user_id: number;
  reply_text: string;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string | null; email: string; role: string };
};

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
  const queryClient = useQueryClient();
  const toast = useToast();

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
      toast.error(e instanceof Error ? e.message : 'Failed to load replies');
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
      toast.success('Reply sent');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send reply');
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

  const handleSend = async () => {
    if (!sendTitle.trim() || !sendMessage.trim()) {
      toast.error('Title and message are required');
      return;
    }
    if (selectedRecipients.length === 0) {
      toast.error('Select at least one recipient');
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
      toast.success('Message sent to teacher(s)');
      setSendDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send message');
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

  const filteredNotifications =
    (notifications as NotifItem[] | undefined)?.filter((n) =>
      filter === 'unread' ? !n.is_read : true
    ) ?? [];
  const unreadCount = (notifications as NotifItem[] | undefined)?.filter((n) => !n.is_read).length ?? 0;

  const NotifCard = ({ notification }: { notification: NotifItem }) => {
    const typeDisplay = formatNotificationType(notification.type);
    const TypeIcon = typeDisplay.icon;
    return (
    <Card
      className={`transition-all hover:shadow-md ${
        notification.is_read ? 'bg-gray-50 border-gray-200' : typeDisplay.cardClassName
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 mt-1"><TypeIcon className="h-5 w-5 text-gray-600" /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className={`font-semibold ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                {notification.title}
              </h3>
              <div className="flex items-center gap-2">
                {!notification.is_read && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                <Badge variant="outline" className={`text-xs ${typeDisplay.badgeClassName}`}>
                  {typeDisplay.label}
                </Badge>
              </div>
            </div>
            <p className={`text-sm ${!notification.is_read ? 'text-gray-700' : 'text-gray-600'}`}>
              {notification.message || ''}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {notification.created_at ? new Date(notification.created_at).toLocaleString() : ''}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {!notification.is_read && (
              <Button variant="ghost" size="sm" onClick={() => handleMarkAsRead(notification.id)}>
                <Check className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost" size="sm"
              className="text-gray-500 hover:text-blue-600"
              title="View & reply"
              onClick={() => openReplies(notification)}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="sm"
              className="text-gray-400 hover:text-red-600"
              onClick={() => handleDelete(notification.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600 mt-2">Stay updated with your latest activity</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm">{unreadCount} Unread</Badge>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllAsRead} disabled={markingAll}>
              <CheckCircle className="h-4 w-4 mr-2" />
              {markingAll ? 'Marking...' : 'Mark All as Read'}
            </Button>
          )}
          <Button size="sm" onClick={openSendDialog} className="bg-blue-600 hover:bg-blue-700 text-white">
            <PlusCircle className="h-4 w-4 mr-2" />
            Message Teacher
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="all" onClick={() => setFilter('all')}>
            All ({notifications?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="unread" onClick={() => setFilter('unread')}>
            Unread ({unreadCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            </div>
          ) : filteredNotifications.length > 0 ? (
            <div className="space-y-3">
              {filteredNotifications.map((n, i) => <NotifCard key={n.id ?? i} notification={n} />)}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-gray-500">
                <Bell className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">
                  {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
                </p>
                <p className="text-sm mt-2">
                  {filter === 'unread'
                    ? 'All caught up! You have no unread notifications.'
                    : "You don't have any notifications yet."}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="unread" className="space-y-4">
          {filteredNotifications.length > 0 ? (
            <div className="space-y-3">
              {filteredNotifications.map((n, i) => <NotifCard key={n.id ?? i} notification={n} />)}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-gray-500">
                <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-300" />
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-sm mt-2">You have no unread notifications.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Send message dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              Message Your Teacher
            </DialogTitle>
            <DialogDescription>
              Send a message to teachers in your school.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Recipient type */}
            <div className="space-y-2">
              <Label>Send to</Label>
              <div className="flex gap-2">
                <Button
                  variant={sendRecipientType === 'role' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setSendRecipientType('role'); setSelectedRecipients(['role:teacher']); }}
                >
                  All Teachers
                </Button>
                <Button
                  variant={sendRecipientType === 'individual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setSendRecipientType('individual'); setSelectedRecipients([]); }}
                >
                  Specific Teacher
                </Button>
              </div>
            </div>

            {/* Individual teacher picker */}
            {sendRecipientType === 'individual' && (
              <div className="space-y-2">
                <Label>Select teacher</Label>
                {loadingRecipients ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading teachers…
                  </div>
                ) : availableRecipients.length === 0 ? (
                  <p className="text-sm text-gray-500">No teachers found in your school.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2">
                    {availableRecipients.map((r) => {
                      const selected = selectedRecipients.includes(r.id);
                      return (
                        <div
                          key={r.id}
                          className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${selected ? 'bg-blue-50' : ''}`}
                          onClick={() =>
                            setSelectedRecipients((prev) =>
                              selected ? prev.filter((x) => x !== r.id) : [...prev, r.id]
                            )
                          }
                        >
                          <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm">{r.name || r.email}</span>
                          {selected && <Check className="h-4 w-4 text-blue-600 ml-auto" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Title */}
            <div className="space-y-1">
              <Label htmlFor="send-title">Subject</Label>
              <Input
                id="send-title"
                placeholder="What's this about?"
                value={sendTitle}
                onChange={(e) => setSendTitle(e.target.value)}
              />
            </div>

            {/* Message */}
            <div className="space-y-1">
              <Label htmlFor="send-message">Message</Label>
              <Textarea
                id="send-message"
                placeholder="Write your message…"
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
                rows={4}
                className="resize-none text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setSendDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={sending || !sendTitle.trim() || !sendMessage.trim() || selectedRecipients.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reply thread dialog */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent className="max-w-2xl bg-white flex flex-col max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              {activeNotif?.title || 'Notification'}
            </DialogTitle>
            {activeNotif?.message && (
              <DialogDescription className="text-sm text-gray-600 mt-1 line-clamp-2">
                {activeNotif.message}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 py-2 min-h-0">
            {loadingReplies ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : replies.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No replies yet. Start the conversation below.</p>
              </div>
            ) : (
              replies.map((r) => (
                <div key={r.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-800">
                        {r.profiles?.full_name || r.profiles?.email || 'Unknown'}
                      </span>
                      {r.profiles?.role && (
                        <Badge variant="outline" className="text-xs h-4 px-1 capitalize">
                          {r.profiles.role}
                        </Badge>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.reply_text}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {activeNotif?.allow_replies === false ? (
            <div className="border-t pt-3 flex items-center justify-between">
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Replies are disabled for this notification.
              </p>
              <Button variant="outline" size="sm" onClick={() => setReplyDialogOpen(false)}>Close</Button>
            </div>
          ) : (
            <div className="border-t pt-3 space-y-2">
              <Textarea
                placeholder="Write a reply…"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={2}
                className="resize-none text-sm"
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSendReply(); }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Ctrl+Enter to send</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setReplyDialogOpen(false)}>Close</Button>
                  <Button
                    size="sm"
                    onClick={handleSendReply}
                    disabled={sendingReply || !replyText.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {sendingReply ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                    Send
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
