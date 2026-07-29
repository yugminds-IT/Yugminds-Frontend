import { test, expect } from './base';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);


test.describe('Teacher — Dashboard', () => {
  test('renders real fixture context — school name, stat cards, and tabs', async ({ page }) => {
    const classesResponse = page.waitForResponse(
      (res) => res.url().includes('/teacher/classes') && res.request().method() === 'GET',
    );
    await page.goto('/lms/teacher');
    await classesResponse;

    await expect(page.getByRole('heading', { name: 'Teacher Dashboard' })).toBeVisible();

    // Header welcome text names the fixture school (createQaFixture names it
    // `${QA_PREFIX} School`, which embeds the run id).
    await expect(page.getByText(new RegExp(`at .*${fixture.runId}.* School`))).toBeVisible();

    // Real stat cards — titles are a stable claim even while values load.
    await expect(page.getByText("Today's Classes")).toBeVisible();
    await expect(page.getByText('Pending Reports')).toBeVisible();
    await expect(page.getByText('Total Classes')).toBeVisible();
    await expect(page.getByText('Pending Leaves')).toBeVisible();
    await expect(page.getByText('Monthly Attendance')).toBeVisible();

    // Main content tabs.
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Attendance' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Reports' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Analytics' })).toBeVisible();
  });

  test('refresh button re-fetches dashboard data', async ({ page }) => {
    await page.goto('/lms/teacher');
    await page.waitForLoadState('networkidle').catch(() => {});

    const refetch = page.waitForResponse(
      (res) => res.url().includes('/teacher/classes') && res.request().method() === 'GET',
    );
    await page.getByRole('button', { name: /^Refresh$/ }).click();
    const res = await refetch;
    expect(res.ok()).toBeTruthy();
  });

  test('tab switch loads the Attendance tab content', async ({ page }) => {
    await page.goto('/lms/teacher');
    await page.getByRole('tab', { name: 'Attendance' }).click();
    await expect(page.getByRole('tab', { name: 'Attendance' })).toHaveAttribute('data-state', 'active');
    await expect(page.getByText('Monthly Attendance Log')).toBeVisible({ timeout: 10000 });
  });
});
