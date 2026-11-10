"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin.api";
import type { JoiningCode } from "./utils";

/** The joining codes of one school. Pass an empty id to switch it off. */
export function useCodes(schoolId: string, enabled = true) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "joining-codes", schoolId],
    enabled: enabled && !!schoolId,
    queryFn: async (): Promise<JoiningCode[]> => {
      const { data } = await adminApi.joiningCodes.list({ schoolId });
      const payload = (data as Record<string, unknown> | undefined) ?? {};
      const raw = (payload.codes ?? payload.joinCodes ?? payload) as unknown;
      return Array.isArray(raw) ? (raw as JoiningCode[]) : [];
    },
  });
  const changed = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "joining-codes", schoolId] });
    void qc.invalidateQueries({ queryKey: ["admin", "schools"] }); // the schools list shows how many codes each has
  };
  return { codes: q.data ?? [], loading: q.isLoading, error: q.isError, refetch: q.refetch, changed };
}
