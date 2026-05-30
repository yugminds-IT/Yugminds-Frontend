import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { invalidateCache, CacheKeys } from '../../../../lib/cache';

export async function POST() {
  try {
    // Invalidate the in-memory/Redis cache so the next page load fetches fresh data
    await invalidateCache(CacheKeys.successStories());

    // Also revalidate the Next.js page cache
    revalidatePath('/success-stories');

    return NextResponse.json({ revalidated: true });
  } catch (err) {
    console.error('[Revalidate] success-stories error:', err);
    return NextResponse.json({ revalidated: false, error: String(err) }, { status: 500 });
  }
}
