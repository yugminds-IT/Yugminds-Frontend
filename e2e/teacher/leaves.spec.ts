import { test, expect } from './base';

function isoDate(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().split('T')[0];
}

test.describe('Teacher — Leaves', () => {
  test('sending a leave request through the form shows it in Your requests', async ({ page }) => {
    await page.goto('/lms/teacher/leaves');
    await expect(page.getByRole('heading', { level: 1, name: 'Leave requests' })).toBeVisible();
    await page.getByRole('button', { name: 'Apply for leave' }).first().click();

    const uniqueReason = `QA e2e leave reason ${Date.now()}`;
    await page.locator('#start_date').fill(isoDate(1));
    await page.locator('#end_date').fill(isoDate(2));
    await page.locator('#reason').fill(uniqueReason);

    const createResponse = page.waitForResponse(
      (res) => res.url().endsWith('/teacher/leaves') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Send request' }).click();
    const createRes = await createResponse;
    expect(createRes.ok(), await createRes.text()).toBeTruthy();

    const leaveCard = page.getByRole('article').filter({ hasText: uniqueReason });
    await expect(leaveCard).toBeVisible({ timeout: 10000 });
    await expect(leaveCard.getByText('Waiting', { exact: true })).toBeVisible();
  });
});
