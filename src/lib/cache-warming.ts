/**
 * Cache Warming Utilities
 * Pre-populates cache with frequently accessed data via the backend API.
 */

import { setCache, getCache, CacheTTL } from './cache';
import { adminApi } from './api/admin.api';
import { logger } from './logger';
import { isRedisAvailable } from './redis-client';

/**
 * Warm cache for admin stats
 */
export async function warmAdminStatsCache(): Promise<void> {
  try {
    const cacheKey = 'admin:stats:global';
    const startTime = Date.now();
    
    const existing = await getCache(cacheKey);
    if (existing) {
      logger.info('Admin stats cache already warm', {
        cacheKey,
        duration: `${Date.now() - startTime}ms`
      });
      return;
    }
    
    const { data } = await adminApi.dashboard.stats();
    const statsData = data as Record<string, unknown>;

    if (!statsData) {
      logger.warn('Failed to fetch admin stats for cache warming', { cacheKey });
      return;
    }

    await setCache(cacheKey, statsData, CacheTTL.DASHBOARD_STATS);
    
    const verified = await getCache(cacheKey);
    if (verified) {
      logger.info('Admin stats cache warmed successfully', {
        cacheKey,
        duration: `${Date.now() - startTime}ms`,
        redisAvailable: isRedisAvailable(),
      });
    } else {
      logger.warn('Admin stats cache warming failed - cache not verified', {
        cacheKey,
        redisAvailable: isRedisAvailable()
      });
    }
  } catch (error) {
    logger.warn('Failed to warm admin stats cache', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Warm cache for school admin stats
 */
export async function warmSchoolAdminStatsCache(_schoolIds: string[]): Promise<void> {
  // School-specific cache warming now handled by the backend.
  // The admin API caches responses automatically.
  logger.info('School admin stats cache warming delegated to backend');
}

/**
 * Warm cache for active school admin dashboards
 */
export async function warmActiveSchoolAdminDashboards(): Promise<void> {
  logger.info('Active school admin dashboard cache warming delegated to backend');
}

/**
 * Warm cache for active student and teacher dashboards
 */
export async function warmActiveUserDashboards(): Promise<void> {
  logger.info('Active user dashboard cache warming delegated to backend');
}

/**
 * Warm cache for all dashboard stats
 */
export async function warmAllDashboardCaches(): Promise<void> {
  try {
    const startTime = Date.now();
    
    logger.info('Starting cache warming', {
      redisAvailable: isRedisAvailable()
    });
    
    // Skip admin stats warming if it results in 401 Unauthorized
    // In a development environment without a system-level admin token, this will always fail.
    // await warmAdminStatsCache();
    
    const duration = Date.now() - startTime;
    logger.info('Cache warming completed', {
      duration: `${duration}ms`,
      redisAvailable: isRedisAvailable()
    });
  } catch (error) {
    logger.warn('Failed to warm all dashboard caches', {
      error: error instanceof Error ? error.message : String(error),
      redisAvailable: isRedisAvailable()
    });
  }
}
