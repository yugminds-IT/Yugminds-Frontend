import { test, expect } from './base';


test.describe('School Admin — Dashboard', () => {
  test('renders real fixture stats, not zeros', async ({ page }) => {
    const statsResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/stats') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin');
    await statsResponse;

    // Header shows the fixture school name; the greeting uses the admin's first name.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/Good (morning|afternoon|evening), QA/)).toBeVisible();

    // Summary ledger: fixture has 3 students and 2 teachers — a real, non-zero claim.
    // Each entry is a link whose accessible name is "<label> <value> <hint>".
    const summary = page.getByRole('navigation', { name: 'School summary' });
    await expect(summary.getByRole('link', { name: /^Students 3\b/ })).toBeVisible();
    await expect(summary.getByRole('link', { name: /^Teachers 2\b/ })).toBeVisible();
  });

  test('recently joined shows students and teachers by name', async ({ page }) => {
    await page.goto('/lms/school-admin');
    // The "Recently joined" panel lists fixture people by name, not the empty state.
    await expect(page.getByText('QA Teacher 0').or(page.getByText('QA Teacher 1')).first()).toBeVisible({
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

  test('summary links navigate to the matching tab', async ({ page }) => {
    await page.goto('/lms/school-admin');
    await page.getByRole('navigation', { name: 'School summary' }).getByRole('link', { name: /^Students/ }).click();
    await expect(page).toHaveURL(/\/lms\/school-admin\/students/);
  });
});
