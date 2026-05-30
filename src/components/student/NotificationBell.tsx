'use client';

import React, { useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import NotificationCenter from './NotificationCenter';
import { useDashboardRealtime } from '../../hooks/useDashboardRealtime';
import { useUnreadNotificationCount } from '../../hooks/useUnreadNotificationCount';

interface NotificationBellProps {
  userId?: string;
  className?: string;
}

export default function NotificationBell({ userId, className = '' }: NotificationBellProps) {
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);

  void userId;
  useDashboardRealtime('student', { enabled: true, debugLabel: 'student-notification-bell' });

  // Shared unread count now uses socket updates + REST fallback.
  const { count: unreadCount } = useUnreadNotificationCount({ role: 'student' });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={`relative ${className}`}
        onClick={() => setIsNotificationCenterOpen(true)}
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5" />
        ) : (
          <Bell className="w-5 h-5" />
        )}
        
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs p-0 min-w-[20px]"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      <NotificationCenter
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        userId={userId}
      />
    </>
  );
}