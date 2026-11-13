import test from "node:test";
import assert from "node:assert/strict";
import { rollUp, lastMonths } from "./utils.ts";

const row = (month: string, present: number, absent: number, total?: number, school_id?: string) => ({
  month, school_id, present_count: present, absent_count: absent, leave_count: 0, unreported_count: 0, total_days: total,
});

test("rollUp sums rows of the same month and computes the percentage", () => {
  const m = rollUp([row("2026-11", 5, 1, 6, "a"), row("2026-11", 0.5, 0, 0.5, "b")]).get("2026-11")!;
  assert.equal(m.present, 5.5);
  assert.equal(m.total, 6.5);
  assert.equal(m.pct, 85);
});

test("rollUp keeps months apart, ignores rows without a month, and is empty-safe", () => {
  const out = rollUp([row("2026-10", 1, 1, 2), row("", 9, 9, 18)]);
  assert.deepEqual([...out.keys()], ["2026-10"]);
  assert.equal(out.get("2026-10")!.pct, 50);
  assert.equal(rollUp(undefined).size, 0);
});

test("a month with no working days is 0%, not NaN", () => {
  assert.equal(rollUp([row("2026-11", 0, 0, 0)]).get("2026-11")!.pct, 0);
});

test("lastMonths ends at the current month, oldest first, across a year boundary", () => {
  assert.deepEqual(lastMonths(new Date(2026, 0, 15), 3), ["2025-11", "2025-12", "2026-01"]);
});
