import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value;
    const accessToken = request.cookies.get('access_token')?.value;

    if (!refreshToken) {
      // Fallback: if access token cookie already exists, use it to rehydrate
      // in-memory auth state after page reload/hot-reload without forcing logout.
      if (accessToken) {
        return NextResponse.json({ token: accessToken }, { status: 200 });
      }
      return NextResponse.json({ error: 'Missing refresh token' }, { status: 401 });
    }

    const backendResponse = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken, refreshToken }),
    });

    if (!backendResponse.ok) {
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    }

    const data = (await backendResponse.json()) as {
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
    const nextRefreshToken = data.refresh_token ?? data.tokens?.refreshToken;
    if (nextRefreshToken) {
      response.cookies.set('refresh_token', nextRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
    }

    return response;
  } catch {
    return NextResponse.json({ error: 'Failed to refresh session' }, { status: 500 });
  }
}
