/**
 * School Admin Authentication and Authorization Utilities
 * Uses backend API (replaces Supabase).
 */

import { NextRequest } from 'next/server';
import { backendRequestWithAuth } from './backend-client';
import { getAuthenticatedUserId, getUserProfileFromRequest, getUserProfile } from './auth-utils';

const schoolAdminIdCache = new Map<string, { schoolId: string | null; timestamp: number }>();
const SCHOOL_ADMIN_ID_CACHE_TTL = 30 * 1000;

function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token) return token;
  }
  const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc: Record<string, string>, cookie: string) => {
      const trimmed = cookie.trim();
      const idx = trimmed.indexOf('=');
      if (idx > 0) acc[trimmed.substring(0, idx).trim()] = decodeURIComponent(trimmed.substring(idx + 1).trim());
      return acc;
    }, {});
    const token = cookies['session_token'] || cookies['access_token'];
    if (token && token.length > 50) return token;
  }
  return null;
}

export async function getSchoolAdminSchoolId(request: NextRequest): Promise<string | null> {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) return null;

    const cached = schoolAdminIdCache.get(userId);
    if (cached && Date.now() - cached.timestamp < SCHOOL_ADMIN_ID_CACHE_TTL) return cached.schoolId;

    const profile = await getUserProfileFromRequest(request) ?? await getUserProfile(userId);
    if (!profile || profile.role !== 'school_admin') {
      schoolAdminIdCache.set(userId, { schoolId: null, timestamp: Date.now() });
      return null;
    }

    if (profile.school_id) {
      schoolAdminIdCache.set(userId, { schoolId: profile.school_id, timestamp: Date.now() });
      return profile.school_id;
    }

    try {
      const data = await backendRequestWithAuth<{ school_id?: string; schoolId?: string }>('school-admins/me', request as Request);
      const schoolId = data?.school_id ?? data?.schoolId ?? null;
      schoolAdminIdCache.set(userId, { schoolId, timestamp: Date.now() });
      return schoolId;
    } catch {
      schoolAdminIdCache.set(userId, { schoolId: null, timestamp: Date.now() });
      return null;
    }
  } catch (error) {
    console.error('Error getting school admin school_id:', error);
    return null;
  }
}

export async function validateSchoolAccess(requestSchoolId: string, request: NextRequest): Promise<boolean> {
  const adminSchoolId = await getSchoolAdminSchoolId(request);
  return !!adminSchoolId && adminSchoolId === requestSchoolId;
}

export async function getSchoolAdminProfile(request: NextRequest): Promise<{
  profile: { id: string; email?: string; role?: string; full_name?: string; [key: string]: unknown };
  school: { id: string; name?: string; [key: string]: unknown };
  school_id: string;
} | null> {
  try {
    const school_id = await getSchoolAdminSchoolId(request);
    if (!school_id) return null;

    const authToken = getTokenFromRequest(request);
    if (!authToken) return null;

    try {
      const data = await backendRequestWithAuth<{
        profile?: Record<string, unknown>;
        school?: Record<string, unknown>;
        school_id?: string;
      }>('school-admins/me', request as Request);
      if (data?.profile && data?.school) {
        return {
          profile: data.profile as { id: string; email?: string; role?: string; full_name?: string; [key: string]: unknown },
          school: data.school as { id: string; name?: string; [key: string]: unknown },
          school_id: data.school_id ?? school_id,
        };
      }
    } catch {
      // Backend may not have endpoint yet
    }
    return null;
  } catch (error) {
    console.error('Error getting school admin profile:', error);
    return null;
  }
}
