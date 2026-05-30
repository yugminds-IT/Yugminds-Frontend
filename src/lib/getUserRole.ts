import { getStoredUserId } from "./session-utils";
import { commonApi } from "./api";

export async function getUserRole() {
  const userId = getStoredUserId();
  if (!userId) return null;

  try {
    const { data } = await commonApi.getRole(userId);
    return (data as { role?: string })?.role || null;
  } catch {
    return null;
  }
}

export async function getUserProfile() {
  const userId = getStoredUserId();
  if (!userId) return null;

  try {
    const { data } = await commonApi.profile.get({ userId });
    return (data as { profile?: unknown })?.profile ?? data;
  } catch {
    return null;
  }
}

export async function getSchoolAdminSchool() {
  const userId = getStoredUserId();
  if (!userId) return null;

  try {
    const { data: profileData } = await commonApi.profile.get({ userId });
    const profile = (profileData as { profile?: { school_id?: string } })?.profile;
    if (!profile?.school_id) return null;

    const { data: schoolsData } = await commonApi.schools.list({ id: profile.school_id });
    const schools = (schoolsData as { schools?: unknown[] })?.schools || [];
    return schools[0] ?? null;
  } catch {
    return null;
  }
}
