import { NextRequest, NextResponse } from 'next/server';
import { attachAccessTokenCookie } from '@/lib/auth-cookie';

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
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refresh_token=${refreshToken}`,
      },
      body: JSON.stringify({ refresh_token: refreshToken, refreshToken }),
    });
    if (!backendRes.ok) {
      return NextResponse.json({ error: 'Failed to restore admin session' }, { status: 401 });
    }

    return attachAccessTokenCookie(backendRes);
  } catch (err) {
    console.error('[/api/admin/impersonate/exit] error:', err);
    return NextResponse.json({ error: 'Failed to exit impersonation' }, { status: 503 });
  }
}
