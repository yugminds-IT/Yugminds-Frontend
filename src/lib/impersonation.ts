/**
 * Impersonation ("sign in as user") helpers for admins.
 *
 * Starting swaps the access-token cookie + in-memory token to a short-lived
 * token for the target user; the admin's refresh cookie is untouched, so
 * exiting simply refreshes back to the admin identity. The original admin
 * metadata is kept in sessionStorage so the banner can show who is really
 * signed in and restore them on exit.
 */

import { setAuthToken } from '@/lib/api';
import { setStoredSession, getStoredUser } from '@/lib/session-utils';

const IMPERSONATION_KEY = 'impersonation_original_admin';

export interface ImpersonationInfo {
  adminEmail: string | null;
  adminUserId: string | null;
  targetName: string | null;
  targetEmail: string | null;
  targetRole: string | null;
  startedAt: string;
}

export function getImpersonationInfo(): ImpersonationInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(IMPERSONATION_KEY);
    return raw ? (JSON.parse(raw) as ImpersonationInfo) : null;
  } catch {
    return null;
  }
}

export async function startImpersonation(userId: number): Promise<{ role: string }> {
  const res = await fetch('/api/admin/impersonate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });
  const data = (await res.json()) as {
    accessToken?: string;
    user?: { id: number; email: string; role: string; full_name: string | null };
    message?: string;
  };
  if (!res.ok || !data.accessToken || !data.user) {
    throw new Error(data?.message || 'Failed to start impersonation');
  }

  const original = getStoredUser();
  const info: ImpersonationInfo = {
    adminEmail: original?.email ?? null,
    adminUserId: original?.id ?? null,
    targetName: data.user.full_name,
    targetEmail: data.user.email,
    targetRole: data.user.role,
    startedAt: new Date().toISOString(),
  };
  sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(info));

  setAuthToken(data.accessToken);
  setStoredSession({
    access_token: data.accessToken,
    user: { id: String(data.user.id), email: data.user.email },
  });
  return { role: data.user.role };
}

export async function exitImpersonation(): Promise<void> {
  const res = await fetch('/api/admin/impersonate/exit', { method: 'POST' });
  const data = (await res.json()) as {
    token?: string;
    tokens?: { accessToken?: string };
    error?: string;
  };
  const token = data.token ?? data.tokens?.accessToken;
  if (!res.ok || !token) {
    throw new Error(data?.error || 'Failed to exit impersonation');
  }

  const info = getImpersonationInfo();
  sessionStorage.removeItem(IMPERSONATION_KEY);

  setAuthToken(token);
  setStoredSession({
    access_token: token,
    user: {
      id: info?.adminUserId ?? '',
      email: info?.adminEmail ?? undefined,
    },
  });
}

/** Route the impersonated user lands on, by role. */
export function impersonationLandingPath(role: string): string {
  switch (role) {
    case 'student':
      return '/lms/student';
    case 'teacher':
      return '/lms/teacher';
    case 'school_admin':
      return '/lms/school-admin';
    default:
      return '/lms/redirect';
  }
}
