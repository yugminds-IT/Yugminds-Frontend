import { NextRequest, NextResponse } from 'next/server';
import { isRedisAvailable, redis } from '@/lib/redis-client';

const KEY = 'site:visits';
const BOT_UA = /bot|crawl|spider|slurp|preview|headless|lighthouse/i;

/** Counts one site visit. */
export async function POST(request: NextRequest) {
  if (!BOT_UA.test(request.headers.get('user-agent') ?? '')) {
    await redis.incr(KEY);
  }
  return new NextResponse(null, { status: 204 });
}

/** Total visits: 0 before the first visit, null only when Redis is unavailable. */
export async function GET() {
  if (!isRedisAvailable()) return NextResponse.json({ count: null });
  const count = await redis.get<number>(KEY);
  return NextResponse.json({ count: Number(count ?? 0) });
}
