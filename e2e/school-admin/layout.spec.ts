import { test, expect } from './base';


// The school-admin tabs as registered in src/components/portal/navs.ts (SCHOOL_ADMIN_NAV). Each is a real <a href> in
// the sidebar, so native ctrl/cmd-click "open in new tab" works and the href can be asserted.
const NAV_ITEMS: Array<{ name: string; href: string }> = [
  { name: 'Overview', href: '/lms/school-admin' },
  { name: 'Students management', href: '/lms/school-admin/students' },
  { name: 'Teachers management', href: '/lms/school-admin/teachers' },
  { name: 'Class scheduling', href: '/lms/school-admin/schedules' },
  { name: 'Teacher reports', href: '/lms/school-admin/reports' },
  { name: 'Courses', href: '/lms/school-admin/courses' },
  { name: 'Student progress', href: '/lms/school-admin/student-progress' },
  { name: 'Assignment analytics', href: '/lms/school-admin/assignment-analytics' },
  { name: 'Notifications', href: '/lms/school-admin/notifications' },
  { name: 'Password reset requests', href: '/lms/school-admin/password-reset-requests' },
  { name: 'Settings', href: '/lms/school-admin/settings' },
];

test.describe('School Admin — Layout / Navigation', () => {
  test('sidebar renders every tab with the right link', async ({ page }) => {
    await page.goto('/lms/school-admin');
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
    await page.goto('/lms/school-admin');
    const res = await unreadCountResponse;
    const body = await res.json().catch(() => ({}));
    const count = Number((body as { count?: number })?.count ?? 0);

    const notificationsLink = page.locator('nav a[href="/lms/school-admin/notifications"]');
    if (count > 0) {
      const expectedBadgeText = count > 99 ? '99+' : String(count);
      await expect(notificationsLink.getByText(expectedBadgeText, { exact: true })).toBeVisible();
    } else {
      // No badge element rendered at all when unread count is 0.
      await expect(notificationsLink.locator('span', { hasText: /^\d+\+?$/ })).toHaveCount(0);
    }
  });

  test('logout clears session and redirects to login, blocking back-navigation into the dashboard', async ({
    page,
  }) => {
    await page.goto('/lms/school-admin');
    await page.waitForSelector('nav');

    await page.getByRole('button', { name: /Log ?out/i }).click();
    await page.waitForURL(/\/lms\/login/, { timeout: 15000 });

    // Session must actually be invalidated — going back to the dashboard URL
    // directly should bounce to login again, not show cached authenticated UI.
    await page.goto('/lms/school-admin');
    await page.waitForURL(/\/lms\/login/, { timeout: 15000 });
  });
});
