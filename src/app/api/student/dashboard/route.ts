import { NextRequest } from 'next/server';
import { verifyStudent } from '../../../../lib/auth-utils';
import { proxyToBackend } from '@/lib/backend-client';

export async function GET(request: NextRequest) {
  const result = await verifyStudent(request);
  if (!result.success) return result.response;
  return proxyToBackend(request);
}
