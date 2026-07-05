import { NextRequest } from 'next/server';
import { getAuthenticatedUserId } from './auth-utils';

import { redis, isRedisAvailable } from './redis-client';

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Optional: Custom identifier (defaults to IP address or user ID) */
  identifier?: string;
  /** Optional: Endpoint path for per-endpoint rate limiting */
  endpoint?: string;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

/**
 * Get client identifier from request
 * Prefers user ID if authenticated, otherwise falls back to IP address
 */
async function getIdentifier(request: NextRequest, customIdentifier?: string): Promise<string> {
  if (customIdentifier) {
    return customIdentifier;
  }
  
  // Try to get user ID from auth token (preferred for authenticated users)
  // Suppress warning since this is optional for rate limiting (public endpoints may not have auth)
  try {
    const userId = await getAuthenticatedUserId(request, true);
    if (userId) {
      return `user:${userId}`;
    }
  } catch (error) {
    // Fall through to IP-based identification
  }
  
  // Fallback to IP address for unauthenticated requests
  return `ip:${getClientIp(request)}`;
}

/**
 * Resolve the genuine client IP from X-Forwarded-For without trusting
 * client-spoofable entries.
 *
 * Proxies APPEND to X-Forwarded-For, so the rightmost entries are the ones our
 * own infrastructure added and can be trusted; anything further left may have
 * been injected by the client. With N trusted proxy hops, the real client is the
 * Nth entry from the right — picking the leftmost entry (the previous behaviour)
 * let a client spoof `X-Forwarded-For` and dodge per-IP limits entirely.
 *
 * Set TRUSTED_PROXY_HOPS to the number of proxies/CDN hops in front of the app
 * (default 1). This mirrors Express `trust proxy` semantics on the backend.
 */
function getClientIp(request: NextRequest): string {
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? 1) || 1);
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      const idx = parts.length - hops;
      return parts[idx >= 0 ? idx : 0];
    }
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

/**
 * Atomic sliding-window rate limit, evaluated server-side in Redis.
 *
 * KEYS[1] = sorted-set key
 * ARGV[1] = now (ms)         ARGV[2] = windowStart (ms)
 * ARGV[3] = maxRequests      ARGV[4] = windowSeconds (TTL)
 * ARGV[5] = unique member
 * Returns { allowed(0|1), countInWindow, oldestScoreMs }
 */
const SLIDING_WINDOW_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, tonumber(ARGV[2]))
local count = redis.call('ZCARD', KEYS[1])
if count >= tonumber(ARGV[3]) then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  local oldestScore = oldest[2] or ARGV[1]
  return {0, count, oldestScore}
end
redis.call('ZADD', KEYS[1], tonumber(ARGV[1]), ARGV[5])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
return {1, count + 1, 0}
`;

export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const identifier = await getIdentifier(request, config.identifier);
  // Normalize endpoint: use empty string instead of null (database expects NOT NULL)
  const endpoint = config.endpoint || '';
  const now = Date.now();
  const nowSeconds = Math.floor(now / 1000);
  const windowMs = config.windowSeconds * 1000;
  const windowStart = now - windowMs;
  
  // Try Redis first (sliding window algorithm - more accurate)
  if (isRedisAvailable()) {
    try {
      const key = `ratelimit:${identifier}:${endpoint}:${config.windowSeconds}`;
      const member = `${now}-${Math.random()}`;

      // Prune-count-add is run as a single atomic Lua script. Doing these as
      // separate round-trips (zcard then zadd) is a check-then-act race: under
      // concurrency many requests read a count below the limit and all get
      // admitted. The script makes the whole decision atomic per request.
      // Returns [allowed (0|1), countInWindow, oldestScoreMs].
      const result = await redis.eval<[number, number, number]>(
        SLIDING_WINDOW_SCRIPT,
        [key],
        [now, windowStart, config.maxRequests, config.windowSeconds, member],
      );

      if (result) {
        const allowed = Number(result[0]) === 1;
        const count = Number(result[1]);

        if (!allowed) {
          const oldestTime = Number(result[2]) || now;
          const retryAfter = Math.max(
            1,
            Math.ceil((oldestTime + windowMs - now) / 1000),
          );
          return {
            success: false,
            limit: config.maxRequests,
            remaining: 0,
            reset: Math.floor((now + windowMs) / 1000),
            retryAfter,
          };
        }

        return {
          success: true,
          limit: config.maxRequests,
          remaining: Math.max(0, config.maxRequests - count),
          reset: Math.floor((now + windowMs) / 1000),
        };
      }
      // eval returned null (script error / unavailable) → fall through to fail open
    } catch (error) {
      console.error('[RateLimit] Redis error, failing open:', error);
    }
  }

  // No Redis - fail open to prevent blocking
  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - 1,
    reset: nowSeconds + config.windowSeconds,
  };
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitPresets = {
  /** Authentication endpoints: 5 requests per minute */
  AUTH: {
    maxRequests: 5,
    windowSeconds: 60,
  },
  
  /** General API endpoints: 100 requests per minute */
  API: {
    maxRequests: 100,
    windowSeconds: 60,
  },
  
  /** File upload endpoints: 30 requests per minute (increased for admin operations) */
  UPLOAD: {
    maxRequests: 30,
    windowSeconds: 60,
  },
  
  /** Read-only endpoints: 200 requests per minute */
  READ: {
    maxRequests: 200,
    windowSeconds: 60,
  },
  
  /** Write endpoints: 50 requests per minute */
  WRITE: {
    maxRequests: 50,
    windowSeconds: 60,
  },

  /**
   * Admin bulk operations (e.g. importing many student accounts).
   * Keyed per admin user, so this is a generous per-admin budget — high enough
   * that a bulk import firing one request per account isn't throttled, while
   * still capping a runaway loop.
   */
  BULK: {
    maxRequests: 300,
    windowSeconds: 60,
  },
} as const;

/**
 * Helper to create rate limit response headers
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
    ...(result.retryAfter && {
      'Retry-After': result.retryAfter.toString(),
    }),
  };
}

/**
 * Cleanup expired rate limit entries
 * This should be called periodically (e.g., via cron job or scheduled function)
 * to prevent the rate_limits table from growing indefinitely
 * 
 * @returns Number of deleted entries
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  // TODO: Implement via backend when rate limit storage is migrated
  return 0;
}

