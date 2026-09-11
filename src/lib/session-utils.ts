/**
 * Session Utilities
 *
 * Access tokens live in a module-level variable (in-memory) so they are never
 * reachable via JavaScript from other origins (XSS mitigation).  Only non-sensitive
 * user metadata (id, email, mustChangePassword) is persisted to sessionStorage so
 * that it survives soft navigation without storing a JWT there.
 *
 * The httpOnly `access_token` cookie (set by the Next.js auth API routes) lets the
 * middleware verify identity without touching JS-accessible storage.
 */

export interface Session {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id: string; email?: string; mustChangePassword?: boolean };
}

// In-memory store — cleared on page reload (intentional: forces a silent refresh
// via the httpOnly refresh_token cookie, which is the correct SPA pattern).
let _inMemoryToken: string | null = null;

const SESSION_STORAGE_KEY = 'auth_session_meta';
const LOGOUT_CHANNEL = 'auth_logout';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json =
      typeof globalThis.atob === 'function'
        ? globalThis.atob(padded)
        : Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// --- In-memory token accessors (used by axios.ts) ---

export function getInMemoryToken(): string | null {
  return _inMemoryToken;
}

export function setInMemoryToken(token: string | null): void {
  _inMemoryToken = token;
}

// --- Session helpers ---

export function getStoredSession(): Session | null {
  if (!_inMemoryToken) return null;
  const meta = readMeta();
  return { access_token: _inMemoryToken, user: meta ?? undefined };
}

export function setStoredSession(session: Session): void {
  _inMemoryToken = session.access_token;
  if (session.user) writeMeta(session.user);
}

export function clearStoredSession(broadcast = true, reason: LogoutReason = 'logged_out'): void {
  _inMemoryToken = null;
  removeMeta();
  // Wipe per-user course progress cache so completion never leaks to the next
  // user on a shared browser. Lazy import avoids any module-init ordering issues.
  void import('../store/course-progress-store')
    .then((m) => m.resetCourseProgressStore())
    .catch(() => {});
  if (broadcast && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const ch = new BroadcastChannel(LOGOUT_CHANNEL);
      ch.postMessage({ type: 'logout', reason });
      ch.close();
    } catch {
      // Non-fatal if BroadcastChannel is unavailable.
    }
  }
}

/**
 * Call once on app mount. Listens for logout events from other tabs and
 * redirects to /login so all tabs stay in sync.
 */
export function subscribeToLogoutBroadcast(): () => void {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return () => {};
  }
  const ch = new BroadcastChannel(LOGOUT_CHANNEL);
  ch.onmessage = (event: MessageEvent) => {
    const msg = event.data as { type?: string; reason?: LogoutReason };
    if (msg?.type === 'logout') {
      clearStoredSession(false); // clear without re-broadcasting
      setLogoutReason(msg.reason ?? 'logged_out');
      window.location.href = '/lms/login';
    }
  };
  return () => ch.close();
}

let refreshInFlight: Promise<boolean> | null = null;

async function doRefreshOnce(): Promise<boolean> {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) return false;

  const data = (await response.json()) as {
    token?: string;
    tokens?: { accessToken?: string };
  };
  const token = data.token ?? data.tokens?.accessToken;
  if (!token) return false;

  setInMemoryToken(token);
  const payload = decodeJwtPayload(token);
  const sub = payload?.sub;
  if (sub != null) {
    writeMeta({
      id: String(sub),
      email: typeof payload?.email === 'string' ? payload.email : undefined,
    });
  }
  return true;
}

export async function tryRefreshSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const run = () => doRefreshOnce();
    if (typeof navigator !== 'undefined' && 'locks' in navigator) {
      return navigator.locks.request('yugminds-auth-refresh', run);
    }
    const ok = await run();
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 300));
    return run();
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export function isAccessTokenExpiringSoon(skewSeconds = 90): boolean {
  if (!_inMemoryToken) return true;
  const payload = decodeJwtPayload(_inMemoryToken);
  const exp = typeof payload?.exp === 'number' ? payload.exp : null;
  if (exp == null) return true;
  return exp * 1000 <= Date.now() + skewSeconds * 1000;
}

/** Refresh the access token when the tab is visible and the JWT is close to expiry. */
export function startSessionKeepAlive(): () => void {
  if (typeof window === 'undefined') return () => {};

  const refreshIfNeeded = () => {
    if (document.visibilityState !== 'visible') return;
    const path = window.location.pathname;
    const onLms =
      path.startsWith('/lms/') &&
      !path.startsWith('/lms/login') &&
      !path.startsWith('/lms/signup');
    if (!onLms) return;
    if (isAccessTokenExpiringSoon(90)) {
      void tryRefreshSession().catch(() => {});
    }
  };

  document.addEventListener('visibilitychange', refreshIfNeeded);
  window.addEventListener('focus', refreshIfNeeded);
  refreshIfNeeded();
  const intervalId = window.setInterval(refreshIfNeeded, 60_000);
  return () => {
    document.removeEventListener('visibilitychange', refreshIfNeeded);
    window.removeEventListener('focus', refreshIfNeeded);
    window.clearInterval(intervalId);
  };
}

export function loginRedirectUrl(reason: LogoutReason = 'session_expired'): string {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const next = safeNextPath(path + search);
  setLogoutReason(reason);
  return next ? `/lms/login?next=${encodeURIComponent(next)}` : '/lms/login';
}

/** Allow only in-app LMS paths so login `next` cannot bounce off-site. */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/lms/')) return null;
  if (raw.startsWith('//') || raw.includes('://')) return null;
  if (raw.startsWith('/lms/login') || raw.startsWith('/lms/signup')) return null;
  return raw;
}

export async function waitForSession(
  maxAttempts = 3,
  delayMs = 300,
): Promise<{ session: Session | null; error: unknown } | null> {
  const existing = getStoredSession();
  if (existing?.access_token) return { session: existing, error: null };

  const refreshed = await tryRefreshSession().catch(() => false);
  if (refreshed) {
    const session = getStoredSession();
    if (session?.access_token) return { session, error: null };
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt === 1 && process.env.NODE_ENV === 'development') {
        await new Promise((r) => setTimeout(r, 100));
      }
      const session = getStoredSession();
      if (session?.access_token) return { session, error: null };
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, delayMs));
    } catch (err) {
      if (attempt === maxAttempts) return { session: null, error: err };
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return null;
}

export async function verifySession(): Promise<boolean> {
  return !!_inMemoryToken;
}

export async function getSession(): Promise<{ data: { session: Session | null } }> {
  return { data: { session: getStoredSession() } };
}

export function getStoredUser(): Session['user'] | null {
  return readMeta() ?? null;
}

export function getStoredUserId(): string | null {
  const meta = readMeta();
  if (meta?.id) return meta.id;
  if (!_inMemoryToken) return null;
  const payload = decodeJwtPayload(_inMemoryToken);
  const sub = payload?.sub;
  // Backend JWTs encode `sub` as a number, not a string — without this,
  // every fresh context that hasn't already written sessionStorage (a
  // returning user after their browser was fully closed, not just reloaded)
  // silently fails this fallback and gets bounced to login as "wrong_role".
  if (typeof sub === 'string' && sub) return sub;
  if (typeof sub === 'number') return String(sub);
  return null;
}

// --- Private sessionStorage helpers for non-sensitive metadata only ---

function readMeta(): Session['user'] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session['user'];
  } catch {
    return null;
  }
}

function writeMeta(user: NonNullable<Session['user']>): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Storage quota exceeded — non-fatal.
  }
}

function removeMeta(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ── Logout reason ─────────────────────────────────────────────────────────────
// Written before any forced redirect to /lms/login so the login page can show
// a human-readable explanation instead of silently kicking the user out.

const LOGOUT_REASON_KEY = '_logout_reason';

export type LogoutReason =
  | 'session_expired'
  | 'session_timeout'
  | 'wrong_role'
  | 'error'
  | 'logged_out';

const LOGOUT_MESSAGES: Record<LogoutReason, { title: string; detail: string }> = {
  logged_out: {
    title: 'You have been signed out',
    detail: 'Sign in again to continue.',
  },
  session_expired: {
    title: 'Your session has expired',
    detail: 'You were automatically logged out because your session is no longer valid. Please sign in again to continue.',
  },
  session_timeout: {
    title: 'Session timed out',
    detail: 'We could not reach the server in time to verify your session. Please check your connection and sign in again.',
  },
  wrong_role: {
    title: 'Access denied',
    detail: 'Your account does not have permission to access that area. Please sign in with the correct account.',
  },
  error: {
    title: 'Something went wrong',
    detail: 'An unexpected error occurred. Please sign in again.',
  },
};

export function setLogoutReason(reason: LogoutReason): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(LOGOUT_REASON_KEY, reason);
  } catch { /* ignore */ }
}

export function consumeLogoutReason(): { title: string; detail: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(LOGOUT_REASON_KEY) as LogoutReason | null;
    if (!raw) return null;
    sessionStorage.removeItem(LOGOUT_REASON_KEY);
    return LOGOUT_MESSAGES[raw] ?? null;
  } catch {
    return null;
  }
}
