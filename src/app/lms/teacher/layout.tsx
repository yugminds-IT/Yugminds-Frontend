"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import PortalShell from "@/components/portal/PortalShell";
import PortalSidebar from "@/components/portal/PortalSidebar";
import PasswordPrompt from "@/components/portal/PasswordPrompt";
import { TEACHER_NAV } from "@/components/portal/navs";
import "@/components/portal/portal.css";
import "@/components/teacher/chrome.css";
import StatusScreen from "@/components/public/StatusScreen";
import { TeacherSchoolContext, type TeacherSchool } from "./context";
import { pickCurrentSchoolId, type DaySlotMap } from "@/lib/weekday-utils";
import { useSessionValidation } from "@/hooks/useSessionValidation";
import { startActivityTracking, stopActivityTracking } from "@/lib/activity-tracker";
import { waitForSession } from "@/lib/session-utils";
import { useAppStore, type AppState } from "@/store/app-store";
import { useBrowserNavigation } from "@/hooks/useBrowserNavigation";
import { commonApi, teacherApi, setAuthToken, apiClient } from "@/lib/api";
import { getStoredUserId, setLogoutReason } from "@/lib/session-utils";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import ResponsiveTables from "@/components/ResponsiveTables";
import TeacherHolidayBanner from "@/components/teacher/TeacherHolidayBanner";
import PendingReportsPopup from "@/components/teacher/PendingReportsPopup";

/** Sentinel stored/selected in place of a real school id to mean "combine data across every assigned school" — every teacher hook already treats an omitted school id as "aggregate across all schools." */
const ALL_SCHOOLS_VALUE = "__all__";

/**
 * Teacher Dashboard Layout
 * 
 * Provides authentication, school selection, and consistent layout
 * consistent with School Admin and Admin dashboards
 */
// Among today's working schools, those with real timetable classes win.
const preferWithClasses = (working: string[], withClasses: string[]) => {
  const hit = working.filter((id) => withClasses.includes(id));
  return hit.length ? hit : working;
};

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  type AuthUser = { id: string; email?: string };
  type UserProfile = { id: string; full_name?: string; email?: string; role?: string };
  type School = TeacherSchool & { id: string; name: string };
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
   
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  // Which of the teacher's schools they're actually on duty at today —
  // resolved from TeacherWorkingDaysHistory + SchoolCalendar, fetched once
  // across all assigned schools so the switcher can show "today's school"
  // instead of just whatever was last selected (localStorage-based, with
  // no relation to the actual weekly schedule).
  const [todayWorkStatus, setTodayWorkStatus] = useState<{
    working: string[];
    withClasses: string[];
    holiday: string[];
    off: string[];
    slots: Record<string, { slot: string; start: string; end: string }>;
  } | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const router = useRouter();
  const { count: unreadNotificationCount } = useUnreadNotificationCount({ enabled: !loading, role: 'teacher' });
  
  // Get sidebar state from store
  const sidebarCollapsed = useAppStore((state: AppState) => state.sidebarCollapsed);
  const _setSidebarCollapsed = useAppStore((state: AppState) => state.setSidebarCollapsed);

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
        selectedSchoolId: selectedSchool?.id ?? null,
      };
    } catch (error) {
      console.warn('Error getting state to save:', error);
      return {};
    }
  }, [sidebarCollapsed, user, selectedSchool]);

  // Use browser navigation hook to preserve state
  // Note: warnOnUnsavedChanges is false because layout state (sidebar collapse) is not "unsaved changes"
  useBrowserNavigation({
    componentId: 'teacher-layout',
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

    const getUser = async () => {
      // Concurrency protection: prevent multiple simultaneous calls
      if (getUserInProgressRef.current) {
        console.log('⏸️ Teacher layout: getUser already in progress, skipping...');
        return;
      }

      // If user is already loaded, don't reload unless explicitly needed
      if (userLoadedRef.current && !isInitialMountRef.current) {
        console.log('⏸️ Teacher layout: User already loaded, skipping getUser...');
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
          console.log('🔄 Teacher layout: Detected redirect, waiting for session to settle...');
          await new Promise(resolve => setTimeout(resolve, 1500));
          sessionStorage.removeItem('_redirecting');
        }
        
        // Check session with retry logic (important after redirect from login)
        console.log('🔍 Teacher layout: Checking for session...');
        let sessionResult = await waitForSession(6, 600);
        
        // If no session found, try one more time with longer delay
        if (!sessionResult || !sessionResult.session) {
          console.log('⏳ Teacher layout: No session found, waiting and retrying...');
          await new Promise(resolve => setTimeout(resolve, 1500));
          sessionResult = await waitForSession(5, 600);
        }
        
        // Last attempt with even longer delay
        if (!sessionResult || !sessionResult.session) {
          console.log('⏳ Teacher layout: Still no session, final retry attempt...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          sessionResult = await waitForSession(4, 800);
        }
        
        if (!sessionResult || !sessionResult.session) {
          console.error('❌ Teacher layout: No session found after all retries, redirecting to login');
          console.error('❌ This might indicate a session persistence issue');
          if (mounted) {
            setStatus('unauthenticated');
            setLogoutReason('session_timeout');
            router.push('/lms/login');
          }
          return;
        }
        
        const session = sessionResult.session;
        if (!session.user?.id) {
          if (mounted) {
            setStatus('unauthenticated');
            setLogoutReason('session_expired');
            router.push('/lms/login');
          }
          return;
        }
        if (mounted) setStatus('authenticated');
        const expiresAtSec = session.expires_in
          ? Math.floor(Date.now() / 1000) + session.expires_in
          : undefined;
        console.log('✅ Teacher layout: Session found, user ID:', session.user.id);
        if (expiresAtSec) {
          console.log('✅ Teacher layout: Session expires at:', new Date(expiresAtSec * 1000).toISOString());
        }
        // Ensure our centralized API client has the latest bearer token
        // (apiClient reads from session/local storage via interceptor, but we also set it explicitly here).
        if (session?.access_token) setAuthToken(session.access_token);
        
        // Verify session is valid and not expired
        const now = Math.floor(Date.now() / 1000);
        if (expiresAtSec && expiresAtSec < now) {
          console.error('❌ Teacher layout: Session is expired');
          if (mounted) {
            setLogoutReason('wrong_role');
            router.push('/lms/login');
          }
          return;
        }

        // Get user profile via API (bypasses RLS)
        let profile = null;
        try {
          const { data: profileData } = await commonApi.profile.get({ userId: session.user.id });
          const raw = profileData as { profile?: UserProfile | null } | UserProfile;
          profile =
            ('profile' in raw && raw.profile)
              ? raw.profile
              : ('role' in raw && raw.id != null)
                ? { ...raw, id: String(raw.id) }
                : null;
        } catch (err) {
          console.error('Error loading profile:', err);
          setLogoutReason('wrong_role');
          if (mounted) router.push('/lms/login');
          return;
        }

        if (!profile) {
          setLogoutReason('wrong_role');
          if (mounted) router.push('/lms/login');
          return;
        }

        // Verify role (normalize role for comparison)
        const normalizedRole = profile.role?.trim().toLowerCase();
        if (normalizedRole !== 'teacher') {
          console.log('Teacher layout: User is not a teacher! Role:', profile.role, 'Normalized:', normalizedRole);
          if (mounted) router.push('/lms/redirect');
          return;
        }

        // Get teacher's assigned schools via API route (bypasses RLS securely)
         
        let schoolsData: School[] = [];
        try {
          const { data: schoolsResult } = await teacherApi.schools.list();
          schoolsData = ((schoolsResult as { schools?: School[] })?.schools ?? []) as School[];
        } catch (err) {
          console.error('Error fetching schools:', err);
        }

        if (mounted) {
          setUser({ id: session.user.id, email: session.user.email });
          setUserProfile(profile);
          setSchools(schoolsData);
          
          // Restore saved school selection, otherwise use first school
          if (schoolsData.length > 0) {
            let schoolToSelect: School | null = schoolsData[0];

            // localStorage survives new tabs; fall back to the old
            // sessionStorage key so existing sessions keep their selection.
            if (typeof window !== 'undefined') {
              try {
                const savedSchoolId =
                  localStorage.getItem('teacherSelectedSchoolId') ||
                  sessionStorage.getItem('selectedSchoolId');
                if (savedSchoolId === ALL_SCHOOLS_VALUE && schoolsData.length > 1) {
                  schoolToSelect = null;
                } else if (savedSchoolId) {
                  const savedSchool = schoolsData.find((s: School) => s.id === savedSchoolId);
                  if (savedSchool) {
                    schoolToSelect = savedSchool;
                  }
                }
              } catch (err) {
                console.warn('Error reading saved school selection:', err);
              }
            }

            setSelectedSchool(schoolToSelect);
            if (typeof window !== 'undefined') {
              try {
                const valueToStore = schoolToSelect?.id ?? ALL_SCHOOLS_VALUE;
                localStorage.setItem('teacherSelectedSchoolId', valueToStore);
                sessionStorage.setItem('selectedSchoolId', valueToStore);
              } catch (err) {
                console.warn('Error persisting school selection:', err);
              }
            }
          }
          setLoading(false);
          isInitialMountRef.current = false; // Mark initial mount as complete
          userLoadedRef.current = true; // Mark user as loaded

          if (schoolsData.length > 1) {
            teacherApi.dashboard
              .get()
              .then(({ data }) => {
                const meta = (data as {
                  meta?: {
                    working_school_ids_today?: string[];
                    class_school_ids_today?: string[];
                    holiday_school_ids_today?: string[];
                    off_schedule_school_ids_today?: string[];
                    day_slots_today?: Record<string, { slot: string; start: string; end: string }>;
                  };
                })?.meta;
                if (meta && mounted) {
                  setTodayWorkStatus({
                    working: meta.working_school_ids_today ?? [],
                    withClasses: meta.class_school_ids_today ?? [],
                    holiday: meta.holiday_school_ids_today ?? [],
                    off: meta.off_schedule_school_ids_today ?? [],
                    slots: meta.day_slots_today ?? {},
                  });
                }
                // Once per login, open the school the teacher is at right now
                // (weekday + time window); manual switches stick afterwards.
                if (meta && mounted) {
                  try {
                    const d = new Date();
                    const today = d.toDateString();
                    // once per calendar day: a manual switch sticks for the day,
                    // a new day (or fresh login) opens that day's school again.
                    if (sessionStorage.getItem('teacherAutoSchoolDone') !== today) {
                      sessionStorage.setItem('teacherAutoSchoolDone', today);
                      const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                      const id = pickCurrentSchoolId(preferWithClasses(meta.working_school_ids_today ?? [], meta.class_school_ids_today ?? []), (meta.day_slots_today ?? {}) as DaySlotMap, hhmm);
                      const target = schoolsData.find((s: School) => s.id === id);
                      if (target) {
                        setSelectedSchool(target);
                        localStorage.setItem('teacherSelectedSchoolId', target.id);
                        sessionStorage.setItem('selectedSchoolId', target.id);
                      }
                    }
                  } catch {
                    /* storage unavailable — keep the restored selection */
                  }
                }
              })
              .catch(() => {
                /* Non-critical — switcher just won't show today's status. */
              });
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        if (mounted) {
          setStatus('unauthenticated');
          setLoading(false);
          setLogoutReason('error');
          router.push('/lms/login');
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

    // Listen for profile updates from settings page
    const handleProfileUpdate = async (event: Event) => {
      const customEvent = event as CustomEvent<{ profile: UserProfile }>;
      console.log('Profile updated event received:', customEvent.detail);
      if (mounted && customEvent.detail?.profile) {
        const updatedProfile = customEvent.detail.profile;
        setUserProfile(updatedProfile);
        
        try {
          const storedUserId = getStoredUserId();
          if (storedUserId) {
            const { data: profileData } = await apiClient.get(`/profile?userId=${storedUserId}&t=${Date.now()}`);
            const raw = profileData as { profile?: UserProfile | null } | UserProfile;
            const refreshedProfile =
              ('profile' in raw && raw.profile)
                ? raw.profile
                : ('role' in raw && raw.id != null)
                  ? { ...raw, id: String(raw.id) }
                  : null;
            if (refreshedProfile) {
              setUserProfile(refreshedProfile);
            }
          }
        } catch (err) {
          console.error('Error refreshing profile in layout:', err);
        }
      }
    };

    window.addEventListener('teacherProfileUpdated', handleProfileUpdate);

    // Listen for storage changes (logout from another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'session_token' && !e.newValue && mounted) {
        getUserInProgressRef.current = false;
        userLoadedRef.current = false;
        setUser(null);
        setLogoutReason('session_expired');
        router.push('/lms/login');
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      mounted = false;
      getUserInProgressRef.current = false;
      window.removeEventListener('teacherProfileUpdated', handleProfileUpdate as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run once on mount, router stable
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
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('selectedSchoolId');
        sessionStorage.removeItem('teacherAutoSchoolDone');
        localStorage.removeItem('teacherSelectedSchoolId');
      } catch (err) {
        console.warn('Error clearing school selection:', err);
      }
    }
    setAuthToken(null);
    await logout();
  };


  const handleSelectAllSchools = () => {
    setSelectedSchool(null);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('teacherSelectedSchoolId', ALL_SCHOOLS_VALUE);
        sessionStorage.setItem('selectedSchoolId', ALL_SCHOOLS_VALUE);
      } catch (err) {
        console.warn('Error persisting school selection:', err);
      }
    }
  };

  const handleSchoolChange = (school: TeacherSchool | null) => {
    if (!school?.id) return;
    setSelectedSchool(school as School);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('teacherSelectedSchoolId', school.id!);
        sessionStorage.setItem('selectedSchoolId', school.id!);
      } catch (err) {
        console.warn('Error persisting school selection:', err);
      }
    }
  };

  if (status === 'loading') {
    return <StatusScreen variant="loading" title="Loading the teacher dashboard." />;
  }

  if (status === 'unauthenticated') {
    return null;
  }

  if (loading) {
    return <StatusScreen variant="loading" title="Loading the teacher dashboard." />;
  }


  return (
    <PortalShell
      top={
        <>
          <PasswordPrompt />
          <AnnouncementBanner />
          <ResponsiveTables />
          <ImpersonationBanner />
        </>
      }
      sidebar={
        <PortalSidebar
          nav={TEACHER_NAV}
          brand={{ title: "Teacher portal", sub: "RoboCoders LMS" }}
          userName={userProfile?.full_name || user?.email || "Teacher"}
          userEmail={user?.email || "teacher@example.com"}
          onLogout={handleLogout}
          badges={{ "/lms/teacher/notifications": unreadNotificationCount }}
        />
      }
    >
        {/* School switcher */}
        {schools.length > 1 && (
          <div className="to-school">
            <label htmlFor="to-school-select">School</label>
            <select
              id="to-school-select"
              value={selectedSchool?.id || ALL_SCHOOLS_VALUE}
              onChange={(e) => {
                if (e.target.value === ALL_SCHOOLS_VALUE) {
                  handleSelectAllSchools();
                  return;
                }
                const school = schools.find((s: School) => s.id === e.target.value);
                if (school) handleSchoolChange(school);
              }}
              className="mc-select"
            >
              <option value={ALL_SCHOOLS_VALUE}>All schools (combined)</option>
              {schools.map((school) => {
                const isSunday = new Date().getDay() === 0;
                const half = todayWorkStatus?.slots[school.id];
                const noClasses =
                  !!todayWorkStatus?.working.includes(school.id) &&
                  todayWorkStatus.withClasses.length > 0 &&
                  !todayWorkStatus.withClasses.includes(school.id);
                const status = noClasses
                  ? ' — no classes today'
                  : todayWorkStatus?.working.includes(school.id)
                  ? half
                    ? ` — ${half.slot === 'MORNING' ? 'morning' : 'afternoon'} today (${half.start}–${half.end})`
                    : ' — working today'
                  : todayWorkStatus?.holiday.includes(school.id)
                    ? ' — holiday today'
                    : todayWorkStatus?.off.includes(school.id)
                      ? isSunday
                        ? ' — Sunday (weekly off)'
                        : ' — off today'
                      : '';
                return (
                  <option key={school.id} value={school.id}>
                    {school.name} {school.school_code ? `(${school.school_code})` : ''}
                    {status}
                  </option>
                );
              })}
            </select>
            {!selectedSchool && <p className="to-pill">Showing combined data across all {schools.length} of your schools.</p>}
            {todayWorkStatus && schools.length > 0 && (() => {
              const d = new Date();
              const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
              const todayId = pickCurrentSchoolId(preferWithClasses(todayWorkStatus.working, todayWorkStatus.withClasses), todayWorkStatus.slots as DaySlotMap, hhmm);
              const todaySchool = schools.find((s) => s.id === todayId);
              if (!todaySchool) {
                return <p className="to-pill">You have no school scheduled today.</p>;
              }
              const half = todayWorkStatus.slots[todaySchool.id];
              const when = half ? ` (${half.slot === 'MORNING' ? 'morning' : 'afternoon'}, ${half.start}–${half.end})` : '';
              if (selectedSchool?.id === todaySchool.id) {
                return <p className="to-pill">Today&apos;s school{when}</p>;
              }
              return (
                <p className="to-pill" data-tone="warn">
                  Today you are at {todaySchool.name}{when}.
                  <button type="button" onClick={() => handleSchoolChange(todaySchool)}>
                    Switch to today&apos;s school
                  </button>
                </p>
              );
            })()}
          </div>
        )}

        {/* Store selected school in context for child components */}
        <TeacherSchoolContext.Provider value={{ selectedSchool, schools, onSchoolChange: handleSchoolChange, profileName: userProfile?.full_name ?? null }}>
          <TeacherHolidayBanner selectedSchoolId={selectedSchool?.id ?? null} schools={schools} />
          <PendingReportsPopup />
          {children}
        </TeacherSchoolContext.Provider>
    </PortalShell>
  );
}
