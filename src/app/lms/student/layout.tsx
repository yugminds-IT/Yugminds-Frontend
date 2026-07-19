"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/modern-side-bar";
import { useStudentProfile, useStudentDashboardStats } from "@/hooks/useStudentData";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";
import { useSessionValidation } from "@/hooks/useSessionValidation";
import { getStoredUserId, waitForSession, setLogoutReason } from "@/lib/session-utils";
import { setAuthToken } from "@/lib/api";
import { startActivityTracking, stopActivityTracking } from "@/lib/activity-tracker";
import { ForcePasswordChange } from "@/components/ForcePasswordChange";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import AnnouncementBanner from "@/components/AnnouncementBanner";

import { useAppStore, type AppState } from "@/store/app-store";
import { useBrowserNavigation } from "@/hooks/useBrowserNavigation";

export default function StudentLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  type AuthUser = { id: string; email?: string };
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const { data: profile } = useStudentProfile();
  // Pending count comes from the dashboard stats so the badge reflects BOTH
  // course (chapter-based) and daily (school homework) assignments.
  const { data: dashboardStats } = useStudentDashboardStats();
  const { count: unreadNotificationCount } = useUnreadNotificationCount({ enabled: !loading, role: 'student' });
  
  // Get sidebar state from store
  const sidebarCollapsed = useAppStore((state: AppState) => state.sidebarCollapsed);

  // Refs for concurrency protection and preventing loops
  const getUserInProgressRef = useRef(false);
  const isInitialMountRef = useRef(true);
  const userLoadedRef = useRef(false);

  // Memoize getStateToSave callback to prevent unnecessary re-runs
  // Add guard to prevent state saving during initial load when user is null
  const getStateToSave = useCallback(() => {
    try {
      // Don't save state during initial load or when user is not loaded
      if (isInitialMountRef.current || !user) {
        return {};
      }
      return {
        sidebarCollapsed: sidebarCollapsed ?? false,
        userEmail: user?.email ?? null,
      };
    } catch (error) {
      console.warn('Error getting state to save:', error);
      return {};
    }
  }, [sidebarCollapsed, user]);

  // Use browser navigation hook to preserve state
  // Note: warnOnUnsavedChanges is false because layout state (sidebar collapse) is not "unsaved changes"
  useBrowserNavigation({
    componentId: 'student-layout',
    getStateToSave,
    warnOnUnsavedChanges: false, // Layout state preservation shouldn't trigger unsaved changes warning
  });

  // Use session validation hook for automatic session management
  const { logout } = useSessionValidation({
    checkInterval: 30000, // Check every 30 seconds
    showAlert: true,
    redirectOnInvalid: true,
    onSessionInvalid: (reason, message) => {
      console.log(`Session invalidated: ${reason} - ${message}`);
    }
  });

  useEffect(() => {
    let mounted = true;

    const getUser = async () => {
      // Concurrency protection: prevent multiple simultaneous calls
      if (getUserInProgressRef.current) {
        console.log('⏸️ Student layout: getUser already in progress, skipping...');
        return;
      }

      // If user is already loaded, don't reload unless explicitly needed
      if (userLoadedRef.current && !isInitialMountRef.current) {
        console.log('⏸️ Student layout: User already loaded, skipping getUser...');
        return;
      }

      getUserInProgressRef.current = true;
      
      try {
        setLoading(true);
        
        console.log('🔍 Student layout: Checking for session...');
        const sessionResult = await waitForSession(6, 600);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = sessionResult?.session as any;
        
        if (!session) {
          console.error('❌ Student layout: No session found after all retries, redirecting to login');
          if (mounted) {
            setStatus('unauthenticated');
            setLoading(false);
            setLogoutReason('error');
            router.push('/lms/login');
          }
          return;
        }
        if (mounted) setStatus('authenticated');
        console.log('✅ Student layout: Session found, user ID:', session.user.id);
        if (session.access_token) setAuthToken(session.access_token);
        
        // Quick session expiry check
        const now = Math.floor(Date.now() / 1000);
        if (session.expires_at && session.expires_at < now) {
          console.error('❌ Student layout: Session is expired');
          if (mounted) {
            setLoading(false);
          }
          return;
        }
        
        const userId = getStoredUserId();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const authUser = userId ? { id: userId, email: (session.user as any)?.email ?? undefined } : null;
        if (!authUser) {
          console.error('❌ Student layout: No user in session');
          if (mounted) {
            setLoading(false);
          }
          return;
        }
        
        // Skip role check here - let the profile hook handle role verification
        // This reduces network calls during initial authentication and improves reliability
        console.log('⏸️ Student layout: Skipping role check, will be verified by profile hook');
        
        if (mounted) {
          setUser(authUser);
          setLoading(false);
          isInitialMountRef.current = false; // Mark initial mount as complete
          userLoadedRef.current = true; // Mark user as loaded
          console.log('✅ Student layout: User loaded successfully');
        } else {
          console.warn('⚠️ Student layout: Component unmounted before user could be set');
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Student layout: Error getting user:', error);
        
        // Handle timeout errors specifically
        if (errorMessage.includes('timeout') || errorMessage.includes('took too long')) {
          console.warn('⚠️ Student layout: Timeout error detected, will let timeout handler manage redirect');
        }
        
        if (mounted) {
          setStatus('unauthenticated');
          setLoading(false); // Stop loading even on error
          // Don't redirect here - let the timeout handler do it
        }
      } finally {
        // Always clear the in-progress flag
        if (mounted) {
          getUserInProgressRef.current = false;
        }
        isInitialMountRef.current = false;
        // Note: userLoadedRef is only set to true on success, so we don't clear it here
        // It will be cleared on SIGNED_OUT
      }
    };

    getUser();

    return () => {
      mounted = false;
      getUserInProgressRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run once on mount, router is stable
  }, []);

  // Start activity tracking when user is authenticated
  useEffect(() => {
    if (user && !loading) {
      startActivityTracking();
      
      return () => {
        stopActivityTracking();
      };
    }
  }, [user, loading]);

  useEffect(() => {
    // Role verification when profile loads (primary role check)
    if (profile && user) {
      type ProfileWithRole = { role?: string };
      const profileTyped = profile as ProfileWithRole;
      const normalizedRole = profileTyped.role?.trim().toLowerCase();
      console.log('🔍 Student layout: Profile loaded, checking role:', profileTyped.role, 'Normalized:', normalizedRole);
      
      if (normalizedRole !== 'student') {
        console.error('❌ Student layout: Profile role check failed! Role:', profileTyped.role, 'Normalized:', normalizedRole);
        console.log('🔄 Redirecting to appropriate dashboard...');
        router.push('/lms/redirect');
      } else {
        console.log('✅ Student layout: Role verification passed - user is a student');
      }
    }
  }, [profile, user, router]);

  const handleLogout = async () => {
    await logout();
  };

  // Add timeout to prevent infinite loading - reduced timeout for faster recovery
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading && !user) {
        console.warn('⚠️ Loading timeout - taking too long to load user');
        setLoadingTimeout(true);
        setLoading(false); // Stop loading immediately
      }
    }, 15000); // Increased to 15 seconds to allow for slower network conditions

    return () => clearTimeout(timeout);
  }, [loading, user]);

  // Handle redirect on timeout - must be in useEffect, not render
  useEffect(() => {
    if (loadingTimeout && !user && !loading) {
      console.error('❌ User not loaded after timeout, redirecting to login');
      setStatus('unauthenticated');
      setLogoutReason('session_timeout');
      router.push('/lms/login');
    }
  }, [loadingTimeout, user, loading, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  // Only block on user loading, not profile loading (profile can load in background)
  if (loading && !loadingTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading student dashboard...</p>
        </div>
      </div>
    );
  }

  // If timeout occurred but user exists, render anyway
  if (loadingTimeout && loading && user) {
    console.warn('⚠️ Loading timeout but user exists - rendering dashboard');
  }
  
  // If timeout occurred and no user, show redirecting message
  if (loadingTimeout && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Get user's full name from profile, fallback to email
  type ProfileWithName = { full_name?: string; email?: string };
  const profileTyped = profile as ProfileWithName | null;
  const userName = profileTyped?.full_name || user?.email?.split('@')[0] || 'Student';
  const userEmail = user?.email || profileTyped?.email || '';

  // Calculate badge counts (assignments from combined dashboard stats; notifications from shared unread-count API)
  const pendingAssignmentsCount = dashboardStats?.pendingAssignments ?? 0;

  return (
    <div className="flex h-screen bg-gray-50" style={{ backgroundColor: '#f9fafb' }}>
      <ForcePasswordChange />
      <AnnouncementBanner />
      <ImpersonationBanner />
      <Sidebar 
        userRole="student"
        userName={userName}
        userEmail={userEmail}
        onLogout={handleLogout}
        assignmentBadgeCount={pendingAssignmentsCount}
        notificationBadgeCount={unreadNotificationCount}
      />
      
      <div className="flex-1 overflow-y-auto" data-dashboard-content style={{ backgroundColor: '#f9fafb' }}>
        {children}
      </div>
    </div>
  );
}
