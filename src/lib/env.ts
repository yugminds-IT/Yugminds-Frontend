
/**
 * Environment Variable Validation
 * 
 * Ensures all required environment variables are present at startup.
 * Fails fast if any required secrets are missing.
 * 
 * SECURITY: Never use fallback values for secrets in production.
 */

/**
 * Get required environment variable or throw error
 * During Next.js build (phase-production-build), returns placeholders for NEXT_PUBLIC_* vars so the build can complete.
 * @param key - Environment variable name
 * @param description - Human-readable description for error message
 * @returns The environment variable value
 * @throws Error if variable is missing or empty (except during build for NEXT_PUBLIC_*)
 */
export function getRequiredEnv(key: string, description?: string): string {
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
  const value = process.env[key];

  if (!value || value.trim() === '') {
    // During build, allow NEXT_PUBLIC_* placeholders so static analysis/page collection succeeds
    if (isBuildPhase && key.startsWith('NEXT_PUBLIC_')) {
      if (key === 'NEXT_PUBLIC_API_BASE_URL') return 'http://localhost:3000';
    }
    const errorMessage = description
      ? `${description} (${key}) is required but not set`
      : `Environment variable ${key} is required but not set`;

    throw new Error(errorMessage);
  }

  return value;
}

/**
 * Get optional environment variable with default value
 * Only use for non-sensitive configuration values
 * @param key - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns The environment variable value or default
 */
export function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Validate all required environment variables at startup
 * Call this early in the application lifecycle
 */
export function validateRequiredEnv(): void {
  const requiredVars: { key: string; description: string }[] = [
    { key: 'JWT_ACCESS_SECRET', description: 'JWT signing secret used by middleware to verify access tokens (must match backend)' },
    { key: 'BACKEND_URL', description: 'NestJS server URL used by Next.js API route proxy' },
  ];

  const missing: string[] = [];

  for (const { key, description } of requiredVars) {
    try {
      getRequiredEnv(key, description);
    } catch (error) {
      missing.push(`${key} (${description})`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((v: string) => `  - ${v}`).join('\n')}\n\n` +
      `Please set these in your .env.local file or environment.`
    );
  }
}

