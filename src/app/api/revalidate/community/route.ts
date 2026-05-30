import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { invalidateCache, CacheKeys } from '../../../../lib/cache';

export async function POST() {
  try {
    await invalidateCache(CacheKeys.community());
    revalidatePath('/community');
    return NextResponse.json({ revalidated: true });
  } catch (err) {
    console.error('[Revalidate] community error:', err);
    return NextResponse.json({ revalidated: false, error: String(err) }, { status: 500 });
  }
}
