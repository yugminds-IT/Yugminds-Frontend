import test from "node:test";
import assert from "node:assert/strict";
import { formatWorkingSchedule, formatWindow, periodFits, teacherWindowOn, lockReason, teacherAvailableAt, pickCurrentSchoolId } from "./weekday-utils.ts";

const am = { "4": { slot: "MORNING" as const, start: "08:00", end: "12:30" } };

test("formatWindow renders 12-hour times", () => {
  assert.equal(formatWindow({ start: "08:00", end: "12:30" }), "8:00 AM–12:30 PM");
  assert.equal(formatWindow({ start: "12:30", end: "17:00" }), "12:30 PM–5:00 PM");
});

test("formatWorkingSchedule lists days, then half-day windows only for worked days", () => {
  assert.equal(formatWorkingSchedule([1, 2, 4], null), "Mon, Tue, Thu");
  assert.equal(formatWorkingSchedule([1, 4], am), "Mon, Thu · Thu AM 8:00 AM–12:30 PM");
  // a slot on a day the teacher no longer works is ignored
  assert.equal(formatWorkingSchedule([1], am), "Mon");
});

test("teacherWindowOn is null for a full day", () => {
  assert.deepEqual(teacherWindowOn(am, 4), ["08:00", "12:30"]);
  assert.equal(teacherWindowOn(am, 1), null);
});

test("periodFits: inside, edges, straddling, H:MM padding, unparseable", () => {
  const w: [string, string] = ["08:00", "12:30"];
  assert.equal(periodFits({ start_time: "9:00", end_time: "9:45" }, w), true);
  assert.equal(periodFits({ start_time: "08:00", end_time: "12:30" }, w), true);
  assert.equal(periodFits({ start_time: "12:10", end_time: "12:50" }, w), false);
  assert.equal(periodFits({ start_time: "13:15", end_time: "14:00" }, w), false);
  assert.equal(periodFits({ start_time: "9:00 AM", end_time: "9:45 AM" }, w), true);
  assert.equal(periodFits({ start_time: "15:00", end_time: "15:40" }, null), true);
});

const P = (start_time: string, end_time: string) => ({ start_time, end_time });
const THU = 4;
const half = { full_name: "Swaroopa", teacher_schools: [{ working_days: [1, 4], day_slots: am }] };
const full = { full_name: "Ravi", teacher_schools: [{ working_days: [1, 2, 3, 4, 5] }] };

test("lockReason: a period inside the half-day window is open", () => {
  assert.equal(lockReason([half], THU, P("09:00", "09:45"), "2026-11-12"), null);
});

test("lockReason: afternoon period is locked, naming the teacher and window", () => {
  assert.equal(
    lockReason([half], THU, P("13:00", "13:45"), "2026-11-12"),
    "Swaroopa is only here 8:00 AM–12:30 PM on Thursdays",
  );
});

test("lockReason: a period straddling the window end is locked", () => {
  assert.notEqual(lockReason([half], THU, P("11:55", "12:35"), "2026-11-12"), null);
});

test("lockReason: a full-day teacher keeps every period open", () => {
  assert.equal(lockReason([half, full], THU, P("15:00", "15:40"), "2026-11-12"), null);
});

test("lockReason: day nobody works, ended assignment, and empty list", () => {
  assert.equal(lockReason([half], 3, P("09:00", "09:45"), "2026-11-12"), "No teacher works Wednesdays");
  const ended = { full_name: "X", teacher_schools: [{ working_days: [4], assigned_until: "2026-01-01" }] };
  assert.equal(lockReason([ended], THU, P("09:00", "09:45"), "2026-11-12"), "No teacher is currently assigned");
  assert.equal(lockReason([], THU, P("15:00", "15:40"), "2026-11-12"), null);
});

test("lockReason: several half-day teachers are summarised", () => {
  const b = { ...half, full_name: "Meena" };
  assert.match(lockReason([half, b], THU, P("14:00", "14:40"), "2026-11-12")!, /^Swaroopa and 1 more are only here/);
});

test("teacherAvailableAt: no assignment info never locks", () => {
  assert.equal(teacherAvailableAt({ full_name: "N" }, THU, P("15:00", "15:40"), "2026-11-12"), true);
});

test("pickCurrentSchoolId follows the clock across a split day", () => {
  const slots = {
    A: { slot: "MORNING" as const, start: "08:00", end: "12:30" },
    B: { slot: "AFTERNOON" as const, start: "12:30", end: "17:00" },
  };
  assert.equal(pickCurrentSchoolId(["A", "B"], slots, "09:15"), "A");
  assert.equal(pickCurrentSchoolId(["A", "B"], slots, "12:30"), "B");
  assert.equal(pickCurrentSchoolId(["B", "A"], slots, "06:00"), "A"); // before the day: first to start
  assert.equal(pickCurrentSchoolId(["A", "B"], slots, "20:00"), "B"); // after the day: last to end
  assert.equal(pickCurrentSchoolId(["C"], {}, "10:00"), "C"); // full-day school
  assert.equal(pickCurrentSchoolId([], slots, "10:00"), null);
});
