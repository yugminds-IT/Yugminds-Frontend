/**
 * Backend API client for server-side use (API routes, server components).
 * Proxies requests to the new backend, replacing Supabase.
 */

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:3000';

/**
 * Forward a request to the backend API.
 * Use this in Next.js API routes to proxy to your backend.
 */
export async function backendRequest<T = unknown>(
  path: string,
  init: {
    method?: string;
    headers?: HeadersInit;
    body?: BodyInit;
    searchParams?: Record<string, string>;
  } = {}
): Promise<T> {
  const { method = 'GET', headers = {}, body, searchParams } = init;
  const url = new URL(path.startsWith('http') ? path : `${BACKEND_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`);
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(typeof headers === 'object' && !(headers instanceof Headers)
        ? headers
        : Object.fromEntries((headers as Headers).entries())),
    },
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
  if (!res.ok) {
    let errData: unknown;
    try {
      errData = await res.json();
    } catch {
      errData = await res.text();
    }
    const err = new Error(
      typeof errData === 'object' && errData !== null && 'message' in (errData as object)
        ? String((errData as { message: unknown }).message)
        : `Backend request failed: ${res.status} ${res.statusText}`
    ) as Error & { status?: number; data?: unknown };
    err.status = res.status;
    err.data = errData;
    throw err;
  }
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/**
 * Forward request with Authorization header from incoming request.
 */
export async function backendRequestWithAuth<T = unknown>(
  path: string,
  request: Request,
  init: Parameters<typeof backendRequest>[1] = {}
): Promise<T> {
  const authHeader = request.headers.get('authorization');
  const headers: Record<string, string> = {};
  if (authHeader) headers['Authorization'] = authHeader;
  const initHeaders =
    init.headers && typeof init.headers === 'object' && !(init.headers instanceof Headers)
      ? (init.headers as Record<string, string>)
      : {};
  return backendRequest<T>(path, { ...init, headers: { ...headers, ...initHeaders } });
}

/**
 * Proxy an API route request to the backend.
 * Use in Next.js API routes: return proxyToBackend(request);
 */
export async function proxyToBackend(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '') || '';
  const targetUrl = `${BACKEND_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}${url.search}`;
  const targetOrigin = new URL(targetUrl).origin;
  const requestOrigin = url.origin;
  if (targetOrigin === requestOrigin && !process.env.BACKEND_URL) {
    return new Response(
      JSON.stringify({
        message: 'BACKEND_URL is not set. Set it to your NestJS backend URL (e.g. http://localhost:3001) in .env.',
        error: 'Bad Configuration',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const headers = new Headers(request.headers);
  headers.delete('host');

  // Ensure Authorization header is present for backend JWT auth.
  // If the incoming request doesn't have Authorization but does have
  // a session or access token cookie, convert that to a Bearer token.
  if (!headers.has('authorization')) {
    const cookieHeader = headers.get('cookie') ?? '';
    const cookieParts = cookieHeader.split(';').map((c) => c.trim());
    let token: string | null = null;
    for (const part of cookieParts) {
      if (part.startsWith('session_token=')) {
        token = decodeURIComponent(part.substring('session_token='.length));
        break;
      }
      if (part.startsWith('access_token=')) {
        token = decodeURIComponent(part.substring('access_token='.length));
        break;
      }
    }
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
  }

  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers,
    body: request.body,
  };
  if (request.body && request.method !== 'GET' && request.method !== 'HEAD') {
    // Node.js fetch requires duplex for streamed request bodies.
    init.duplex = 'half';
  }
  const res = await fetch(targetUrl, init);
  const resHeaders = new Headers(res.headers);
  // Remove encoding/length headers — Node.js auto-decompresses gzip bodies so the
  // original content-length (compressed size) no longer matches the actual body size.
  resHeaders.delete('content-encoding');
  resHeaders.delete('content-length');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: resHeaders });
}
