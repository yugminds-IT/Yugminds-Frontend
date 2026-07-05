"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { addTokensToHeaders } from "@/lib/csrf-client";
import { apiClient, withParams } from "@/lib/api";
import { getStoredUserId, getSession, clearStoredSession, setLogoutReason } from "@/lib/session-utils";

// Circuit breaker: if the user lands on /redirect more than this many times
// inside the window below, something is bouncing them in a loop. Stop and
// force them to log in fresh rather than burning CPU + API budget.
const REDIRECT_HOP_LIMIT = 4;
const REDIRECT_HOP_WINDOW_MS = 10_000;
const REDIRECT_HOP_KEY = "_redirect_hops";

type HopState = { count: number; firstAt: number };

function bumpRedirectHopCount(): HopState {
  if (typeof window === "undefined") return { count: 0, firstAt: Date.now() };
  try {
    const raw = sessionStorage.getItem(REDIRECT_HOP_KEY);
    const now = Date.now();
    const prev = raw ? (JSON.parse(raw) as HopState) : null;
    const stale = !prev || now - prev.firstAt > REDIRECT_HOP_WINDOW_MS;
    const next: HopState = stale
      ? { count: 1, firstAt: now }
      : { count: prev!.count + 1, firstAt: prev!.firstAt };
    sessionStorage.setItem(REDIRECT_HOP_KEY, JSON.stringify(next));
    return next;
  } catch {
    return { count: 0, firstAt: Date.now() };
  }
}

function clearRedirectHopCount(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(REDIRECT_HOP_KEY);
  } catch {
    // ignore
  }
}

export default function RedirectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const redirectUser = async () => {
      try {
        // Circuit breaker: bail if /redirect is being hit in a tight loop.
        const hop = bumpRedirectHopCount();
        if (hop.count > REDIRECT_HOP_LIMIT) {
          console.error(`Redirect loop detected (${hop.count} hops). Forcing logout.`);
          clearRedirectHopCount();
          clearStoredSession();
          setError(
            "We detected a redirect loop and signed you out. Please log in again."
          );
          setLoading(false);
          return;
        }

        const userId = getStoredUserId();
        const { data } = await getSession();
        const session = data.session;

        if (!session || !userId) {
          console.log('No session found, redirecting to login');
          clearRedirectHopCount();
          setLogoutReason('session_expired');
          router.push('/lms/login');
          return;
        }

        // Get user role from API
        try {
          const headers = {
            ...(await addTokensToHeaders()),
          } as Record<string, string>;
          const { data: json } = await apiClient.get(withParams('/get-role', { userId }), { headers });
          let userRole = (json as { role?: string })?.role;

          if (!userRole) {
            setError("User role not found. Please contact support.");
            setLoading(false);
            return;
          }

          // Normalize role: trim whitespace and convert to lowercase
          userRole = userRole.trim().toLowerCase();

          // Redirect based on role
          const roleRoutes: Record<string, string> = {
            admin: '/lms/admin',
            super_admin: '/lms/admin',
            school_admin: '/lms/school-admin',
            teacher: '/lms/teacher',
            student: '/lms/student',
          };

          const redirectPath = roleRoutes[userRole] || '/lms/login';
          console.log(`Redirecting ${userRole} to ${redirectPath}`);

          // Successful resolution — reset the loop counter so a later
          // legitimate /redirect visit starts from zero.
          if (redirectPath !== '/lms/login') clearRedirectHopCount();

          // Redirect directly - no cookies needed
          router.push(redirectPath);
         
        } catch (error: unknown) {
          console.error('Error fetching role:', error);
          setError(error instanceof Error ? error.message : 'Failed to determine user role');
          setLoading(false);
        }
       
      } catch (error: unknown) {
        console.error('Redirect error:', error);
        setError('An unexpected error occurred');
        setLoading(false);
      }
    };

    redirectUser();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 font-medium">Error</p>
            <p className="text-red-500 text-sm mt-2">{error}</p>
          </div>
          <button
            onClick={() => router.push('/lms/login')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return null;
}







