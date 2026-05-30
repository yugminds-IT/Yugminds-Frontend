"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { addTokensToHeaders } from "@/lib/csrf-client";
import { apiClient, withParams } from "@/lib/api";
import { getStoredUserId, getSession } from "@/lib/session-utils";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const userId = getStoredUserId();
        const { data } = await getSession();
        const token = data.session?.access_token;

        if (userId && token) {
          // Fetch user role from API instead of guessing from email
          try {
            const headers = {
              ...(await addTokensToHeaders()),
            } as Record<string, string>;
            const { data: json } = await apiClient.get(
              withParams('/get-role', { userId }),
              {
                headers,
              }
            );
            const userRole = (json as { role?: string })?.role;
              
            if (userRole) {
              const forcePasswordChange = Boolean((json as { force_password_change?: boolean })?.force_password_change);
              // Use the redirect API for role-based routing
              window.location.href = `/api/auth/redirect?userId=${userId}&role=${encodeURIComponent(userRole)}&force_password_change=${forcePasswordChange}`;
              return;
            }
          } catch (roleError) {
            console.error('Error fetching role in auth callback:', roleError);
          }
          
          // Fallback: redirect to login if role cannot be determined
          router.push('/lms/login');
        } else {
          router.push('/');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        router.push('/?error=auth_error');
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
    </div>
  );
}
