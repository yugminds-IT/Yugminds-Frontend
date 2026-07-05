/**
 * Course gating helpers (pure).
 *
 * Strict sequential progression: within an ordered list of items, an item is
 * unlocked only if it is the first item OR the immediately preceding item is
 * completed. Completed items always remain unlocked (revisitable).
 *
 * Completion truth is supplied by the caller via an `isCompleted` predicate so
 * the same logic works whether completion comes from the server `is_completed`
 * flag, the optimistic store overlay, or both combined.
 */

export interface GatedItem {
  id: string;
  /** server-authoritative ordering position within the chapter */
  index: number;
  completed: boolean;
  /** true when the item may be opened */
  unlocked: boolean;
}

/**
 * Combine server truth + optimistic overlay into a single completion check.
 */
export function makeIsCompleted(
  overlayIsCompleted: (id: string) => boolean
): (item: { id: string; is_completed?: boolean }) => boolean {
  return (item) => Boolean(item?.is_completed) || overlayIsCompleted(item.id);
}

/**
 * Given an already-ordered item list and a completion predicate, return each
 * item's completed/unlocked state for strict sequential gating.
 */
export function computeItemGating<T extends { id: string }>(
  items: T[],
  isCompleted: (item: T) => boolean
): GatedItem[] {
  let prevCompleted = true; // first item is always unlocked
  return items.map((item, index) => {
    const completed = isCompleted(item);
    const unlocked = index === 0 || prevCompleted || completed;
    prevCompleted = completed;
    return { id: item.id, index, completed, unlocked };
  });
}

/**
 * Index of the first item that is not yet completed (the natural "resume"
 * target). Returns -1 when every item is complete.
 */
export function firstIncompleteIndex<T extends { id: string }>(
  items: T[],
  isCompleted: (item: T) => boolean
): number {
  return items.findIndex((item) => !isCompleted(item));
}
