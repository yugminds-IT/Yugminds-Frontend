/**
 * Strips credentials from a Sentry event before it leaves the process.
 *
 * Next's `onRequestError` (Sentry.captureRequestError) attaches the raw incoming
 * request headers to the event, and the SDK's request-data integration copies
 * headers and parsed cookies into `event.request`. Our session lives in httpOnly
 * cookies (`access_token`, `refresh_token`), so without this they would be sent
 * verbatim to a third party on any unhandled server error, defeating httpOnly.
 * Use it as `beforeSend` AND `beforeSendTransaction` on every Sentry.init.
 */
const SENSITIVE_HEADERS = new Set([
  "cookie",
  "set-cookie",
  "authorization",
  "proxy-authorization",
  "x-internal-api-key",
  "x-tenant-id",
  "x-csrf-token",
  "referer",
]);

type EventLike = {
  request?: { cookies?: unknown; headers?: Record<string, unknown> | undefined };
};

export function scrubSentryRequest<T extends EventLike>(event: T): T {
  const req = event.request;
  if (!req) return event;
  delete req.cookies;
  if (req.headers) {
    for (const name of Object.keys(req.headers)) {
      if (SENSITIVE_HEADERS.has(name.toLowerCase())) delete req.headers[name];
    }
  }
  return event;
}
