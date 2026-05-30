import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/backend-client';
import { attachAccessTokenCookie } from '@/lib/auth-cookie';

export async function POST(request: NextRequest) {
  const backendRes = await proxyToBackend(request);
  return attachAccessTokenCookie(backendRes);
}
