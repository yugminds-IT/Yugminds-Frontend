import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/backend-client';
import { attachAccessTokenCookie } from '@/lib/auth-cookie';

export async function POST(request: NextRequest) {
  try {
    const backendRes = await proxyToBackend(request);
    return attachAccessTokenCookie(backendRes);
  } catch (err) {
    console.error('[/api/auth/signup] proxy error:', err);
    return Response.json(
      { message: 'Signup service unavailable. Please try again.' },
      { status: 503 }
    );
  }
}
