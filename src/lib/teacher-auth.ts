/**
 * Teacher Authentication and Authorization Utilities
 * Uses backend API (replaces Supabase).
 */

import { NextRequest } from 'next/server';
import { getUserProfile, getAuthenticatedUserId, getUserProfileFromRequest } from './auth-utils';
import { backendRequestWithAuth } from './backend-client';

const teacherIdCache = new Map<string, { userId: string | null; timestamp: number }>();
const TEACHER_ID_CACHE_TTL = 30 * 1000;

function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
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

export async function getTeacherUserId(request: NextRequest): Promise<string | null> {
  try {
    const authToken = getTokenFromRequest(request);
    if (!authToken) return null;

    const tokenHash = authToken.length > 20 ? `${authToken.substring(0, 10)}${authToken.substring(authToken.length - 10)}` : authToken;
    const cacheKey = `teacher:${tokenHash}`;
    const cached = teacherIdCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < TEACHER_ID_CACHE_TTL) return cached.userId;

    const userId = await getAuthenticatedUserId(request, true);
    if (!userId) {
      teacherIdCache.set(cacheKey, { userId: null, timestamp: Date.now() });
      return null;
    }

    const profile = await getUserProfileFromRequest(request) ?? await getUserProfile(userId);
    if (!profile || profile.role !== 'teacher') {
      teacherIdCache.set(cacheKey, { userId: null, timestamp: Date.now() });
      return null;
    }

    teacherIdCache.set(cacheKey, { userId, timestamp: Date.now() });
    return userId;
  } catch (error) {
    console.error('Error getting teacher user ID:', error);
    return null;
  }
}

export async function getTeacherAssignedSchools(request: NextRequest): Promise<string[]> {
  try {
    const teacherId = await getTeacherUserId(request);
    if (!teacherId) return [];

    try {
      const data = await backendRequestWithAuth<{ school_ids?: string[]; schools?: { id: string }[] }>('teachers/me/schools', request as Request);
      if (Array.isArray(data?.school_ids)) return data.school_ids;
      if (Array.isArray(data?.schools)) return data.schools.map((s: { id: string }) => s.id);
    } catch {
      // Backend may not have endpoint yet
    }
    return [];
  } catch (error) {
    console.error('Error getting teacher assigned schools:', error);
    return [];
  }
}

export async function validateTeacherSchoolAccess(requestSchoolId: string, request: NextRequest): Promise<boolean> {
  const assignedSchools = await getTeacherAssignedSchools(request);
  return assignedSchools.length > 0 && assignedSchools.includes(requestSchoolId);
}

export async function getTeacherAuthInfo(request: NextRequest): Promise<{ teacherId: string; assignedSchools: string[] } | null> {
  const teacherId = await getTeacherUserId(request);
  if (!teacherId) return null;
  const assignedSchools = await getTeacherAssignedSchools(request);
  if (assignedSchools.length === 0) return null;
  return { teacherId, assignedSchools };
}
