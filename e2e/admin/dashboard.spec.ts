import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);

test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

test.describe('Admin — Dashboard', () => {
  test('renders real platform stats and fixture entries in recent activity', async ({ page }) => {
    const statsResponse = page.waitForResponse(
      (res) => res.url().includes('/admin/stats') && res.request().method() === 'GET',
    );
    await page.goto('/lms/admin');
    await statsResponse;

    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();

    // Platform-wide stat cards are real <a> links to their management tab.
    await expect(page.getByRole('link', { name: /^Total Schools:/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Total Teachers:/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Total Students:/ })).toBeVisible();

    // Recent Activity / quick-action previews show the fixture entries by
    // name — "QA Teacher 0" appears in both the Recent Teachers preview card
    // AND the Recent Activity feed, so scope to .first() to avoid a
    // strict-mode multi-match error.
    await expect(page.getByText('QA Teacher 0').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('QA Student 0').first()).toBeVisible();
  });

  test('refresh button re-fetches dashboard stats', async ({ page }) => {
    await page.goto('/lms/admin');
    await page.waitForLoadState('networkidle').catch(() => {});

    const refetch = page.waitForResponse(
      (res) => res.url().includes('/admin/stats') && res.request().method() === 'GET',
    );
    await page.getByRole('button', { name: /^Refresh$/ }).click();
    const res = await refetch;
    expect(res.ok()).toBeTruthy();
  });

  test('stat card link navigates to the matching tab', async ({ page }) => {
    await page.goto('/lms/admin');
    await page.getByRole('link', { name: /^Total Students:/ }).click();
    await page.waitForURL(/\/lms\/admin\/students/, { waitUntil: 'commit' });
  });

  test('Create Account dialog creates a real student via POST /admin/create-account', async ({ page }) => {
    await page.goto('/lms/admin');
    await page.getByRole('button', { name: /^Create Account$/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Default "Account Type" is already "student" (CreateAccountDialog.tsx
    // useState<AccountRole>('student')) — no need to touch that select.
    const email = `qa_e2e_dashboard_create_${Date.now()}@example.test`;
    await dialog.getByLabel(/Full Name/).fill('QA E2E Dashboard Created');
    await dialog.getByLabel(/^Email/).fill(email);
    await dialog.getByLabel(/^Password/).fill('QaTest123!');

    // NOTE: CreateAccountDialog.tsx's <Label htmlFor="school_id">/<Label
    // htmlFor="grade"> point at ids never set on the corresponding
    // <SelectTrigger> (same dead-htmlFor pattern already flagged in the
    // school-admin suite for students/page.tsx) — getByLabel() can't reach
    // these controls, so click by the visible placeholder text instead.
    await dialog.getByText('Select school', { exact: true }).click();
    await page.getByRole('option', { name: new RegExp(fixture.runId) }).click();

    await dialog.getByText('Select grade', { exact: true }).click();
    await page.getByRole('option', { name: fixture.grade, exact: true }).click();

    const createResponse = page.waitForResponse(
      (res) => res.url().includes('/admin/create-account') && res.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: /^Create Account$/ }).click();
    const res = await createResponse;
    expect(res.ok(), await res.text()).toBeTruthy();

    await expect(page.getByText(/Account created successfully/i)).toBeVisible({ timeout: 10000 });
  });
});
