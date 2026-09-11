import { generateUUID } from "../../lib/uuid-utils";
import type { Chapter } from "./ChapterBuilderCard";

/** Max chapters allowed in a single bulk paste. */
export const BULK_CHAPTER_MAX = 50;

/**
 * Split pasted text into chapter names: one per line, trimmed, blanks dropped.
 * Duplicate titles are allowed — curricula sometimes reuse section names.
 */
export function parseChapterNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Build chapter objects from names, starting at `startOrder` (1-based). */
export function buildChaptersFromNames(
  names: string[],
  startOrder: number,
): Chapter[] {
  return names.map((name, i) => ({
    id: generateUUID(),
    name,
    description: "",
    learning_outcomes: [],
    order_number: startOrder + i,
  }));
}
