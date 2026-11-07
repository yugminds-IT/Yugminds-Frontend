import { test, expect } from './base';

// The teacher tabs as registered in src/components/portal/navs.ts (TEACHER_NAV). Each is a real <a href> in the sidebar.
const NAV_ITEMS: Array<{ name: string; href: string }> = [
  { name: 'Dashboard', href: '/lms/teacher' },
  { name: 'My classes', href: '/lms/teacher/classes' },
  { name: 'Submit report', href: '/lms/teacher/reports' },
  { name: 'Attendance', href: '/lms/teacher/attendance' },
  { name: 'School calendar', href: '/lms/teacher/calendar' },
  { name: 'Leave requests', href: '/lms/teacher/leaves' },
  { name: 'Notifications', href: '/lms/teacher/notifications' },
  { name: 'Analytics', href: '/lms/teacher/analytics' },
  { name: 'Student progress', href: '/lms/teacher/student-progress' },
  { name: 'Assignments', href: '/lms/teacher/assignments' },
  { name: 'Settings', href: '/lms/teacher/settings' },
];

test.describe('Teacher — Layout / Navigation', () => {
  test('sidebar renders all 11 tabs with correct hrefs', async ({ page }) => {
    await page.goto('/lms/teacher');
    await page.waitForSelector('nav');

    for (const item of NAV_ITEMS) {
      const link = page.locator(`nav a[href="${item.href}"]`);
      await expect(link, `nav link for "${item.name}" (${item.href})`).toHaveCount(1);
      await expect(link).toContainText(item.name);
    }
  });

  test('unread notification badge matches the count the app itself fetched', async ({ page }) => {
    const unreadCountResponse = page.waitForResponse((res) =>
      res.url().includes('/notifications/unread-count'),
    );
    await page.goto('/lms/teacher');
    const res = await unreadCountResponse;
    const body = await res.json().catch(() => ({}));
    const count = Number((body as { count?: number })?.count ?? 0);

    const notificationsLink = page.locator('nav a[href="/lms/teacher/notifications"]');
    if (count > 0) {
      const expectedBadgeText = count > 99 ? '99+' : String(count);
      await expect(notificationsLink.getByText(expectedBadgeText, { exact: true })).toBeVisible();
    } else {
      // No badge element rendered at all when unread count is 0.
      await expect(notificationsLink.locator('span', { hasText: /^\d+\+?$/ })).toHaveCount(0);
    }
  });

  test('navigating between tabs loads the corresponding page', async ({ page }) => {
    await page.goto('/lms/teacher');
    await page.waitForSelector('nav');

    await page.locator('nav a[href="/lms/teacher/leaves"]').click();
    await page.waitForURL(/\/lms\/teacher\/leaves/);
    await expect(page.getByRole('heading', { name: 'Leave Requests' })).toBeVisible();

    await page.locator('nav a[href="/lms/teacher/attendance"]').click();
    await page.waitForURL(/\/lms\/teacher\/attendance/);
    await expect(page.getByRole('heading', { name: 'Attendance' })).toBeVisible();
  });

  test('logout clears session and redirects to login, blocking back-navigation into the dashboard', async ({
    page,
  }) => {
    await page.goto('/lms/teacher');
    await page.waitForSelector('nav');

    await page.getByRole('button', { name: /Log ?out/i }).click();
    await page.waitForURL(/\/lms\/login/, { timeout: 15000 });

    // Session must actually be invalidated — going back to the dashboard URL
    // directly should bounce to login again, not show cached authenticated UI.
    await page.goto('/lms/teacher');
    await page.waitForURL(/\/lms\/login/, { timeout: 15000 });
  });
});
