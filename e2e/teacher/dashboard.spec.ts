import { test, expect } from './base';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);


test.describe('Teacher — Dashboard', () => {
  test('renders real fixture context — school name, the four numbers, and tabs', async ({ page }) => {
    const classesResponse = page.waitForResponse(
      (res) => res.url().includes('/teacher/classes') && res.request().method() === 'GET',
    );
    await page.goto('/lms/teacher');
    await classesResponse;

    // The hero heading names the fixture school (createQaFixture names it
    // `${QA_PREFIX} School`, which embeds the run id).
    await expect(
      page.getByRole('heading', { level: 1, name: new RegExp(`${fixture.runId}.* School`) }),
    ).toBeVisible();

    // The four numbers under the hero — labels are a stable claim even while values load.
    const numbers = page.getByRole('navigation', { name: 'Your numbers' });
    await expect(numbers.getByText('Classes today')).toBeVisible();
    await expect(numbers.getByText('Reports in review')).toBeVisible();
    await expect(numbers.getByText('Leave requests')).toBeVisible();
    await expect(numbers.getByText('Attendance this month')).toBeVisible();

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

  test('tab switch loads the Attendance tab content (today and the last six months)', async ({ page }) => {
    await page.goto('/lms/teacher');
    await page.getByRole('tab', { name: 'Attendance' }).click();
    await expect(page.getByRole('tab', { name: 'Attendance' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Last six months' })).toBeVisible({ timeout: 10000 });
  });
});
