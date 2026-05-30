import { NextRequest, NextResponse } from 'next/server';
import { backendRequest } from '@/lib/backend-client';

/**
 * POST /api/validate-joining-code
 * Proxies to backend (NestJS) at POST /api/validate-joining-code.
 * Body: { code, studentData? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await backendRequest<unknown>('validate-joining-code', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500;
    const data = (err as { data?: unknown })?.data ?? { message: 'Validation failed' };
    return NextResponse.json(data, { status });
  }
}
