"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi } from "../lib/api/admin.api";
import { realtimeSocketClient } from "../lib/realtime/socket-client";

/**
 * Returns the number of pending password reset requests for the admin sidebar badge.
 * Listens for `password_reset_request:new` WebSocket events and polls every 5 minutes.
 */
export function usePendingPasswordResetCount(options?: { enabled?: boolean }): number {
  const enabled = options?.enabled !== false;
  const [count, setCount] = useState(0);
  const lastFetchRef = useRef(0);

  const fetchCount = useCallback(async () => {
    if (!enabled) return;
    lastFetchRef.current = Date.now();
    try {
      const { data } = await adminApi.passwordResetRequests.pendingCount();
      setCount(Number((data as { count?: number })?.count ?? 0));
    } catch {
      // non-critical
    }
  }, [enabled]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchCount(); }, [fetchCount]);

  // Polling fallback every 5 minutes
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(fetchCount, 5 * 60_000);
    return () => clearInterval(id);
  }, [enabled, fetchCount]);

  // Listen for realtime push from server
  useEffect(() => {
    if (!enabled) return;
    const off = realtimeSocketClient.on<{ pending_count?: number }>(
      "password_reset_request:new",
      (payload) => {
        if (payload?.pending_count !== undefined) {
          setCount(payload.pending_count);
        } else {
          fetchCount();
        }
      },
    );
    return off;
  }, [enabled, fetchCount]);

  // Refresh immediately when the admin resolves a request on the same page
  useEffect(() => {
    if (!enabled) return;
    const handler = () => fetchCount();
    window.addEventListener("password-reset-resolved", handler);
    return () => window.removeEventListener("password-reset-resolved", handler);
  }, [enabled, fetchCount]);

  return count;
}
