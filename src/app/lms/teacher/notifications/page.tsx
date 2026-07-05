"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
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
  MessageSquare,
  Check
} from "lucide-react";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useTeacherSchool } from "../context";
import { commonApi, teacherApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

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

export default function TeacherNotifications() {
  const { selectedSchool } = useTeacherSchool();
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
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

  // Reply dialog state
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

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
      const { data } = await teacherApi.notifications.list({ limit: 100 });
      const typed = data as { notifications?: Notification[] };
        // Dedupe/group notifications:
        // The DB stores one notification row per recipient (user_id),
        // so broadcasts appear as many rows. Group them for display.
        const rawNotifications: Notification[] = typed.notifications || [];
        const groupedNotifications: (Notification & { recipient_count?: number; notification_ids?: string[] })[] = (() => {
          const byKey = new Map<string, (Notification & { recipient_count?: number; notification_ids?: string[] })>();
          for (const n of rawNotifications) {
            const ts = (n.created_at || '').slice(0, 19); // second-level granularity
            const key = `${n.type}|${n.title}|${n.message}|${ts}`;
            const existing = byKey.get(key);
            if (existing) {
              existing.recipient_count = (existing.recipient_count || 1) + 1;
              if (!existing.notification_ids) {
                existing.notification_ids = [existing.id];
              }
              existing.notification_ids.push(n.id);
              // Update is_read: if any is unread, the group is unread
              if (!n.is_read) {
                existing.is_read = false;
              }
            } else {
              byKey.set(key, { 
                ...n, 
                recipient_count: 1,
                notification_ids: [n.id]
              });
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

  const handleRecipientToggle = (id: string) => {
    setSelectedRecipients(prev =>
      prev.includes(id)
        ? prev.filter((r: string) => r !== id)
        : [...prev, id]
    );
  };

  const filteredNotifications = notifications.filter((notification: Notification) => {
    const matchesSearch = !searchQuery || 
      notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notification.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notification.profiles?.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'read' && notification.is_read) ||
      (filterStatus === 'unread' && !notification.is_read);

    return matchesSearch && matchesStatus;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'info': return 'bg-blue-100 text-blue-800';
      case 'success': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-600 mt-2">Send and manage notifications to students</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'send' | 'view')}>
        <TabsList>
          <TabsTrigger value="send">Send Notification</TabsTrigger>
          <TabsTrigger value="view">View Sent</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send Notification
              </CardTitle>
              <CardDescription>
                Send notifications to students in your school
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
                    <SelectItem value="role">By Role (Students)</SelectItem>
                    <SelectItem value="individual">Individual Students</SelectItem>
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
                  <Label>Select Students</Label>
                  {loadingRecipients ? (
                    <p className="text-sm text-gray-500">Loading students...</p>
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
              <div className="flex items-center justify-between rounded-lg border px-4 py-3 mb-4">
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
                    Sent Notifications
                  </CardTitle>
                  <CardDescription>
                    View all notifications you&apos;ve sent
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={loadNotifications}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
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
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">Loading notifications...</p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">No notifications found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`border rounded-lg p-4 ${notification.is_read ? 'bg-gray-50' : 'bg-white border-blue-200'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getTypeIcon(notification.type)}
                            <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                            <Badge className={getTypeColor(notification.type)}>
                              {notification.type}
                            </Badge>
                            {!notification.is_read ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                Unread
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-green-50 text-green-700">
                                Read
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
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
                          {!notification.is_read && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarkAsRead(notification)}
                              className="flex items-center gap-1"
                            >
                              <Check className="h-3 w-3" />
                              Mark as Read
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
                        </div>
                      </div>
                    </div>
                  ))}
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

