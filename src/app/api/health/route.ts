import { NextRequest, NextResponse } from 'next/server';
import { performHealthCheck, type HealthCheckResult } from '../../../lib/monitoring';

/**
 * Health Check Endpoint
 * 
 * GET /api/health
 * Returns the health status of the application including:
 * - Database connectivity
 * - Cache status
 * - API metrics
 */
// Cache health check result for 5 seconds to avoid repeated database calls
let cachedHealthCheck: { result: HealthCheckResult; timestamp: number } | null = null;
const HEALTH_CHECK_CACHE_TTL = 5000; // 5 seconds

function httpStatusFor(result: HealthCheckResult): number {
  return result.status === 'unhealthy' ? 503 : 200;
}

export async function GET(_request: NextRequest) {
  const now = Date.now();
  if (cachedHealthCheck && (now - cachedHealthCheck.timestamp) < HEALTH_CHECK_CACHE_TTL) {
    return NextResponse.json(cachedHealthCheck.result, { status: httpStatusFor(cachedHealthCheck.result) });
  }
  
  try {
    // Use Promise.race to ensure health check completes quickly (200ms max)
    const healthCheckPromise = performHealthCheck();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Health check timeout')), 200)
    );
    
    const healthCheck = await Promise.race([healthCheckPromise, timeoutPromise]) as Awaited<ReturnType<typeof performHealthCheck>>;
    
    // Cache the result
    cachedHealthCheck = {
      result: healthCheck,
      timestamp: now
    };
    
    return NextResponse.json(healthCheck, { status: httpStatusFor(healthCheck) });
  } catch {
    const fallbackResult = {
      status: 'unhealthy' as const,
      timestamp: Date.now(),
      checks: {
        database: { status: 'unhealthy' as const, responseTime: 0 },
        cache: { status: 'unhealthy' as const, size: 0, maxSize: 0 },
        api: { status: 'unhealthy' as const, totalRequests: 0, errorRate: 0, averageResponseTime: 0 }
      }
    };

    cachedHealthCheck = { result: fallbackResult, timestamp: now };

    return NextResponse.json(fallbackResult, { status: 503 });
  }
}

