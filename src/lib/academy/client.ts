/**
 * Academy HTTP client. Independent of the LMS session code: auth lives in
 * httpOnly cookies set by the backend (`ac_at` access, `ac_rt` refresh), so
 * nothing token-related is held in JS. A 401 triggers one refresh + retry.
 */

const BASE = "/api/academy";

export class AcademyApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

/** Single-flight refresh; true when a fresh access cookie was issued. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function messageOf(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: unknown };
    const msg = data?.message;
    if (Array.isArray(msg)) return msg.join("\n");
    if (typeof msg === "string" && msg) return msg;
  } catch {
    /* non-JSON body */
  }
  return res.status >= 500 ? "Something went wrong. Please try again." : `Request failed (${res.status})`;
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: body === undefined || isForm ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });
  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await refreshSession()) return request<T>(method, path, body, false);
    // Session ended (logged out from another device, or expired): back to login
    // instead of leaving a half-working page.
    if (typeof window !== "undefined" && /^\/academy\/(learn|admin|tutor)(\/|$)/.test(window.location.pathname)) {
      window.location.href = `/academy/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
  }
  if (!res.ok) throw new AcademyApiError(await messageOf(res), res.status);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const http = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, form),
};

export function qs(params: Record<string, string | number | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : "";
}

/** Readable error text for the UI. */
export function errorText(err: unknown, fallback = "Something went wrong. Please try again."): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
