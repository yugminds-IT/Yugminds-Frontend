"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { commonApi } from '../../lib/api';
import { clearStoredSession, getStoredUserId } from '../../lib/session-utils';

import { 
  Home, 
  User, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  ChevronLeft, 
  ChevronRight,
  BarChart3,
  FileText,
  Bell,
  Search,
  School,
  Users,
  BookOpen,
  ClipboardList,
  TrendingUp,
  Shield,
  Calendar,
  CalendarDays,
  Clock,
  KeyRound,
  Activity,
  Award,
  MessageSquare,
  Key,
  Cpu
} from 'lucide-react';

interface NavigationItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
}

interface SidebarProps {
  className?: string;
  userRole?: string;
  userName?: string;
  userEmail?: string;
  onLogout?: () => void;
  assignmentBadgeCount?: number;
  notificationBadgeCount?: number;
  passwordResetBadgeCount?: number;
}

// Role-based navigation items
const getNavigationItems = (role: string, assignmentCount?: number, notificationCount?: number, passwordResetCount?: number): NavigationItem[] => {
  const baseItems = [
    { id: "dashboard", name: "Dashboard", icon: Home, href: "/dashboard" },
    { id: "profile", name: "Profile", icon: User, href: "/profile" },
    { id: "settings", name: "Settings", icon: Settings, href: "/settings" },
  ];

  switch (role) {
    case 'admin':
      return [
        { id: "dashboard", name: "Overview", icon: Home, href: "/lms/admin" },
        { id: "schools", name: "Schools Management", icon: School, href: "/lms/admin/schools" },
        { id: "school-admins", name: "School Admin Management", icon: Shield, href: "/lms/admin/school-admins" },
        { id: "teachers", name: "Teachers Management", icon: Users, href: "/lms/admin/teachers" },
        { id: "students", name: "Students Management", icon: User, href: "/lms/admin/students" },
        { id: "student-progress", name: "Course Progress", icon: BarChart3, href: "/lms/admin/student-progress" },
        { id: "courses", name: "Course Management", icon: BookOpen, href: "/lms/admin/courses" },
        { id: "certificates", name: "Certificates", icon: Award, href: "/lms/admin/certificates" },
        { id: "notifications", name: "Notifications", icon: Bell, href: "/lms/admin/notifications", badge: notificationCount && notificationCount > 0 ? String(notificationCount) : undefined },
        { id: "password-reset-requests", name: "Password Reset Requests", icon: KeyRound, href: "/lms/admin/password-reset-requests", badge: passwordResetCount && passwordResetCount > 0 ? String(passwordResetCount) : undefined },
        { id: "reports", name: "Teacher Reports", icon: ClipboardList, href: "/lms/admin/reports" },
        { id: "joining-codes", name: "Joining Codes", icon: Key, href: "/lms/admin/joining-codes" },
        { id: "licenses", name: "RoboCoders Licenses", icon: Cpu, href: "/lms/admin/licenses" },
        { id: "logos", name: "School Logo Management", icon: School, href: "/lms/admin/logos" },
        { id: "community", name: "Community Management", icon: FileText, href: "/lms/admin/community" },
        { id: "analytics", name: "Performance Analytics", icon: TrendingUp, href: "/lms/admin/analytics" },
        { id: "assignment-analytics", name: "Assignment Analytics", icon: BarChart3, href: "/lms/admin/assignment-analytics" },
        { id: "monitoring", name: "System Monitoring", icon: Activity, href: "/lms/admin/monitoring" },
        { id: "contact-submissions", name: "Contact Submissions", icon: MessageSquare, href: "/lms/admin/contact-submissions" },
        { id: "settings", name: "Settings", icon: Settings, href: "/lms/admin/settings" },
      ];
    case 'school_admin':
      return [
        { id: "dashboard", name: "Overview", icon: Home, href: "/lms/school-admin" },
        { id: "students", name: "Students Management", icon: User, href: "/lms/school-admin/students" },
        { id: "teachers", name: "Teachers Management", icon: Users, href: "/lms/school-admin/teachers" },
        { id: "schedules", name: "Class Scheduling", icon: Calendar, href: "/lms/school-admin/schedules" },
        { id: "calendar", name: "School Calendar", icon: CalendarDays, href: "/lms/school-admin/calendar" },
        { id: "reports", name: "Teacher Reports", icon: ClipboardList, href: "/lms/school-admin/reports" },
        { id: "courses", name: "Courses", icon: BookOpen, href: "/lms/school-admin/courses" },
        { id: "student-progress", name: "Student Progress", icon: BarChart3, href: "/lms/school-admin/student-progress" },
        { id: "assignment-analytics", name: "Assignment Analytics", icon: TrendingUp, href: "/lms/school-admin/assignment-analytics" },
        { id: "notifications", name: "Notifications", icon: Bell, href: "/lms/school-admin/notifications", badge: notificationCount && notificationCount > 0 ? String(notificationCount) : undefined },
        { id: "password-reset-requests", name: "Password Reset Requests", icon: KeyRound, href: "/lms/school-admin/password-reset-requests" },
        { id: "settings", name: "Settings", icon: Settings, href: "/lms/school-admin/settings" },
      ];
    case 'teacher':
      return [
        { id: "dashboard", name: "Dashboard", icon: Home, href: "/lms/teacher" },
        { id: "classes", name: "My Classes", icon: FileText, href: "/lms/teacher/classes" },
        { id: "reports", name: "Submit Report", icon: ClipboardList, href: "/lms/teacher/reports" },
        { id: "attendance", name: "Attendance", icon: Calendar, href: "/lms/teacher/attendance" },
        { id: "leaves", name: "Leave Requests", icon: Clock, href: "/lms/teacher/leaves" },
        { id: "notifications", name: "Notifications", icon: Bell, href: "/lms/teacher/notifications", badge: notificationCount && notificationCount > 0 ? String(notificationCount) : undefined },
        { id: "analytics", name: "Analytics", icon: TrendingUp, href: "/lms/teacher/analytics" },
        { id: "student-progress", name: "Student Progress", icon: BarChart3, href: "/lms/teacher/student-progress" },
        { id: "assignments", name: "Assignments", icon: ClipboardList, href: "/lms/teacher/assignments" },
        { id: "settings", name: "Settings", icon: Settings, href: "/lms/teacher/settings" },
      ];
    case 'student':
      return [
        { id: "dashboard", name: "Dashboard", icon: Home, href: "/lms/student" },
        { id: "courses", name: "My Courses", icon: BookOpen, href: "/lms/student/my-courses" },
        { id: "assignments", name: "Assignments", icon: ClipboardList, href: "/lms/student/assignments", badge: assignmentCount && assignmentCount > 0 ? String(assignmentCount) : undefined },
        { id: "analytics", name: "My Analytics", icon: BarChart3, href: "/lms/student/analytics" },
        { id: "certificates", name: "Certificates", icon: Shield, href: "/lms/student/certificates" },
        { id: "notifications", name: "Notifications", icon: Bell, href: "/lms/student/notifications", badge: notificationCount && notificationCount > 0 ? String(notificationCount) : undefined },
        { id: "settings", name: "Settings", icon: Settings, href: "/lms/student/settings" },
      ];
    default:
      return baseItems;
  }
};

export function Sidebar({ className = "", userRole = "student", userName = "User", userEmail = "user@example.com", onLogout, assignmentBadgeCount, notificationBadgeCount, passwordResetBadgeCount }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState("dashboard");
  const [resolvedNotificationCount, setResolvedNotificationCount] = useState<number>(notificationBadgeCount ?? 0);
  const router = useRouter();
  const pathname = usePathname();

  const navigationItems = useMemo(
    () => getNavigationItems(userRole, assignmentBadgeCount, resolvedNotificationCount, passwordResetBadgeCount),
    [userRole, assignmentBadgeCount, resolvedNotificationCount, passwordResetBadgeCount]
  );

  // Keep local notification count in sync when parent provides it (e.g. student layout)
  useEffect(() => {
    if (typeof notificationBadgeCount === 'number') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResolvedNotificationCount(notificationBadgeCount);
    }
  }, [notificationBadgeCount]);

  // For roles where the layout doesn't pass notificationBadgeCount, fetch unread count periodically.
  // Stable deps: only re-run when "parent provides count" flips to avoid restarting intervals.
  const parentProvidesCount = typeof notificationBadgeCount === 'number';
  useEffect(() => {
    if (parentProvidesCount) return;

    let mounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchUnreadCount = async () => {
      try {
        const userId = getStoredUserId();
        if (!userId) {
          if (mounted) setResolvedNotificationCount(0);
          return;
        }
        const { data } = await commonApi.notifications.user.getUnreadCount({ user_id: userId });
        const count = Number((data as { count?: number })?.count ?? 0);
        if (mounted) setResolvedNotificationCount(count);
      } catch {
        // Ignore transient errors; keep last known value
      }
    };

    const startPolling = () => {
      fetchUnreadCount();
      intervalId = setInterval(fetchUnreadCount, 30000);
    };

    const stopPolling = () => {
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    startPolling();
    const onFocus = () => fetchUnreadCount();
    const onVisibilityChange = () => {
      if (document.hidden) stopPolling();
      else startPolling();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      mounted = false;
      stopPolling();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [parentProvidesCount]);

  // Auto-open sidebar on desktop
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Set active item based on current path
  useEffect(() => {
    interface NavigationItem {
      id: string;
      href: string;
    }

    const exactMatch = navigationItems.find((item: NavigationItem) => item.href === pathname);
    if (exactMatch) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveItem(exactMatch.id);
      return;
    }

    const parentMatches = navigationItems
      .filter((item: NavigationItem) => {
        if (item.href === '/lms/admin') return false;
        return pathname.startsWith(item.href + '/') || pathname === item.href;
      })
      .sort((a: NavigationItem, b: NavigationItem) => b.href.length - a.href.length);

    if (parentMatches.length > 0) {
      setActiveItem(parentMatches[0].id);
    }
  }, [pathname, navigationItems]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSidebar = () => setIsOpen(!isOpen);
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  const handleItemClick = (itemId: string, href: string) => {
    if (itemId === "logout") {
      onLogout?.();
      return;
    }
    
    setActiveItem(itemId);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsOpen(false);
    }
    
    // Navigate to the page
    router.push(href);
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin': return 'System Administrator';
      case 'school_admin': return 'School Administrator';
      case 'teacher': return 'Teacher';
      case 'student': return 'Student';
      default: return 'User';
    }
  };

  const getPortalLabel = (role: string): { initials: string; label: string } => {
    switch (role) {
      case 'admin': return { initials: 'YA', label: 'Yugminds Admin' };
      case 'school_admin': return { initials: 'SA', label: 'School Admin' };
      case 'teacher': return { initials: 'TP', label: 'Teacher Portal' };
      case 'student': return { initials: 'SP', label: 'Student Portal' };
      default: return { initials: 'YM', label: 'Yugminds' };
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name || typeof name !== 'string') {
      return 'U'; // Default to 'U' for User if name is missing
    }
    const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    return initials || 'U'; // Fallback to 'U' if no initials found
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={toggleSidebar}
        className="fixed top-6 left-6 z-50 p-3 rounded-lg bg-white shadow-md border border-slate-100 md:hidden hover:bg-slate-50 transition-all duration-200"
        aria-label="Toggle sidebar"
      >
        {isOpen ? 
          <X className="h-5 w-5 text-slate-600" /> : 
          <Menu className="h-5 w-5 text-slate-600" />
        }
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300" 
          onClick={toggleSidebar} 
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 left-0 h-full bg-white border-r border-slate-200 z-40 transition-all duration-300 ease-in-out flex flex-col
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          ${isCollapsed ? "w-28" : "w-78"}
          md:translate-x-0 md:static md:z-auto
          ${className}
        `}
      >
        {/* Header with logo and collapse button */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/60">
          {!isCollapsed && (
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-base">{getPortalLabel(userRole).initials}</span>
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-slate-800 text-base">{getPortalLabel(userRole).label}</span>
                <span className="text-xs text-slate-500">{getRoleDisplayName(userRole)}</span>
              </div>
            </div>
          )}

          {isCollapsed && (
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center mx-auto shadow-sm">
              <span className="text-white font-bold text-base">{getPortalLabel(userRole).initials}</span>
            </div>
          )}

          {/* Desktop collapse button */}
          <button
            onClick={toggleCollapse}
            className="hidden md:flex p-1.5 rounded-md hover:bg-slate-100 transition-all duration-200"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-slate-500" />
            )}
          </button>
        </div>

        {/* Search Bar */}
        {!isCollapsed && (
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <ul className="space-y-0.5">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeItem === item.id;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleItemClick(item.id, item.href)}
                    className={`
                      w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-md text-left transition-all duration-200 group
                      ${isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }
                      ${isCollapsed ? "justify-center px-2" : ""}
                    `}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <div className="flex items-center justify-center min-w-[24px]">
                      <Icon
                        className={`
                          h-4.5 w-4.5 flex-shrink-0
                          ${isActive 
                            ? "text-blue-600" 
                            : "text-slate-500 group-hover:text-slate-700"
                          }
                        `}
                      />
                    </div>
                    
                    {!isCollapsed && (
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-sm ${isActive ? "font-medium" : "font-normal"}`}>{item.name}</span>
                        {item.badge && (
                          <span className={`
                            px-1.5 py-0.5 text-xs font-medium rounded-full
                            ${isActive
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                            }
                          `}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Badge for collapsed state */}
                    {isCollapsed && item.badge && (
                      <div className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center rounded-full bg-blue-100 border border-white">
                        <span className="text-[10px] font-medium text-blue-700">
                          {parseInt(item.badge) > 9 ? '9+' : item.badge}
                        </span>
                      </div>
                    )}

                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                        {item.name}
                        {item.badge && (
                          <span className="ml-1.5 px-1 py-0.5 bg-slate-700 rounded-full text-[10px]">
                            {item.badge}
                          </span>
                        )}
                        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-1.5 h-1.5 bg-slate-800 rotate-45" />
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom section with profile and logout */}
        <div className="mt-auto border-t border-slate-200">
          {/* Profile Section */}
          <div className={`border-b border-slate-200 bg-slate-50/30 ${isCollapsed ? 'py-3 px-2' : 'p-3'}`}>
            {!isCollapsed ? (
              <div className="flex items-center px-3 py-2 rounded-md bg-white hover:bg-slate-50 transition-colors duration-200">
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                  <span className="text-slate-700 font-medium text-sm">{getInitials(userName)}</span>
                </div>
                <div className="flex-1 min-w-0 ml-2.5">
                  <p className="text-sm font-medium text-slate-800 truncate">{userName || 'User'}</p>
                  <p className="text-xs text-slate-500 truncate">{userEmail || ''}</p>
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full ml-2" title="Online" />
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center">
                    <span className="text-slate-700 font-medium text-sm">{getInitials(userName)}</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                </div>
              </div>
            )}
          </div>

          {/* Logout Button */}
          <div className="p-3">
            <button
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onLogout) {
                  await onLogout();
                } else {
                  try {
                    clearStoredSession();
                    window.location.href = '/lms/login';
                  } catch (error) {
                    console.error('Fallback logout error:', error);
                    window.location.href = '/lms/login';
                  }
                }
              }}
              className={`
                w-full flex items-center rounded-md text-left transition-all duration-200 group
                text-red-600 hover:bg-red-50 hover:text-red-700
                ${isCollapsed ? "justify-center p-2.5" : "space-x-2.5 px-3 py-2.5"}
              `}
              title={isCollapsed ? "Logout" : undefined}
            >
              <div className="flex items-center justify-center min-w-[24px]">
                <LogOut className="h-4.5 w-4.5 flex-shrink-0 text-red-500 group-hover:text-red-600" />
              </div>
              
              {!isCollapsed && (
                <span className="text-sm">Logout</span>
              )}
              
              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                  Logout
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-1.5 h-1.5 bg-slate-800 rotate-45" />
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
