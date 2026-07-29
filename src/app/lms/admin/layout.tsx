"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/modern-side-bar";
import { useSessionValidation } from "@/hooks/useSessionValidation";
import { startActivityTracking, stopActivityTracking } from "@/lib/activity-tracker";
import { waitForSession } from "@/lib/session-utils";
import { useAppStore, type AppState } from "@/store/app-store";
import { useBrowserNavigation } from "@/hooks/useBrowserNavigation";
import { commonApi, setAuthToken } from "@/lib/api";
import { clearStoredSession, getStoredUserId, setLogoutReason } from "@/lib/session-utils";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";
import { usePendingPasswordResetCount } from "@/hooks/usePendingPasswordResetCount";
import { ForcePasswordChange } from "@/components/ForcePasswordChange";
import AnnouncementBanner from "@/components/AnnouncementBanner";

type UserProfile = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  [key: string]: unknown;
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const router = useRouter();
  const { count: unreadNotificationCount } = useUnreadNotificationCount({ enabled: !loading, role: 'admin' });
  const pendingPasswordResetCount = usePendingPasswordResetCount({ enabled: !loading });
  
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
    componentId: 'admin-layout',
    getStateToSave,
    warnOnUnsavedChanges: false, // Layout state preservation shouldn't trigger unsaved changes warning
  });

  // Use session validation hook for automatic session management
  const { logout } = useSessionValidation({
    checkInterval: 30000, // Check every 30 seconds
    showAlert: true,
    redirectOnInvalid: true,
    onSessionInvalid: (_reason, _message) => {}
  });

  useEffect(() => {
    let mounted = true;
    let overallTimeoutId: NodeJS.Timeout | null = null;

    const getUser = async () => {
      // Concurrency protection: prevent multiple simultaneous calls
      if (getUserInProgressRef.current) {
        return;
      }

      if (userLoadedRef.current && !isInitialMountRef.current) {
        return;
      }

      getUserInProgressRef.current = true;
      
      try {
        setLoading(true);
        
        // Add overall timeout to prevent infinite hanging (15 seconds max)
        overallTimeoutId = setTimeout(() => {
          if (mounted) {
            console.error('❌ Admin layout: Overall timeout - redirecting to login');
            setLoading(false);
            setLogoutReason('session_timeout');
            router.push('/lms/login');
          }
        }, 15000);
        
        // Check if we're coming from a redirect (give time for session to be available)
        const isFromRedirect = typeof window !== 'undefined' && 
          (document.referrer.includes('/api/auth/redirect') || 
           sessionStorage.getItem('_redirecting') === 'true');
        
        if (isFromRedirect) {
          await new Promise(resolve => setTimeout(resolve, 500));
          sessionStorage.removeItem('_redirecting');
        }
        
        let sessionResult = await waitForSession(3, 400);

        if (!sessionResult || !sessionResult.session) {
          await new Promise(resolve => setTimeout(resolve, 500));
          sessionResult = await waitForSession(2, 500);
        }
        
        if (!sessionResult || !sessionResult.session) {
          console.error('❌ Admin layout: No session found after retries, redirecting to login');
          if (mounted && overallTimeoutId) {
            clearTimeout(overallTimeoutId);
          }
          if (mounted) {
            setStatus('unauthenticated');
            setLoading(false);
            setLogoutReason('session_expired');
            router.push('/lms/login');
          }
          return;
        }
        
        const session = sessionResult.session;
        if (mounted) setStatus('authenticated');
        // Ensure axios client has the token for all admin API calls (e.g. schools list)
        if (session.access_token) setAuthToken(session.access_token);
        const userId = getStoredUserId();
        if (!userId) {
          if (mounted) {
            setLoading(false);
            setLogoutReason('session_expired');
            router.push("/lms/login");
          }
          return;
        }
        const user = { id: userId, email: session.user?.email ?? null };
        
        // IMMEDIATELY check role from database before allowing access
        try {
          const { data: roleData } = await commonApi.getRole(user.id);
          const userRole = (roleData?.role ?? (roleData as { profile?: { role?: string } })?.profile?.role)?.trim().toLowerCase();

          // If user is not an admin, redirect immediately
          if (userRole !== 'admin' && userRole !== 'super_admin') {
            console.error('❌ Admin layout: User is not an admin! Role:', userRole, 'Email:', user.email);
            if (mounted) {
              setLoading(false);
              router.push('/lms/redirect');
            }
            return;
          }


          // Clear overall timeout since we succeeded
          if (overallTimeoutId) {
            clearTimeout(overallTimeoutId);
            overallTimeoutId = null;
          }

          // Set user and loading state immediately after role verification
          // This allows the dashboard to render faster
          if (mounted) {
            setUser(user);
            setLoading(false);
            isInitialMountRef.current = false; // Mark initial mount as complete
            userLoadedRef.current = true; // Mark user as loaded
          }
        } catch (roleError: unknown) {
          const error = roleError as { message?: string; name?: string; stack?: string };
          console.error('❌ Error checking role:', error);
          console.error('❌ Role error details:', {
            message: error?.message,
            name: error?.name,
            stack: error?.stack
          });
          // Clear overall timeout if still set
          if (overallTimeoutId) {
            clearTimeout(overallTimeoutId);
            overallTimeoutId = null;
          }
          if (mounted) {
            setLoading(false);
            setLogoutReason('error');
            router.push('/lms/login');
          }
          return;
        }

        // Get profile via API route (bypasses RLS) for display purposes
        // Fetch in background after dashboard is already rendered
        (async () => {
          try {
            const { data: profileData } = await commonApi.profile.get({ userId: user.id });
            if (mounted) {
              setUserProfile(profileData?.profile ?? null);
            }
          } catch (err) {
            console.warn('Error fetching profile for display:', err);
            // Continue even if profile fetch fails - we already verified role
          }
        })();
      } catch (error: unknown) {
        console.error('Error loading user data:', error);
        // Clear overall timeout if still set
        if (overallTimeoutId) {
          clearTimeout(overallTimeoutId);
          overallTimeoutId = null;
        }
        // Don't throw errors - gracefully handle by redirecting
        if (mounted) {
          setStatus('unauthenticated');
          setLoading(false);
          setLogoutReason('session_expired');
          router.push('/lms/login');
        }
      } finally {
        // Always clear the in-progress flag
        getUserInProgressRef.current = false;
        isInitialMountRef.current = false;
        // Clear overall timeout if still set
        if (overallTimeoutId) {
          clearTimeout(overallTimeoutId);
          overallTimeoutId = null;
        }
        // Note: userLoadedRef is only set to true on success, so we don't clear it here
        // It will be cleared on SIGNED_OUT
      }
    };

    getUser();
    
    // Set up session listener
    return () => {
      mounted = false;
      getUserInProgressRef.current = false;
      // Don't reset userLoadedRef here - it should persist across re-renders
      if (overallTimeoutId) {
        clearTimeout(overallTimeoutId);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- router is stable in Next.js App Router
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

  const handleLogout = async () => {
    await logout();
    clearStoredSession();
  };

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f9fafb' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50" style={{ backgroundColor: '#f9fafb' }}>
      <ForcePasswordChange />
      <AnnouncementBanner />
      <Sidebar
        userRole="admin"
        userName={userProfile?.full_name || user?.email || "Admin User"}
        userEmail={user?.email || "admin@example.com"}
        onLogout={handleLogout}
        notificationBadgeCount={unreadNotificationCount}
        passwordResetBadgeCount={pendingPasswordResetCount}
      />
      
      <div className="flex-1 overflow-y-auto" data-dashboard-content style={{ backgroundColor: '#f9fafb' }}>
        {children}
      </div>
    </div>
  );
}
