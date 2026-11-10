import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml } from "./escape-html.ts";

test("escapes markup, quotes and ampersands", () => {
  assert.equal(
    escapeHtml(`<img src=x onerror="alert('x')">&`),
    "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;",
  );
});

test("null/undefined/numbers become safe strings", () => {
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
  assert.equal(escapeHtml(42), "42");
});

test("plain text is unchanged", () => {
  assert.equal(escapeHtml("Asha Rao, Grade 4"), "Asha Rao, Grade 4");
});
