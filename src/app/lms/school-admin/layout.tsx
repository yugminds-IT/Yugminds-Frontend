"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/modern-side-bar";
import { SchoolAdminProvider } from "@/contexts/SchoolAdminContext";
import { useSessionValidation } from "@/hooks/useSessionValidation";
import { startActivityTracking, stopActivityTracking } from "@/lib/activity-tracker";
import { waitForSession } from "@/lib/session-utils";
import { useAppStore, type AppState } from "@/store/app-store";
import { useBrowserNavigation } from "@/hooks/useBrowserNavigation";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { setAuthToken } from "@/lib/api";
import { clearStoredSession, getStoredUserId, setLogoutReason } from "@/lib/session-utils";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";
import { ForcePasswordChange } from "@/components/ForcePasswordChange";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import AnnouncementBanner from "@/components/AnnouncementBanner";

type UserProfile = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  [key: string]: unknown;
};

type SchoolInfo = {
  id: string;
  name?: string | null;
  [key: string]: unknown;
};

export default function SchoolAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [_schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const router = useRouter();
  const { count: unreadNotificationCount } = useUnreadNotificationCount({ enabled: !loading, role: 'school_admin' });
  
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
    componentId: 'school-admin-layout',
    getStateToSave,
    warnOnUnsavedChanges: false, // Layout state preservation shouldn't trigger unsaved changes warning
  });

  // Use session validation hook for automatic session management
  const { logout, isValid: _sessionValid } = useSessionValidation({
    checkInterval: 30000, // Check every 30 seconds
    showAlert: true,
    redirectOnInvalid: true,
    onSessionInvalid: (reason, message) => {
      console.log(`Session invalidated: ${reason} - ${message}`);
    }
  });

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const getUser = async () => {
      // Concurrency protection: prevent multiple simultaneous calls
      if (getUserInProgressRef.current) {
        console.log('⏸️ School Admin layout: getUser already in progress, skipping...');
        return;
      }

      // If user is already loaded, don't reload unless explicitly needed
      if (userLoadedRef.current && !isInitialMountRef.current) {
        console.log('⏸️ School Admin layout: User already loaded, skipping getUser...');
        return;
      }

      getUserInProgressRef.current = true;
      
      try {
        setLoading(true);
        
        // Check if we're coming from a redirect (give extra time for session to be available)
        const isFromRedirect = typeof window !== 'undefined' && 
          (document.referrer.includes('/api/auth/redirect') || 
           sessionStorage.getItem('_redirecting') === 'true');
        
        if (isFromRedirect) {
          console.log('🔄 School Admin layout: Detected redirect, waiting for session to settle...');
          await new Promise(resolve => setTimeout(resolve, 1500));
          sessionStorage.removeItem('_redirecting');
        }
        
        // Check session with retry logic (important after redirect from login)
        console.log('🔍 School Admin layout: Checking for session...');
        let sessionResult = await waitForSession(6, 600);
        
        // If no session found, try one more time with longer delay
        if (!sessionResult || !sessionResult.session) {
          console.log('⏳ School Admin layout: No session found, waiting and retrying...');
          await new Promise(resolve => setTimeout(resolve, 1500));
          sessionResult = await waitForSession(5, 600);
        }
        
        // Last attempt with even longer delay
        if (!sessionResult || !sessionResult.session) {
          console.log('⏳ School Admin layout: Still no session, final retry attempt...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          sessionResult = await waitForSession(4, 800);
        }
        
        if (!sessionResult || !sessionResult.session) {
          console.error('❌ School Admin layout: No session found after all retries, redirecting to login');
          console.error('❌ This might indicate a session persistence issue');
          if (mounted) {
            setStatus('unauthenticated');
            setLogoutReason('session_timeout');
            router.push('/lms/login');
          }
          return;
        }
        
        const session = sessionResult.session;
        if (mounted) setStatus('authenticated');
        if (session.access_token) setAuthToken(session.access_token);
        const userId = getStoredUserId();
        if (!userId) {
          setLogoutReason('wrong_role');
          if (mounted) router.push("/lms/login");
          return;
        }
        console.log("✅ School Admin layout: Session found, user ID:", userId);
        const user = { id: userId, email: session.user?.email ?? null };
        
        // Get profile + school in parallel via centralized API clients (bypass RLS)
        let profile = null;
        let school = null;
        try {
          const [profileRes, schoolRes] = await Promise.all([
            schoolAdminApi.profile.get(),
            schoolAdminApi.school.get(),
          ]);

          // The backend may return either the user object directly,
          // or `{ user: {...} }` for some endpoints. We only treat
          // `data.user` as a wrapper — never `data.profile`, which is
          // the nested Prisma profile relation (name/phone), not the user.
          const profileData = (profileRes.data ?? {}) as Record<string, unknown>;
          profile = (
            (profileData as { user?: unknown }).user ?? profileData
          ) as UserProfile;
          if (!profile || !('role' in profile)) {
            throw new Error('Profile not found in API response');
          }

          const schoolData = schoolRes.data ?? {};
          school = ((schoolData as { school?: unknown }).school ?? null) as SchoolInfo | null;
          if (school) {
            console.log('✅ School loaded successfully:', (school as { name?: string }).name);
          } else {
            console.warn('⚠️ School API returned ok but no school data');
          }
         
        } catch (err: unknown) {
          console.error('Error loading bootstrap data:', err instanceof Error ? err.message : err);
          setLogoutReason('error');
          if (mounted) router.push('/lms/login');
          return;
        }
          
        if (!profile) {
          console.error('Profile not found after all attempts');
          if (mounted) {
            setLogoutReason('error');
            router.push('/lms/login');
          }
          return;
        }
        
        console.log('✅ Profile found:', profile.role);
        
        // Normalize role for comparison
        const normalizedRole = profile?.role?.trim().toLowerCase();
        if (normalizedRole !== 'school_admin') {
          console.log('User is not a school admin. Role:', profile.role, 'Normalized:', normalizedRole);
          if (mounted) {
            // Send to /login (terminal state), NOT /redirect.
            // /redirect calls /get-role and then routes by role — which
            // would just bounce the user right back here and loop.
            clearStoredSession();
            setLogoutReason('wrong_role');
            router.push('/lms/login');
          }
          return;
        }

        // Check if school admin is active
        // Note: This check is also performed in getSchoolAdminSchoolId which requires is_active=true
        // So if we get past that point, the admin is active. This is just a redundant check.
        // We'll skip it here to avoid RLS issues and rely on the API route checks.

        if (!school && profile.school_id) {
          console.warn('School not loaded from API, but school_id exists.');
        }
        
        if (mounted) {
          setUser(user);
          setUserProfile(profile);
          setSchoolInfo(school);
          setLoading(false);
          isInitialMountRef.current = false; // Mark initial mount as complete
          userLoadedRef.current = true; // Mark user as loaded
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        if (mounted) {
          setStatus('unauthenticated');
          setLoading(false);
          // Don't redirect immediately on error, give it a moment
          timeoutId = setTimeout(() => {
            if (mounted) {
              setLogoutReason('session_timeout');
              router.push('/lms/login');
            }
          }, 1000);
        }
      } finally {
        // Always clear the in-progress flag
        getUserInProgressRef.current = false;
        isInitialMountRef.current = false;
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
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [router]); // Include router for consistency, even though it's stable in Next.js 13+

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading school admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <SchoolAdminProvider
      initialSchoolInfo={_schoolInfo}
      initialProfileFullName={userProfile?.full_name ?? null}
    >
      <div className="flex h-screen bg-gray-50" style={{ backgroundColor: '#f9fafb' }}>
        <ForcePasswordChange />
      <AnnouncementBanner />
      <ImpersonationBanner />
        <Sidebar 
          userRole="school_admin"
          userName={userProfile?.full_name || user?.email || "School Admin"}
          userEmail={user?.email || "admin@school.com"}
          onLogout={handleLogout}
          notificationBadgeCount={unreadNotificationCount}
        />
        
        <div className="flex-1 overflow-y-auto" data-dashboard-content style={{ backgroundColor: '#f9fafb' }}>
          {children}
        </div>
      </div>
    </SchoolAdminProvider>
  );
}
