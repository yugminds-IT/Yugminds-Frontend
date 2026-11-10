// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { scrubSentryRequest } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Off: this process handles the httpOnly session cookies and the IPs of students
  // (minors); neither should be sent to a third party.
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: false,

  // Belt and braces: onRequestError attaches raw request headers (Cookie,
  // Authorization) to events regardless, so scrub them before they are sent.
  beforeSend: (event) => scrubSentryRequest(event),
  beforeSendTransaction: (event) => scrubSentryRequest(event),
});
