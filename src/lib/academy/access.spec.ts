import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { academyArea, academyRedirect } from "./access.ts";
import { safeAcademyNext, toAcademyPath } from "./paths.ts";

describe("academy access", () => {
  it("only gates the three dashboards", () => {
    assert.equal(academyArea("/academy/learn/courses/1"), "LEARNER");
    assert.equal(academyArea("/academy/admin"), "ADMIN");
    assert.equal(academyArea("/academy/courses"), null);
    assert.equal(academyArea("/academy/learner"), null);
    assert.equal(academyArea("/lms/student"), null);
  });

  it("sends signed-out visitors to the Academy login with next", () => {
    assert.equal(academyRedirect("/academy/learn", null), "/academy/login?next=%2Facademy%2Flearn");
    assert.equal(academyRedirect("/academy/tutor", { role: "student" }), "/academy/login?next=%2Facademy%2Ftutor");
  });

  it("keeps each role in its own dashboard", () => {
    assert.equal(academyRedirect("/academy/learn", { role: "LEARNER" }), null);
    assert.equal(academyRedirect("/academy/admin", { role: "LEARNER" }), "/academy/learn");
    assert.equal(academyRedirect("/academy/learn", { role: "TUTOR" }), "/academy/tutor");
    assert.equal(academyRedirect("/academy/admin/courses", { role: "ADMIN" }), null);
  });

  it("path helpers", () => {
    assert.equal(toAcademyPath("/learn/sessions"), "/academy/learn/sessions");
    assert.equal(toAcademyPath("/academy/learn"), "/academy/learn");
    assert.equal(toAcademyPath("/"), "/academy");
    assert.equal(safeAcademyNext("/academy/learn/courses/x"), "/academy/learn/courses/x");
    assert.equal(safeAcademyNext("/academy/checkout/robotics?x=1"), "/academy/checkout/robotics?x=1");
    assert.equal(safeAcademyNext("/lms/student"), null);
    assert.equal(safeAcademyNext("//evil.example/academy/learn"), null);
  });
});
