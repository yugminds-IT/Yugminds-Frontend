import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/backend-client';
import { clearAccessTokenCookie } from '@/lib/auth-cookie';

export async function POST(request: NextRequest) {
  const backendRes = await proxyToBackend(request);
  return clearAccessTokenCookie(backendRes);
}
