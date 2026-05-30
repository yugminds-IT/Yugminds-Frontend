const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (typeof window !== 'undefined' ? '' : 'http://localhost:3000');

interface RequestOptions extends RequestInit {
  authToken?: string;
}

export async function apiRequest<T>(
  path: string,
  { authToken, headers, ...init }: RequestOptions = {}
): Promise<T> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

  const mergedHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...(headers || {}),
  };

  if (authToken) {
    (mergedHeaders as Record<string, string>)['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(url, {
    ...init,
    headers: mergedHeaders,
    credentials: 'include',
  });

  if (!res.ok) {
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      // ignore
    }
    const message =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data && typeof data === 'object' && 'error' in data && (data as any).error) ||
      res.statusText ||
      'Request failed';
    throw new Error(message);
  }

  return (await res.json()) as T;
}

/**
 * Get auth token from storage (for client-side use).
 * Call this after login stores the token.
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // sessionStorage only — tab-scoped for multi-tab session isolation
    return sessionStorage.getItem('session_token');
  } catch {
    return null;
  }
}

/**
 * Get authenticated fetch function with auth token.
 * Compatible with previous getAuthenticatedFetch (Supabase-based).
 */
export async function getAuthenticatedFetch(): Promise<(url: string, options?: RequestInit) => Promise<Response>> {
  const token = getAuthToken();
  return async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, { ...options, headers });
  };
}

/**
 * Make authenticated API request for client-side use.
 * Uses token from storage if authToken not provided.
 */
export async function authenticatedApiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const token = options.authToken ?? getAuthToken();
  return apiRequest<T>(path, { ...options, authToken: token ?? undefined });
}
