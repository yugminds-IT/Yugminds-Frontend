import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE } from '@/lib/auth-cookie';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:3001';

/**
 * Starts an impersonation session: exchanges the admin's access token for a
 * short-lived token of the target user, and swaps the httpOnly access-token
 * cookie so the middleware sees the impersonated identity. The admin's
 * refresh-token cookie is deliberately untouched — exiting impersonation
 * refreshes back to the admin session (see ./exit/route.ts).
 */
export async function POST(request: NextRequest) {
  try {
    const adminToken =
      request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ??
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!adminToken) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.text();
    const backendRes = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/admin/impersonate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body,
    });

    const resText = await backendRes.text();
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(resText); } catch { parsed = { message: resText }; }

    if (!backendRes.ok) {
      return NextResponse.json(parsed, { status: backendRes.status });
    }

    const accessToken = parsed.accessToken as string | undefined;
    const expiresIn = (parsed.expiresIn as number | undefined) ?? 900;
    const response = NextResponse.json(parsed, { status: 200 });
    if (accessToken) {
      response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: expiresIn,
      });
    }
    return response;
  } catch (err) {
    console.error('[/api/admin/impersonate] error:', err);
    return NextResponse.json({ message: 'Impersonation service unavailable' }, { status: 503 });
  }
}
