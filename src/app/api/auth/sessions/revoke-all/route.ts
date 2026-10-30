import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/backend-client';
import { clearAccessTokenCookie } from '@/lib/auth-cookie';

// Same as /api/auth/logout: after revoking every session, also expire this
// browser's httpOnly access/refresh cookies.
export async function POST(request: NextRequest) {
  const backendRes = await proxyToBackend(request);
  return clearAccessTokenCookie(backendRes);
}
