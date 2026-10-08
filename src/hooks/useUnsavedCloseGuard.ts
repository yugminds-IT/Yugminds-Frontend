"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { confirmDialog } from "@/components/ui/confirm-dialog";

const UNSAVED_TITLE = "You have unsaved changes";
const UNSAVED_DESCRIPTION =
  "Are you sure you want to leave without saving?";

/**
 * Ask before discarding dirty work.
 * Returns true if the caller should proceed with close/discard.
 */
export async function confirmDiscardUnsavedChanges(): Promise<boolean> {
  return confirmDialog({
    title: UNSAVED_TITLE,
    description: UNSAVED_DESCRIPTION,
    cancelText: "Continue editing",
    confirmText: "Discard changes",
    variant: "danger",
  });
}

/**
 * If dirty, confirm discard; only then run onDiscard.
 * Clean forms close immediately.
 */
export async function requestClose(
  isDirty: boolean,
  onDiscard: () => void,
): Promise<void> {
  if (!isDirty) {
    onDiscard();
    return;
  }
  if (await confirmDiscardUnsavedChanges()) {
    onDiscard();
  }
}

/** Stable JSON compare for form/drawer snapshots. */
export function isStateDirty<T>(current: T, snapshot: T | null): boolean {
  if (snapshot === null) return false;
  try {
    return JSON.stringify(current) !== JSON.stringify(snapshot);
  } catch {
    return current !== snapshot;
  }
}

/**
 * Capture a baseline when `active` becomes true; report dirty vs that baseline.
 *
 * Prefer this over hand-rolled "any field non-empty" checks — dialogs often
 * open with defaults or grid-prefilled values (day, period, academic year).
 * Those must NOT count as unsaved work until the user changes something.
 *
 * Snapshot is deferred one macrotask so setState that opens the dialog and
 * seeds the form in the same click handler is included in the baseline.
 */
export function useDirtySnapshot<T>(active: boolean, current: T): boolean {
  const [snapshot, setSnapshot] = useState<T | null>(null);
  const currentRef = useRef(current);
  currentRef.current = current;
  const wasActive = useRef(false);

  useEffect(() => {
    if (active && !wasActive.current) {
      wasActive.current = true;
      const timer = window.setTimeout(() => {
        setSnapshot(structuredCloneSafe(currentRef.current));
      }, 0);
      return () => {
        window.clearTimeout(timer);
      };
    }
    if (!active) {
      wasActive.current = false;
      setSnapshot(null);
    }
  }, [active]);

  return isStateDirty(current, snapshot);
}

function structuredCloneSafe<T>(value: T): T {
  try {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
  } catch {
    /* fall through */
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Hook form of requestClose for components that need a stable callback.
 */
export function useUnsavedCloseGuard() {
  return useCallback(
    (isDirty: boolean, onDiscard: () => void) =>
      requestClose(isDirty, onDiscard),
    [],
  );
}

/**
 * Warn on browser refresh/close when dirty (full-page forms).
 */
export function useBeforeUnloadWhenDirty(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = UNSAVED_DESCRIPTION;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}

const LEAVE_GUARD = "__leaveGuard";

/**
 * While `active`, intercepts browser Back/Forward and in-app link clicks so
 * dirty work is confirmed instead of discarded. Reload/close uses the native
 * beforeunload dialog. `onLeave` runs only after the user confirms discard
 * (or immediately when the form is clean).
 */
export function useLeaveGuard(
  active: boolean,
  isDirty: boolean,
  onLeave: () => void,
) {
  useBeforeUnloadWhenDirty(active && isDirty);
  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  useEffect(() => {
    if (!active) return;

    const trap = () => {
      window.history.pushState(
        { ...window.history.state, [LEAVE_GUARD]: true },
        "",
        window.location.href,
      );
    };
    trap();

    let prompting = false;
    const considerLeave = async () => {
      if (prompting) return false;
      if (!dirtyRef.current) return true;
      prompting = true;
      try {
        return await confirmDiscardUnsavedChanges();
      } finally {
        prompting = false;
      }
    };

    const onPopState = () => {
      trap();
      void considerLeave().then((ok) => {
        if (ok) onLeaveRef.current();
      });
    };

    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download"))
        return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      void considerLeave().then((ok) => {
        if (ok) {
          onLeaveRef.current();
          window.location.assign(url.pathname + url.search + url.hash);
        }
      });
    };

    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", onClick, true);
      if (window.history.state?.[LEAVE_GUARD]) {
        const next = { ...window.history.state };
        delete next[LEAVE_GUARD];
        window.history.replaceState(next, "", window.location.href);
      }
    };
  }, [active]);
}
