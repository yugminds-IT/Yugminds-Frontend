/**
 * Centralized Authorization Utilities
 * Uses backend API for auth (replaces Supabase).
 */

import { NextRequest, NextResponse } from 'next/server';
import { backendRequest } from './backend-client';

// Cache for user profiles (30 seconds TTL)
const profileCache = new Map<string, { data: { id: string; role: string; school_id: string | null } | null; timestamp: number }>();
const PROFILE_CACHE_TTL = 30 * 1000;

// Cache for token verification (30 seconds TTL)
const tokenVerificationCache = new Map<string, { userId: string | null; timestamp: number }>();
const TOKEN_VERIFICATION_CACHE_TTL = 30 * 1000;

function getTokenHash(token: string): string {
  if (token.length <= 20) return token;
  return `${token.substring(0, 10)}${token.substring(token.length - 10)}`;
}

/** Decode JWT payload (no verification - backend verifies). Use for quick userId when backend is unavailable. */
function decodeJwtPayload(token: string): { sub?: string; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
    return payload;
  } catch {
    return null;
  }
}

async function updateUserActivity(_userId: string): Promise<void> {
  // TODO: Call backend to update last_activity when endpoint exists
}

/**
 * Get authenticated user ID from request.
 * Tries backend /auth/me first, falls back to JWT decode.
 */
export async function getAuthenticatedUserId(request: NextRequest, suppressWarning = false): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      if (!suppressWarning) {
        console.warn('❌ No authorization header present in request');
      }
      return null;
    }
    if (!authHeader.startsWith('Bearer ')) {
      console.warn('❌ Invalid authorization header format');
      return null;
    }
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return null;

    const tokenHash = getTokenHash(token);
    const cached = tokenVerificationCache.get(tokenHash);
    if (cached && Date.now() - cached.timestamp < TOKEN_VERIFICATION_CACHE_TTL) {
      if (cached.userId) updateUserActivity(cached.userId);
      return cached.userId;
    }

    // Try backend /auth/me
    try {
      const user = await backendRequest<{ id: string }>('auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (user?.id) {
        tokenVerificationCache.set(tokenHash, { userId: user.id, timestamp: Date.now() });
        updateUserActivity(user.id);
        return user.id;
      }
    } catch (err) {
      // Backend may not have /auth/me yet - fall back to JWT decode
    }

    // Fallback: decode JWT (backend uses JWT)
    const payload = decodeJwtPayload(token);
    if (payload?.sub) {
      const now = Math.floor(Date.now() / 1000);
      if (!payload.exp || payload.exp > now) {
        tokenVerificationCache.set(tokenHash, { userId: payload.sub, timestamp: Date.now() });
        return payload.sub;
      }
    }

    tokenVerificationCache.set(tokenHash, { userId: null, timestamp: Date.now() });
    return null;
  } catch (error) {
    console.error('❌ Exception in getAuthenticatedUserId:', error);
    return null;
  }
}

/**
 * Get user profile with role (cached).
 * Calls backend /auth/me or /users/me.
 */
export async function getUserProfile(userId: string): Promise<{ id: string; role: string; school_id: string | null } | null> {
  const cached = profileCache.get(userId);
  if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_TTL) return cached.data;

  try {
    // Profile is typically returned with auth/me - we don't have token here, so we need an endpoint
    // Backend could have GET /users/:id/profile for server-side use with service token
    // For now, we can't fetch without token - return null and let callers pass token
    profileCache.set(userId, { data: null, timestamp: Date.now() });
    return null;
  } catch {
    profileCache.set(userId, { data: null, timestamp: Date.now() });
    return null;
  }
}

/**
 * Get user profile from request (uses token to call backend).
 */
export async function getUserProfileFromRequest(request: NextRequest): Promise<{ id: string; role: string; school_id: string | null } | null> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  // Check cache by token hash (profile may be cached from prior auth/me call)
  const tokenHash = getTokenHash(token);
  const cachedUserId = tokenVerificationCache.get(tokenHash)?.userId;
  if (cachedUserId) {
    const profileCached = profileCache.get(cachedUserId);
    if (profileCached && Date.now() - profileCached.timestamp < PROFILE_CACHE_TTL) return profileCached.data;
  }

  try {
    const data = await backendRequest<{ id: string; role: string; school_id?: string | null }>('auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (data?.id && data?.role) {
      const profile = { id: data.id, role: data.role, school_id: data.school_id ?? null };
      profileCache.set(data.id, { data: profile, timestamp: Date.now() });
      tokenVerificationCache.set(tokenHash, { userId: data.id, timestamp: Date.now() });
      return profile;
    }
  } catch {
    // Backend may not have endpoint yet
  }
  return null;
}

async function verifyRole(
  request: NextRequest,
  allowedRoles: string[]
): Promise<{ success: true; userId: string; role: string } | { success: false; response: NextResponse }> {
  const userId = await getAuthenticatedUserId(request, true);
  if (!userId) {
    return {
      success: false,
      response: NextResponse.json({ error: 'Unauthorized', message: 'Authentication required.' }, { status: 401 }),
    };
  }

  const profile = await getUserProfileFromRequest(request) ?? await getUserProfile(userId);
  if (!profile) {
    return {
      success: false,
      response: NextResponse.json({ error: 'User profile not found' }, { status: 404 }),
    };
  }

  if (!allowedRoles.includes(profile.role)) {
    return {
      success: false,
      response: NextResponse.json({ error: 'Forbidden', message: `Required role: ${allowedRoles.join(' or ')}` }, { status: 403 }),
    };
  }

  return { success: true, userId, role: profile.role };
}

export async function verifyAdmin(request: NextRequest): Promise<{ success: true; userId: string } | { success: false; response: NextResponse }> {
  const result = await verifyRole(request, ['admin']);
  if (!result.success) return result;
  return { success: true, userId: result.userId };
}

export async function verifyStudent(request: NextRequest): Promise<{ success: true; userId: string } | { success: false; response: NextResponse }> {
  const result = await verifyRole(request, ['student']);
  if (!result.success) return result;
  return { success: true, userId: result.userId };
}

