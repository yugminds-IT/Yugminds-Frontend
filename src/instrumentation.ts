import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');

    // Fail fast if required server-side env vars are missing
    const { validateRequiredEnv } = await import('./lib/env');
    validateRequiredEnv();

    // Dynamic import keeps server-only modules (cache-warming, axios, session-utils)
    // out of the Edge Runtime bundle — they use Node.js APIs like BroadcastChannel.
    const { initializeServer } = await import('./lib/server-init');
    
    // Initialize server optimizations on startup (non-blocking)
    // This warms the cache for faster first requests
    initializeServer().catch((error) => {
      // Log but don't throw - initialization failure shouldn't block server startup
      console.warn('Server initialization failed:', error);
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
