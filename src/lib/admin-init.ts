/**
 * Admin User Initialization
 * 
 * Automatically creates or updates the admin user on server startup.
 * Delegates to the backend API for account creation.
 * 
 * The function is idempotent - safe to run multiple times.
 */

import { AccountCreationService } from './account-creation-service';
import { logger } from './logger';

const ADMIN_CONFIG = {
  email: process.env.ADMIN_EMAIL ?? '',
  password: process.env.ADMIN_PASSWORD ?? '',
  full_name: process.env.ADMIN_FULL_NAME || 'Admin User',
  role: 'admin' as const,
};

export async function initializeAdminUser(): Promise<void> {
  try {
    if (!ADMIN_CONFIG.email || !ADMIN_CONFIG.password) {
      logger.info('Skipping admin init: ADMIN_EMAIL and ADMIN_PASSWORD must be set');
      return;
    }
    logger.info('Initializing admin user...', {
      email: ADMIN_CONFIG.email,
    });

    const result = await AccountCreationService.createAccount({
      role: ADMIN_CONFIG.role,
      email: ADMIN_CONFIG.email,
      password: ADMIN_CONFIG.password,
      full_name: ADMIN_CONFIG.full_name,
    });

    if (result.success) {
      logger.info('Admin user initialized successfully', {
        userId: result.userId,
        email: ADMIN_CONFIG.email,
      });
    } else {
      // "already exists" is expected on subsequent starts
      if (result.error?.includes('already exists')) {
        logger.info('Admin user already exists', { email: ADMIN_CONFIG.email });
      } else {
        logger.warn('Admin user initialization issue', {
          error: result.error,
          email: ADMIN_CONFIG.email,
        });
      }
    }
  } catch (error) {
    logger.warn('Admin user initialization failed', {
      error: error instanceof Error ? error.message : String(error),
      email: ADMIN_CONFIG.email,
    });
  }
}
