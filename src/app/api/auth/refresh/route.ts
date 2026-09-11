import { NextRequest, NextResponse } from 'next/server';
import { attachAccessTokenCookie } from '@/lib/auth-cookie';

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value;
    if (!refreshToken) {
      return NextResponse.json({ error: 'Missing refresh token' }, { status: 401 });
    }

    const backendResponse = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refresh_token=${refreshToken}`,
      },
      body: JSON.stringify({ refresh_token: refreshToken, refreshToken }),
    });

    if (!backendResponse.ok) {
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    }

    return attachAccessTokenCookie(backendResponse);
  } catch {
    return NextResponse.json({ error: 'Failed to refresh session' }, { status: 500 });
  }
}
