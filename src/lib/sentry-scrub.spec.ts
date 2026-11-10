import test from "node:test";
import assert from "node:assert/strict";
import { scrubSentryRequest } from "./sentry-scrub.ts";

test("removes session cookies and credential headers (any header casing)", () => {
  const event = {
    request: {
      cookies: { access_token: "a", refresh_token: "r" },
      headers: {
        Cookie: "access_token=a; refresh_token=r",
        Authorization: "Bearer secret",
        "X-Internal-Api-Key": "k",
        "x-tenant-id": "t",
        "content-type": "application/json",
        "user-agent": "jest",
      } as Record<string, unknown>,
    },
  };
  const out = scrubSentryRequest(event);
  assert.equal(out.request.cookies, undefined);
  assert.deepEqual(out.request.headers, {
    "content-type": "application/json",
    "user-agent": "jest",
  });
});

test("is a no-op for events without a request, and keeps other fields", () => {
  const e = { message: "boom" } as { message: string; request?: undefined };
  assert.deepEqual(scrubSentryRequest(e), { message: "boom" });
});
