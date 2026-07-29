import { test, expect } from './base';
import path from 'path';


// The 12 school-admin tabs as registered in src/components/ui/modern-side-bar.tsx
// (case 'school_admin' branch of getNavigationItems). NOTE: each item renders
// as a <button onClick={() => router.push(item.href)}> (~line 390), not an
// <a href>, so there is no href attribute anywhere in the sidebar to select
// on — matching by the button's accessible name instead. (Minor UX/a11y
// observation, not a functional bug: primary nav via onClick-button means no
// native ctrl/cmd-click "open in new tab", no visible href on hover, no
// crawlable links — but navigation itself works correctly.)
const NAV_ITEM_NAMES = [
  'Overview',
  'Students Management',
  'Teachers Management',
  'Class Scheduling',
  'School Calendar',
  'Teacher Reports',
  'Courses',
  'Student Progress',
  'Assignment Analytics',
  'Notifications',
  'Password Reset Requests',
  'Settings',
];

test.describe('School Admin — Layout / Navigation', () => {
  test('sidebar renders all 12 tabs', async ({ page }) => {
    await page.goto('/lms/school-admin');
    await page.waitForSelector('nav');

    for (const name of NAV_ITEM_NAMES) {
      await expect(
        page.locator('nav').getByRole('button', { name, exact: true }),
        `nav button for "${name}"`,
      ).toHaveCount(1);
    }
  });

  test('unread notification badge matches the count the app itself fetched', async ({ page }) => {
    const unreadCountResponse = page.waitForResponse((res) =>
      res.url().includes('/notifications/unread-count'),
    );
    await page.goto('/lms/school-admin');
    const res = await unreadCountResponse;
    const body = await res.json().catch(() => ({}));
    const count = Number((body as { count?: number })?.count ?? 0);

    const notificationsButton = page.locator('nav').getByRole('button', { name: 'Notifications', exact: true });
    if (count > 0) {
      const expectedBadgeText = count > 9 ? '9+' : String(count);
      await expect(notificationsButton.getByText(expectedBadgeText, { exact: true })).toBeVisible();
    } else {
      // No badge element rendered at all when unread count is 0.
      await expect(notificationsButton.locator('span', { hasText: /^\d+\+?$/ })).toHaveCount(0);
    }
  });

  test('logout clears session and redirects to login, blocking back-navigation into the dashboard', async ({
    page,
  }) => {
    await page.goto('/lms/school-admin');
    await page.waitForSelector('nav');

    await page.getByRole('button', { name: /Logout/i }).click();
    await page.waitForURL(/\/lms\/login/, { timeout: 15000 });

    // Session must actually be invalidated — going back to the dashboard URL
    // directly should bounce to login again, not show cached authenticated UI.
    await page.goto('/lms/school-admin');
    await page.waitForURL(/\/lms\/login/, { timeout: 15000 });
  });
});
