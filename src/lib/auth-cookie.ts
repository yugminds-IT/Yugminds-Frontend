import { NextResponse } from 'next/server';
import { cookieValue, getSetCookies } from './cookie-parse';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
// Must match ACCESS_TOKEN_EXPIRY on the backend (15 min).
export const ACCESS_TOKEN_MAX_AGE = 15 * 60;
// Must match REFRESH_TOKEN_EXPIRY on the backend (7 days).
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE,
  };
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: REFRESH_TOKEN_MAX_AGE,
  };
}

/**
 * Intercepts a successful backend auth response, copies access + refresh tokens
 * onto same-origin httpOnly cookies, and strips the refresh token from JSON so
 * it never reaches JavaScript.
 */
export async function attachAccessTokenCookie(backendRes: Response): Promise<Response> {
  if (!backendRes.ok) return backendRes;

  let body: Record<string, unknown>;
  try {
    body = await backendRes.json();
  } catch {
    return backendRes;
  }

  const tokens = body?.tokens as Record<string, unknown> | undefined;
  const accessToken = tokens?.accessToken as string | undefined;
  const refreshToken =
    (tokens?.refreshToken as string | undefined) ||
    cookieValue(getSetCookies(backendRes.headers), REFRESH_TOKEN_COOKIE);

  if (tokens && 'refreshToken' in tokens) {
    const rest = { ...tokens };
    delete rest.refreshToken;
    body = { ...body, tokens: rest };
  }

  const headers = new Headers(backendRes.headers);
  headers.delete('set-cookie');
  headers.delete('content-encoding');
  headers.delete('content-length');

  const res = NextResponse.json(body, {
    status: backendRes.status,
    headers,
  });

  if (accessToken) {
    res.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, cookieOptions());
  }
  if (refreshToken) {
    res.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions());
  }

  return res;
}

/**
 * Returns a response that clears the access_token cookie.
 * Call this from the logout API route after proxying to the backend.
 */
export function clearAccessTokenCookie(backendRes: Response): Response {
  const res = new Response(backendRes.body, {
    status: backendRes.status,
    statusText: backendRes.statusText,
    headers: backendRes.headers,
  });
  res.headers.append(
    'Set-Cookie',
    `${ACCESS_TOKEN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
  );
  res.headers.append(
    'Set-Cookie',
    `${REFRESH_TOKEN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
  );
  return res;
}
