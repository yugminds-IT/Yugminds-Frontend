import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  defaultQuestionMarks,
  marksExceedCap,
  remainingAssignmentMarks,
  sumQuestionMarks,
} from "./assignment-marks.ts";

describe("assignment-marks", () => {
  it("sums marks and can skip the question being edited", () => {
    const qs = [
      { id: "a", marks: 1 },
      { id: "b", marks: 2 },
      { id: "c", marks: 2 },
    ];
    assert.equal(sumQuestionMarks(qs), 5);
    assert.equal(sumQuestionMarks(qs, "b"), 3);
  });

  it("reports remaining marks under the assignment cap", () => {
    const qs = [
      { id: "a", marks: 1 },
      { id: "b", marks: 1 },
      { id: "c", marks: 1 },
      { id: "d", marks: 1 },
      { id: "e", marks: 1 },
    ];
    assert.equal(remainingAssignmentMarks(5, qs), 0);
    assert.equal(remainingAssignmentMarks(5, qs, "e"), 1);
  });

  it("blocks a sixth 1-mark question on a 5-mark assignment", () => {
    assert.equal(marksExceedCap(5, 5, 1), true);
    assert.equal(marksExceedCap(5, 4, 1), false);
  });

  it("defaults a new question to 1 mark, or the leftover if under 1", () => {
    assert.equal(defaultQuestionMarks(5), "1");
    assert.equal(defaultQuestionMarks(0.5), "0.5");
    assert.equal(defaultQuestionMarks(0), "1");
  });
});
