"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../lib/api';
import { clearStoredSession, getStoredUserId, getSession, setLogoutReason } from '../lib/session-utils';
import { toast } from '../components/ui/toast';

// Key used to mark that a fresh login just happened
const FRESH_LOGIN_KEY = 'fresh_login_timestamp';
const FRESH_LOGIN_GRACE_PERIOD = 300000; // 5 minutes grace period after login (300 seconds)
// This long grace period ensures that normal page loads and React re-renders
// don't trigger false "logged in from another device" alerts.
// The session validation will only kick in after 5 minutes of being logged in,
// which is enough time to properly detect actual multi-device login scenarios.

interface SessionValidationOptions {
  checkInterval?: number; // Interval in milliseconds to check session validity
  onSessionInvalid?: (reason: string, message: string) => void;
  redirectOnInvalid?: boolean;
  showAlert?: boolean;
}

interface SessionValidationResult {
  isValid: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
  checkSession: () => Promise<boolean>;
  logout: () => Promise<void>;
}

// Check if user just logged in recently (within grace period)
function isWithinLoginGracePeriod(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const loginTimestamp = sessionStorage.getItem(FRESH_LOGIN_KEY);
    if (!loginTimestamp) return false;
    
    const loginTime = parseInt(loginTimestamp, 10);
    const now = Date.now();
    const elapsed = now - loginTime;
    
    // If within grace period, don't validate yet
    if (elapsed < FRESH_LOGIN_GRACE_PERIOD) {
      console.log(`Session validation: within grace period (${elapsed}ms since login)`);
      return true;
    }
    
    // Grace period expired, clear the flag
    sessionStorage.removeItem(FRESH_LOGIN_KEY);
    return false;
  } catch (e) {
    return false;
  }
}

// Mark that a fresh login just happened (call this from login success)
export function markFreshLogin(): void {
  if (typeof window === 'undefined') return;
  
  try {
    sessionStorage.setItem(FRESH_LOGIN_KEY, Date.now().toString());
  } catch (e) {
    console.warn('Could not mark fresh login:', e);
  }
}

export function useSessionValidation(options: SessionValidationOptions = {}): SessionValidationResult {
  const {
    checkInterval = 60000, // Default: check every 60 seconds
    onSessionInvalid,
    redirectOnInvalid = true,
    showAlert = true
  } = options;

  const [isValid, setIsValid] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const router = useRouter();
  const checkInProgressRef = useRef(false);
  const hasShownAlertRef = useRef(false);
  const isFirstCheckRef = useRef(true);

  const _handleInvalidSession = useCallback((reason: string, message: string) => {
    setIsValid(false);
    
    if (onSessionInvalid) {
      onSessionInvalid(reason, message);
    }
    
    // Clear locally stored session (backend tokens)
    try {
      clearStoredSession();
    } catch (err) {
      console.error('Error clearing stored session:', err);
    }
    
    if (showAlert && !hasShownAlertRef.current) {
      hasShownAlertRef.current = true;
      
      // Build a more descriptive message based on reason
      const alertMessage = reason === 'SESSION_SUPERSEDED' 
        ? 'You have been logged out because you logged in from another device. For security reasons, only one active session is allowed at a time.'
        : message;
      
      // Show a persistent notice; it survives the client-side redirect below.
      if (typeof window !== 'undefined') {
        toast.warning(alertMessage, 8000);
      }
    }
    
    if (redirectOnInvalid) {
      // Small delay to ensure alert is shown
      setTimeout(() => {
        setLogoutReason('session_expired');
        router.push('/lms/login');
      }, 100);
    }
  }, [onSessionInvalid, redirectOnInvalid, showAlert, router]);

  const checkSession = useCallback(async (): Promise<boolean> => {
    // Prevent concurrent checks
    if (checkInProgressRef.current) {
      return isValid;
    }

    try {
      checkInProgressRef.current = true;
      setIsChecking(true);

      // Skip validation during login grace period (fresh login)
      if (isWithinLoginGracePeriod()) {
        console.log('Skipping session validation - within login grace period');
        setIsValid(true);
        setLastChecked(new Date());
        return true;
      }

      const userId = getStoredUserId();
      if (!userId) {
        // No user - but don't show error if we're on login-related pages
        const currentPath = window.location.pathname;
        if (currentPath === '/lms/login' || currentPath === '/lms/signup' || currentPath.startsWith('/lms/auth')) {
          return true; // It's fine to not have a user on auth pages
        }
        
        // No user - redirect to login silently
        // SECURITY: Can't check session_token cookie client-side (httpOnly), but that's fine
        // - If user just logged in, Supabase auth state will update soon
        // - If no valid session, redirect to login
        if (redirectOnInvalid) {
          setLogoutReason('session_expired');
          router.push('/lms/login');
        }
        return false;
      }

      // Skip inactivity-based validation for now; auth token validity is handled by the backend.
      
      // Mark first check as done
      isFirstCheckRef.current = false;

      setIsValid(true);
      setLastChecked(new Date());
      hasShownAlertRef.current = false; // Reset alert flag on valid session
      return true;
    } catch (error) {
      console.error('Error checking session:', error);
      // Don't invalidate on network errors - just log and continue
      return isValid;
    } finally {
      setIsChecking(false);
      checkInProgressRef.current = false;
    }
  }, [isValid, redirectOnInvalid, router]);

  const logout = useCallback(async () => {
    try {
      // Best-effort server logout (if your backend supports it),
      // but always clear local tokens to ensure UI logs out.
      try {
        const { data } = await getSession();
        const token = data.session?.access_token;
        if (token) {
          await apiClient.post(
            '/api/auth/logout',
            {},
            { headers: { Authorization: `Bearer ${token}` }, validateStatus: (s) => s >= 200 && s < 500 }
          );
        }
      } catch {
        // ignore
      }

      // Set reason BEFORE clearing so session-validation race can't overwrite it
      setLogoutReason('logged_out');
      clearStoredSession(true, 'logged_out');

      // Redirect to login
      window.location.href = '/lms/login';
    } catch (error) {
      console.error('Error during logout:', error);
      setLogoutReason('logged_out');
      // Force redirect even on error
      window.location.href = '/lms/login';
    }
  }, []);

  // Set up periodic session validation
  useEffect(() => {
    // Reset first check ref on mount
    isFirstCheckRef.current = true;
    
    // Initial check after component mounts (with a longer delay to allow cookies to settle)
    // This is especially important after a redirect from login
    const initialCheck = setTimeout(() => {
      // If within grace period, skip this check entirely
      if (isWithinLoginGracePeriod()) {
        console.log('Initial session check skipped - within grace period');
        return;
      }
      checkSession();
    }, 5000); // 5 second delay for initial check

    // Set up interval for periodic checks (less aggressive - every 2 minutes)
    const intervalId = setInterval(() => {
      // Always check grace period before any validation
      if (isWithinLoginGracePeriod()) {
        console.log('Periodic session check skipped - within grace period');
        return;
      }
      checkSession();
    }, Math.max(checkInterval, 120000)); // At least 2 minutes between checks

    // Track last check time to prevent excessive checks on tab switches
    let lastFocusCheck = 0;
    let lastVisibilityCheck = 0;
    const MIN_CHECK_INTERVAL = 60000; // Minimum 1 minute between focus/visibility checks

    // Also check when the window regains focus (but not during grace period)
    // Throttled to prevent excessive checks when rapidly switching tabs
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusCheck < MIN_CHECK_INTERVAL) {
        return; // Skip if checked recently
      }
      lastFocusCheck = now;

      // Add a small delay when focusing to avoid race conditions
      setTimeout(() => {
        if (!isWithinLoginGracePeriod()) {
          checkSession();
        }
      }, 2000); // Increased delay to reduce race conditions
    };

    // Check when the page becomes visible again (but not during grace period)
    // Throttled to prevent excessive checks when rapidly switching tabs
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastVisibilityCheck < MIN_CHECK_INTERVAL) {
          return; // Skip if checked recently
        }
        lastVisibilityCheck = now;

        // Add a small delay when becoming visible
        setTimeout(() => {
          if (!isWithinLoginGracePeriod()) {
            checkSession();
          }
        }, 2000); // Increased delay to reduce race conditions
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(initialCheck);
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkSession, checkInterval]);

  return {
    isValid,
    isChecking,
    lastChecked,
    checkSession,
    logout
  };
}


