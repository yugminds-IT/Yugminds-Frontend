import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

// The admin tabs as registered in src/components/portal/navs.ts (ADMIN_NAV). Each is a real <a href> in the sidebar.
const NAV_ITEMS: Array<{ name: string; href: string }> = [
  { name: 'Overview', href: '/lms/admin' },
  { name: 'Schools management', href: '/lms/admin/schools' },
  { name: 'School admin management', href: '/lms/admin/school-admins' },
  { name: 'Teachers management', href: '/lms/admin/teachers' },
  { name: 'Students management', href: '/lms/admin/students' },
  { name: 'Course progress', href: '/lms/admin/student-progress' },
  { name: 'Course management', href: '/lms/admin/courses' },
  { name: 'Certificates', href: '/lms/admin/certificates' },
  { name: 'Notifications', href: '/lms/admin/notifications' },
  { name: 'Password reset requests', href: '/lms/admin/password-reset-requests' },
  { name: 'Teacher reports', href: '/lms/admin/reports' },
  { name: 'Joining codes', href: '/lms/admin/joining-codes' },
  { name: 'RoboCoders licenses', href: '/lms/admin/licenses' },
  { name: 'School logo management', href: '/lms/admin/logos' },
  { name: 'Community management', href: '/lms/admin/community' },
  { name: 'Performance analytics', href: '/lms/admin/analytics' },
  { name: 'Assignment analytics', href: '/lms/admin/assignment-analytics' },
  { name: 'System monitoring', href: '/lms/admin/monitoring' },
  { name: 'Audit log', href: '/lms/admin/audit-log' },
  { name: 'System controls', href: '/lms/admin/system-controls' },
  { name: 'Trash', href: '/lms/admin/trash' },
  { name: 'Contact submissions', href: '/lms/admin/contact-submissions' },
  { name: 'Settings', href: '/lms/admin/settings' },
];

test.describe('Admin — Layout / Navigation', () => {
  test('sidebar renders every tab with the right link', async ({ page }) => {
    await page.goto('/lms/admin');
    await page.waitForSelector('nav');

    for (const item of NAV_ITEMS) {
      const link = page.locator(`nav a[href="${item.href}"]`);
      await expect(link, `nav link for "${item.name}" (${item.href})`).toHaveCount(1);
      // A badge count can be appended to the accessible name ("Notifications 1"), so match the start of the text.
      await expect(link).toContainText(item.name);
    }
  });

  // A single loop test that goto()s all 22 routes back-to-back proved flaky
  // in this environment (one run hit net::ERR_ABORTED navigating to
  // joining-codes ~3 minutes in, likely dev-server/HMR strain from rapid
  // heavy-page navigations rather than an app bug). Each tab's own spec file
  // already does a goto + real-data assertion, which is equivalent
  // "does this route render" coverage without the compounding flakiness —
  // so this suite intentionally does not duplicate that here.
});
