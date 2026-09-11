import { NextRequest } from 'next/server';
import { attachAccessTokenCookie } from '@/lib/auth-cookie';
import { getSetCookies } from '@/lib/cookie-parse';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    // Read the body as text first — avoids duplex-stream issues in Node.js 22+
    // that cause fetch to throw even when the backend responds normally.
    const bodyText = await request.text();

    const backendRes = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('x-forwarded-for')
          ? { 'x-forwarded-for': request.headers.get('x-forwarded-for')! }
          : {}),
      },
      body: bodyText,
    });

    const resBody = await backendRes.text();

    let parsed: unknown;
    try { parsed = JSON.parse(resBody); } catch { parsed = resBody; }

    if (!backendRes.ok) {
      // Forward the real error from the backend (e.g. 401 "Invalid email or password")
      return Response.json(parsed, { status: backendRes.status });
    }

    // Keep backend Set-Cookie so attachAccessTokenCookie can copy the refresh
    // token onto the frontend origin. Login previously dropped those headers,
    // so the browser never received a refresh cookie and sessions died at 15m.
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    for (const cookie of getSetCookies(backendRes.headers)) {
      headers.append('set-cookie', cookie);
    }
    const successRes = new Response(resBody, {
      status: backendRes.status,
      headers,
    });
    return attachAccessTokenCookie(successRes);
  } catch (err) {
    console.error('[/api/auth/login] error:', err);
    const isNetworkError =
      err instanceof TypeError ||
      (err instanceof Error &&
        (err.message.includes('ECONNREFUSED') || err.message.includes('fetch failed')));
    const message = isNetworkError
      ? 'Cannot reach the login server. Please try again in a moment.'
      : 'Login service unavailable. Please try again.';
    return Response.json({ message }, { status: 503 });
  }
}
