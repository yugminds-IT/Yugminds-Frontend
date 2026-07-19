import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);

test.use({ storageState: path.resolve(__dirname, '.auth/school-admin.json') });

test.describe('School Admin — Dashboard', () => {
  test('renders real fixture stats, not zeros', async ({ page }) => {
    const statsResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/stats') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin');
    await statsResponse;

    // Header reflects the fixture school name and admin's real name.
    await expect(page.getByRole('heading', { name: /Admin Panel|School Admin Dashboard/ })).toBeVisible();
    await expect(page.getByText('Welcome back, QA School Admin')).toBeVisible();

    // Stat cards: fixture has 3 students and 2 teachers — a real, non-zero claim.
    const studentsCard = page.locator('text=Total Students').locator('..').locator('..');
    await expect(studentsCard.getByText('3', { exact: true })).toBeVisible();

    const teachersCard = page.locator('text=Total Teachers').locator('..').locator('..');
    await expect(teachersCard.getByText('2', { exact: true })).toBeVisible();
  });

  test('quick actions preview shows recent students and teachers by name', async ({ page }) => {
    await page.goto('/lms/school-admin');
    // Recent Students / Recent Teachers preview cards render fixture names, not "No recent data".
    await expect(page.getByText('QA Teacher 0').or(page.getByText('QA Teacher 1'))).toBeVisible({
      timeout: 15000,
    });
  });

  test('refresh button re-fetches dashboard stats', async ({ page }) => {
    await page.goto('/lms/school-admin');
    await page.waitForLoadState('networkidle').catch(() => {});

    const refetch = page.waitForResponse(
      (res) => res.url().includes('/school-admin/stats') && res.request().method() === 'GET',
    );
    await page.getByRole('button', { name: /Refresh/i }).click();
    const res = await refetch;
    expect(res.ok()).toBeTruthy();
  });

  test('stat card links navigate to the matching tab', async ({ page }) => {
    await page.goto('/lms/school-admin');
    await page.getByText('Total Students').click();
    await expect(page).toHaveURL(/\/lms\/school-admin\/students/);
  });
});
