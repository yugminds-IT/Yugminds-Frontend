"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSession } from "../lib/session-utils";
import { adminApi, setAuthToken } from "../lib/api";

const ADMIN_SCHOOLS_QUERY_KEY = ["admin", "schools"] as const;

export type AdminSchoolItem = {
  id: string;
  name: string;
  domain?: string;
  schoolCode?: string;
  school_admin_name?: string | null;
  school_admin_email?: string | null;
  school_admin_user_id?: number | null;
  teacherCount?: number;
  studentCount?: number;
  grades_offered?: string[];
  gradesOffered?: string[];
  grades?: { id: string; name: string; sections?: { id: string; name: string; joinCodes?: unknown[] }[] }[];
  joinCodes?: { id: string; code: string; grade: string; isActive?: boolean }[];
  number_of_sections?: number;
  created_at?: string;
  createdAt?: string;
  is_active?: boolean;
  isActive?: boolean;
};

/** EdTech-style envelope: { data, meta } */
export type ApiEnvelope<T> = {
  data: T;
  meta?: { total: number; page?: number; limit?: number };
};

export type AdminSchoolsListResponse = {
  schools?: AdminSchoolItem[];
};

// Stable empty fallback — avoids new reference on every render which would
// cause useEffects that depend on this array to fire in an infinite loop.
const EMPTY_SCHOOLS: AdminSchoolItem[] = [];

/**
 * Single source of truth for admin schools list.
 * Supports EdTech-style response: { data: { schools }, meta } or legacy { schools }.
 */
export function useAdminSchools(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;

  const query = useQuery<AdminSchoolsListResponse>({
    queryKey: ADMIN_SCHOOLS_QUERY_KEY,
    queryFn: async (): Promise<AdminSchoolsListResponse> => {
      const { data: sessionData } = await getSession();
      const session = sessionData?.session;
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }
      setAuthToken(session.access_token);
      const response = await adminApi.schools.list({ limit: 500, offset: 0 });
      const body = response.data as ApiEnvelope<{ schools?: AdminSchoolItem[] }> & AdminSchoolsListResponse;
      const schools = body.data?.schools ?? body.schools ?? [];
      return { schools };
    },
    enabled,
    staleTime: 60 * 1000, // 1 minute - avoid refetch on every mount
  });

  return {
    data: query.data,
    schools: query.data?.schools ?? EMPTY_SCHOOLS,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useInvalidateAdminSchools() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ADMIN_SCHOOLS_QUERY_KEY });
}
