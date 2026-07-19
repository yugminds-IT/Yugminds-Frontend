import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE } from '@/lib/auth-cookie';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:3001';

/**
 * Ends an impersonation session by exchanging the (untouched) admin
 * refresh-token cookie for a fresh admin access token, restoring the
 * access-token cookie to the admin identity.
 */
export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value;
    if (!refreshToken) {
      return NextResponse.json({ error: 'No admin session to restore' }, { status: 401 });
    }

    const backendRes = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken, refreshToken }),
    });
    if (!backendRes.ok) {
      return NextResponse.json({ error: 'Failed to restore admin session' }, { status: 401 });
    }

    const data = (await backendRes.json()) as {
      token?: string;
      access_token?: string;
      refresh_token?: string;
      tokens?: { accessToken?: string; refreshToken?: string };
    };
    const token = data.token ?? data.access_token ?? data.tokens?.accessToken;
    if (!token) {
      return NextResponse.json({ error: 'Refresh succeeded without token' }, { status: 401 });
    }

    const response = NextResponse.json({ token }, { status: 200 });
    response.cookies.set(ACCESS_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 15 * 60,
    });
    const nextRefreshToken = data.refresh_token ?? data.tokens?.refreshToken;
    if (nextRefreshToken) {
      response.cookies.set('refresh_token', nextRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });
    }
    return response;
  } catch (err) {
    console.error('[/api/admin/impersonate/exit] error:', err);
    return NextResponse.json({ error: 'Failed to exit impersonation' }, { status: 503 });
  }
}
