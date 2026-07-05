/**
 * Axios instance for API requests.
 * Always targets the backend at NEXT_PUBLIC_API_BASE_URL.
 */

import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import {
  clearStoredSession,
  getInMemoryToken,
  getStoredSession,
  getStoredUser,
  setInMemoryToken,
  setStoredSession,
  tryRefreshSession,
  setLogoutReason,
} from '../session-utils';

type RefreshableAxiosRequestConfig = AxiosRequestConfig & {
  skipAuthRefresh?: boolean;
  _retry?: boolean;
};

const getBaseURL = (): string => {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
};

export const apiClient: AxiosInstance = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000,
  withCredentials: true,
});

let isRefreshing = false;
let refreshSubscribers: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function notifyRefreshSubscribers(token: string) {
  refreshSubscribers.forEach((s) => s.resolve(token));
  refreshSubscribers = [];
}

function rejectRefreshSubscribers(err: unknown) {
  refreshSubscribers.forEach((s) => s.reject(err));
  refreshSubscribers = [];
}

function performLogout(): void {
  clearStoredSession();
  setAuthToken(null);
  if (typeof window !== 'undefined') {
    setLogoutReason('session_expired');
    window.location.href = '/lms/login';
  }
}

async function refreshAccessToken(): Promise<string> {
  const session = getStoredSession();

  const REFRESH_TIMEOUT_MS = 10000;

  const refreshPromise = apiClient.post(
    '/auth/refresh',
    {},
    { skipAuthRefresh: true } as RefreshableAxiosRequestConfig,
  );

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Token refresh timed out')), REFRESH_TIMEOUT_MS),
  );

  const res = await Promise.race([refreshPromise, timeoutPromise]);

  const { tokens } = res.data as { tokens?: { accessToken?: string } };
  const newAccessToken = tokens?.accessToken;

  if (!newAccessToken) throw new Error('Invalid refresh response');

  setAuthToken(newAccessToken);
  setStoredSession({ access_token: newAccessToken, user: session?.user });

  return newAccessToken;
}

// Deduped silent token bootstrap.
//
// The access token lives in memory only and is wiped on every page reload, so
// after a reload it must be rehydrated from the httpOnly refresh cookie before
// any authenticated request goes out. Without this, data hooks that fire on
// mount race the layout's session bootstrap and leave without an Authorization
// header — producing benign-but-noisy 401s (and an extra refresh + retry) on
// every dashboard. We rehydrate proactively here, once, at the single chokepoint
// every request passes through.
//
// tryRefreshSession() uses fetch (not apiClient), so it never re-enters this
// interceptor — no recursion. Concurrent callers share one in-flight promise.
let tokenBootstrapPromise: Promise<boolean> | null = null;

function bootstrapTokenOnce(): Promise<boolean> {
  if (!tokenBootstrapPromise) {
    tokenBootstrapPromise = tryRefreshSession().finally(() => {
      tokenBootstrapPromise = null;
    });
  }
  return tokenBootstrapPromise;
}

function isAuthFlowUrl(url: string): boolean {
  return (
    url.includes('/auth/refresh') ||
    url.includes('/auth/login') ||
    url.includes('/auth/signup')
  );
}

// Request interceptor: attach in-memory token + CSRF header.
apiClient.interceptors.request.use(
  async (config) => {
    if (typeof window !== 'undefined') {
      let token = getInMemoryToken();

      // Token missing but a user was logged in this session (metadata survives
      // reloads): rehydrate before sending so the request isn't rejected with a
      // 401. Skip for auth-flow endpoints and explicit refresh calls to avoid
      // loops, and skip when there's no session metadata so anonymous/public
      // pages never trigger refresh attempts.
      const skipRefresh = (config as RefreshableAxiosRequestConfig).skipAuthRefresh;
      if (!token && !skipRefresh && !isAuthFlowUrl(config.url ?? '') && getStoredUser()) {
        await bootstrapTokenOnce();
        token = getInMemoryToken();
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      if (config.method && !['get', 'head'].includes(config.method.toLowerCase())) {
        try {
          const { getCsrfTokenCached } = await import('../csrf-client');
          const csrf = await getCsrfTokenCached();
          if (csrf) config.headers['x-csrf-token'] = csrf;
        } catch {
          // CSRF optional for auth endpoints.
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: transparent token refresh on 401.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const isNetworkError =
      !error.response &&
      (error.code === 'ERR_NETWORK' || error.message === 'Network Error');
    const message = isNetworkError
      ? 'Cannot connect to the server. Please check that the app and backend are running.'
      : error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Request failed';

    if (status === 401 && typeof window !== 'undefined') {
      const config = error.config as RefreshableAxiosRequestConfig | undefined;
      const skipRefresh = config?.skipAuthRefresh;
      const alreadyRetried = config?._retry;

      // Wrong credentials on login/signup — surface to the UI, don't refresh.
      const url = config?.url ?? '';
      const isCredentialEndpoint =
        url.endsWith('/auth/login') ||
        url.endsWith('/auth/signup') ||
        url.endsWith('/api/auth/login') ||
        url.endsWith('/api/auth/signup');
      if (isCredentialEndpoint) return Promise.reject(new Error(message));

      if (skipRefresh || alreadyRetried) {
        performLogout();
        return Promise.reject(new Error(message));
      }

      if (config) config._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        refreshAccessToken()
          .then((newToken) => {
            isRefreshing = false;
            notifyRefreshSubscribers(newToken);
          })
          .catch((refreshErr) => {
            isRefreshing = false;
            rejectRefreshSubscribers(refreshErr);
            performLogout();
          });
      }

      return new Promise((resolve, reject) => {
        refreshSubscribers.push({
          resolve: (newToken: string) => {
            if (config) {
              config.headers = config.headers ?? {};
              (config.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
            }
            resolve(apiClient.request(config as RefreshableAxiosRequestConfig));
          },
          reject: (subErr: unknown) => reject(subErr ?? new Error(message)),
        });
      });
    }

    return Promise.reject(new Error(message));
  },
);

/**
 * Store the access token in memory (call after login / token refresh).
 * Never writes to sessionStorage or localStorage.
 */
export function setAuthToken(token: string | null): void {
  setInMemoryToken(token);
}

/**
 * Read the current in-memory access token.
 */
export function getAuthToken(): string | null {
  return getInMemoryToken();
}

export type { AxiosInstance, AxiosRequestConfig };
