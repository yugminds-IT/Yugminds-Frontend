import type { Announcement, Controls } from "./utils";

/**
 * Only what was actually changed. Sending every field on every save would let a stale page undo someone else's
 * change, for example switching maintenance back off while only editing the banner text.
 */
export function changesFrom(saved: Controls, next: Controls): Partial<Controls> {
  const patch: Partial<Controls> = {};
  if (next.maintenance_mode !== saved.maintenance_mode) patch.maintenance_mode = next.maintenance_mode;
  if (next.maintenance_message !== saved.maintenance_message) patch.maintenance_message = next.maintenance_message;
  if (JSON.stringify(next.announcement) !== JSON.stringify(saved.announcement)) patch.announcement = next.announcement;
  if (JSON.stringify(sorted(next.feature_flags)) !== JSON.stringify(sorted(saved.feature_flags))) patch.feature_flags = next.feature_flags;
  return patch;
}

const sorted = (o: Record<string, boolean>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

/** A banner only shows when it is switched on AND has text. Switched on with no text shows nothing. */
export const announcementLive = (a: Announcement) => a.enabled && a.text.trim() !== "";
