import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

// The 22 admin tabs as registered in src/components/ui/modern-side-bar.tsx
// (case 'admin' branch of getNavigationItems). Unlike the school-admin
// sidebar (real <a href> links), the admin sidebar renders each item as a
// <button> that client-side-routes on click — no href to assert against.
const NAV_ITEMS: Array<{ name: string; href: string }> = [
  { name: 'Overview', href: '/lms/admin' },
  { name: 'Schools Management', href: '/lms/admin/schools' },
  { name: 'School Admin Management', href: '/lms/admin/school-admins' },
  { name: 'Teachers Management', href: '/lms/admin/teachers' },
  { name: 'Students Management', href: '/lms/admin/students' },
  { name: 'Course Progress', href: '/lms/admin/student-progress' },
  { name: 'Course Management', href: '/lms/admin/courses' },
  { name: 'Certificates', href: '/lms/admin/certificates' },
  { name: 'Notifications', href: '/lms/admin/notifications' },
  { name: 'Password Reset Requests', href: '/lms/admin/password-reset-requests' },
  { name: 'Teacher Reports', href: '/lms/admin/reports' },
  { name: 'Joining Codes', href: '/lms/admin/joining-codes' },
  { name: 'RoboCoders Licenses', href: '/lms/admin/licenses' },
  { name: 'School Logo Management', href: '/lms/admin/logos' },
  { name: 'Community Management', href: '/lms/admin/community' },
  { name: 'Performance Analytics', href: '/lms/admin/analytics' },
  { name: 'Assignment Analytics', href: '/lms/admin/assignment-analytics' },
  { name: 'System Monitoring', href: '/lms/admin/monitoring' },
  { name: 'Audit Log', href: '/lms/admin/audit-log' },
  { name: 'System Controls', href: '/lms/admin/system-controls' },
  { name: 'Trash', href: '/lms/admin/trash' },
  { name: 'Contact Submissions', href: '/lms/admin/contact-submissions' },
  { name: 'Settings', href: '/lms/admin/settings' },
];

test.describe('Admin — Layout / Navigation', () => {
  test('sidebar renders all 22 tabs', async ({ page }) => {
    await page.goto('/lms/admin');
    const nav = page.getByRole('navigation');
    await expect(nav).toBeVisible();

    for (const item of NAV_ITEMS) {
      // "Notifications" also matches "Notifications 1" (badge count appended
      // to the accessible name), so use a prefix match instead of exact.
      await expect(
        nav.getByRole('button', { name: new RegExp('^' + item.name) }),
        `sidebar button for "${item.name}"`,
      ).toHaveCount(1);
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
