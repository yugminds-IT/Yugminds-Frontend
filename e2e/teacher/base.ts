import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';

/**
 * Shared `test`/`expect` for every teacher spec.
 *
 * WHY NOT a static storageState.json reused across the whole run: the app's
 * session model (src/lib/session-utils.ts) keeps the access token in-memory
 * only and relies on a silent `POST /api/auth/refresh` (httpOnly refresh_token
 * cookie) on every full page load. The backend ROTATES the refresh_token
 * cookie on every /auth/refresh call (auth.controller.ts refresh() always
 * `res.cookie(REFRESH_TOKEN_COOKIE_NAME, newRefreshToken, ...)`). Playwright's
 * `storageState` file is a point-in-time snapshot: once ANY test's first
 * navigation consumes/rotates that cookie, every OTHER test file — which each
 * get a brand-new browser context re-reading the same on-disk snapshot — is
 * left holding a stale, already-invalidated cookie and bounces to /lms/login.
 * That's why only ever the first spec in a full run could pass (this is the
 * same bug e2e/admin still has; e2e/school-admin fixed it the same way this
 * suite does).
 *
 * Fix: log in for real through the UI once per test (not once per whole run).
 * This sidesteps rotation entirely (each test mints its own fresh cookie) and
 * also means a test that deliberately logs out (layout.spec.ts) can never
 * poison any other test's session.
 */

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);

export const test = base.extend<Record<string, never>>({
  page: async ({ page }, use) => {
    await page.goto('/lms/login');
    await page.locator('#email').fill(fixture.teachers[0].email);
    await page.locator('#password').fill(fixture.teachers[0].password);
    await Promise.all([
      page.waitForURL(/\/lms\/teacher/, { timeout: 30_000 }),
      page.locator('button[type="submit"]').click(),
    ]);
    await use(page);
  },
});

export { expect, fixture };
