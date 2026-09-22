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
