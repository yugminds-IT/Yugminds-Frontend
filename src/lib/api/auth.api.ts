import { apiClient, setAuthToken } from './axios';
import type { AuthResponse, LoginRequest, SignupRequest } from './types';

const AUTH_BASE = '/auth';

/**
 * Login/signup must hit same-origin `/api/auth/*` so the route can set the
 * httpOnly `access_token` cookie. Without it, full reloads and dev Fast Refresh
 * clear the in-memory token and `/api/auth/refresh` cannot rehydrate the session.
 */
async function postAuthBff(
  path: '/api/auth/login' | '/api/auth/signup',
  body: LoginRequest | SignupRequest,
): Promise<AuthResponse> {
  if (typeof window === 'undefined') {
    throw new Error(`${path} must be called from the browser`);
  }

  const res = await fetch(`${window.location.origin}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }

  const data = parsed as Partial<AuthResponse> & { message?: string; error?: string };

  if (!res.ok) {
    // Normalize message — NestJS can nest the full error object inside `message`
    const rawMsg = data?.message;
    const msgStr =
      typeof rawMsg === 'string'
        ? rawMsg
        : typeof rawMsg === 'object' && rawMsg !== null && 'message' in (rawMsg as object)
          ? String((rawMsg as { message: unknown }).message)
          : typeof data?.error === 'string'
            ? data.error
            : typeof parsed === 'string'
              ? parsed
              : `Request failed (${res.status})`;
    const err = new Error(msgStr) as Error & { status?: number; data?: unknown };
    err.status = res.status;
    err.data = parsed;
    throw err;
  }

  if (!data.user || !data.tokens?.accessToken) {
    throw new Error('Invalid auth response');
  }

  setAuthToken(data.tokens.accessToken);
  return data as AuthResponse;
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  return postAuthBff('/api/auth/login', data);
}

export async function signup(data: SignupRequest): Promise<AuthResponse> {
  return postAuthBff('/api/auth/signup', data);
}

export async function refresh(): Promise<AuthResponse> {
  const res = await fetch(
    typeof window !== 'undefined' ? `${window.location.origin}/api/auth/refresh` : '/api/auth/refresh',
    { method: 'POST', credentials: 'include' },
  );
  const data = (await res.json()) as {
    token?: string;
    tokens?: { accessToken?: string };
  };
  const token = data.token ?? data.tokens?.accessToken;
  if (!res.ok || !token) {
    throw new Error('Invalid refresh response');
  }
  setAuthToken(token);
  return { tokens: { accessToken: token } } as AuthResponse;
}

export const authApi = {
  login,
  signup,
  refresh,
  updatePassword: (data: { new_password: string; current_password?: string }) =>
    apiClient.post(`${AUTH_BASE}/update-password`, data),
  verifyPassword: (data: { current_password: string }) =>
    apiClient.post<{ valid: boolean }>(`${AUTH_BASE}/verify-password`, data),
};
