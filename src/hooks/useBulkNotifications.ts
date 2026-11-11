"use client";

import { useCallback, useEffect, useState } from "react";
import { commonApi } from "@/lib/api/common.api";
import { toast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm-dialog";

type Action = "read" | "unread" | "delete";
type Status = "all" | "read" | "unread";

const DONE: Record<Action, string> = { read: "marked as read", unread: "marked as unread", delete: "deleted" };
const noun = (n: number) => `${n} ${n === 1 ? "notification" : "notifications"}`;

/**
 * Selection + bulk actions (mark read / unread, delete) for an inbox list.
 * The page keeps its own list state; this updates it after the server confirms.
 * `resetKey` clears the selection whenever the list context changes (tab, filter, search, page).
 */
export function useBulkNotifications<T extends { id: string; is_read?: boolean }>({
  items,
  setItems,
  onRemoved,
  onChanged,
  status = "all",
  resetKey,
}: {
  items: T[];
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  /** called with how many rows left the list (deleted, or no longer match the read/unread filter) */
  onRemoved?: (count: number) => void;
  /** called after any successful bulk action, e.g. to refresh the unread badge */
  onChanged?: () => void;
  status?: Status;
  resetKey?: string | number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => setSelected(new Set()), [resetKey]);
  // Drop ids that are no longer on screen (a refresh, a realtime update).
  useEffect(() => {
    setSelected((prev) => {
      const here = new Set(items.map((n) => n.id));
      const next = new Set([...prev].filter((id) => here.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const toggleOne = useCallback((id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }), []);
  const toggleAll = useCallback(() => setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((n) => n.id)))), [items]);
  const clear = useCallback(() => setSelected(new Set()), []);

  const run = useCallback(async (action: Action, ids: string[]) => {
    if (ids.length === 0 || busy) return;
    setBusy(true);
    try {
      await commonApi.notifications.user.bulk({ ids, action });
      const hit = new Set(ids);
      const wantRead = action === "read";
      // Rows that no longer match the read/unread filter leave the list, as do deleted ones.
      const leaving = items.filter((n) => hit.has(n.id) && (action === "delete" || (status !== "all" && (status === "read") !== wantRead))).length;
      setItems((prev) =>
        prev
          .filter((n) => !(hit.has(n.id) && action === "delete"))
          .map((n) => (hit.has(n.id) && action !== "delete" ? { ...n, is_read: wantRead } : n))
          .filter((n) => !(hit.has(n.id) && action !== "delete" && status !== "all" && (status === "read") !== wantRead)),
      );
      if (leaving > 0) onRemoved?.(leaving);
      setSelected(new Set());
      onChanged?.();
      toast.success(`${noun(ids.length)} ${DONE[action]}`);
    } catch (err) {
      toast.error(`We could not update those notifications. ${err instanceof Error ? err.message : "Something went wrong"}. Try again.`);
    } finally {
      setBusy(false);
    }
  }, [busy, items, setItems, onRemoved, onChanged, status]);

  const remove = useCallback(async (ids: string[]) => {
    const ok = await confirmDialog({
      title: `Delete ${noun(ids.length)}?`,
      description: "They will be removed from your inbox. This cannot be undone.",
      confirmText: "Delete",
      variant: "danger",
    });
    if (ok) await run("delete", ids);
  }, [run]);

  return { selected, toggleOne, toggleAll, clear, busy, run, remove };
}
