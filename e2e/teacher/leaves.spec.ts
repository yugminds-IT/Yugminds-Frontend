import { test, expect } from './base';

function isoDate(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().split('T')[0];
}

test.describe('Teacher — Leaves', () => {
  test('submitting a leave request through the real form shows it in Leave History', async ({ page }) => {
    await page.goto('/lms/teacher/leaves');
    await expect(page.getByRole('heading', { name: 'Leave Requests' })).toBeVisible();

    const uniqueReason = `QA e2e leave reason ${Date.now()}`;
    await page.locator('#start_date').fill(isoDate(1));
    await page.locator('#end_date').fill(isoDate(2));
    await page.locator('#reason').fill(uniqueReason);

    const createResponse = page.waitForResponse(
      (res) => res.url().endsWith('/teacher/leaves') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Submit Leave Request' }).click();
    const createRes = await createResponse;
    expect(createRes.ok(), await createRes.text()).toBeTruthy();

    const leaveCard = page.locator('.border.rounded-lg', { hasText: uniqueReason });
    await expect(leaveCard).toBeVisible({ timeout: 10000 });
    await expect(leaveCard.getByText('Pending')).toBeVisible();
  });
});
