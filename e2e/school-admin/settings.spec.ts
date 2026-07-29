import { test, expect } from './base';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);


// NOTE: settings/page.tsx exposes no data export/import UI at all (that only
// exists via schoolAdminApi.data.export/import, unused by this page) — nothing
// to test there. It does expose a real password-change flow, but deliberately
// NOT exercised here: it would invalidate the shared storageState session
// (e2e/school-admin/.auth/school-admin.json) that every other spec file in
// this suite depends on for its own fresh browser context, and there's no
// reliable "change it back" step worth the risk of leaving the fixture
// school-admin's password out of sync with fixture.schoolAdmin.password.

test.describe('School Admin — Settings', () => {
  test('profile form loads pre-filled with the real fixture admin data', async ({ page }) => {
    const profileResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/profile') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin/settings');
    const res = await profileResponse;
    expect(res.ok()).toBeTruthy();

    await expect(page.locator('#full_name')).toHaveValue('QA School Admin');
    // NOTE: the fixture email also appears in the sidebar footer on every
    // page (not just here), so a bare getByText() is a strict-mode multi-match
    // — scope to the "Email Address" field specifically.
    await expect(
      page.getByText('Email Address').locator('..').getByText(fixture.schoolAdmin.email),
    ).toBeVisible();
  });

  test('updating full name persists via PATCH /school-admin/profile', async ({ page }) => {
    await page.goto('/lms/school-admin/settings');
    await page.waitForResponse(
      (res) => res.url().includes('/school-admin/profile') && res.request().method() === 'GET',
    );

    const updatedName = `QA School Admin Updated ${Date.now()}`;

    // Always restore the original name at the end, even if an assertion
    // throws mid-test — an earlier version of this test left the fixture
    // school-admin's name permanently changed on failure, silently breaking
    // every later spec/test in the same run that expects "QA School Admin"
    // (dashboard.spec.ts's welcome message, etc.).
    try {
      await page.locator('#full_name').fill(updatedName);

      const updateResponse = page.waitForResponse(
        (res) => res.url().includes('/school-admin/profile') && res.request().method() === 'PATCH',
      );
      await page.getByRole('button', { name: /Save Profile/i }).click();
      const updateRes = await updateResponse;
      expect(updateRes.ok(), await updateRes.text()).toBeTruthy();

      await expect(page.getByText('Profile updated successfully!')).toBeVisible({ timeout: 10000 });

      // Reload and confirm the change actually persisted server-side, not
      // just reflected optimistically in local state. NOTE: a full reload
      // fires GET /school-admin/profile from BOTH school-admin/layout.tsx's
      // own bootstrap AND this page's loadUserData() — waiting for network
      // idle first ensures we're asserting after both have long since
      // resolved, not racing the first of the two to respond.
      await page.reload();
      await page.waitForResponse(
        (res) => res.url().includes('/school-admin/profile') && res.request().method() === 'GET',
      );
      await page.waitForLoadState('networkidle').catch(() => {});
      await expect(page.locator('#full_name')).toHaveValue(updatedName, { timeout: 15000 });
    } finally {
      const restoreResponse = page.waitForResponse(
        (res) => res.url().includes('/school-admin/profile') && res.request().method() === 'PATCH',
      );
      await page.locator('#full_name').fill('QA School Admin');
      await page.getByRole('button', { name: /Save Profile/i }).click();
      const restoreRes = await restoreResponse;
      expect(restoreRes.ok(), await restoreRes.text()).toBeTruthy();
    }
  });
});
