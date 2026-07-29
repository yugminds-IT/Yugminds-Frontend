import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

// Smoke coverage for tabs not given a dedicated deep-dive spec: proves each
// route (a) actually calls its real backend endpoint and gets a 2xx back
// (where the page does fire an auto GET on mount — some, like Licenses and
// Settings, only call their API on user interaction/save, so those are
// marked apiSubstring: null and only get the render/crash check), and
// (b) renders a heading with no client-side crash. Deliberately
// low-specificity (no hardcoded field labels/exact text) since those have
// repeatedly turned out to be wrong on the first guess across this suite.
const TABS: Array<{ name: string; href: string; apiSubstring: string | null }> = [
  { name: 'Schools', href: '/lms/admin/schools', apiSubstring: '/admin/schools' },
  { name: 'School Admins', href: '/lms/admin/school-admins', apiSubstring: '/admin/school-admins' },
  { name: 'Teachers', href: '/lms/admin/teachers', apiSubstring: '/admin/teachers' },
  { name: 'Students', href: '/lms/admin/students', apiSubstring: '/admin/students' },
  { name: 'Course Progress', href: '/lms/admin/student-progress', apiSubstring: '/admin/student-progress' },
  { name: 'Courses', href: '/lms/admin/courses', apiSubstring: '/admin/courses' },
  { name: 'Certificates', href: '/lms/admin/certificates', apiSubstring: '/admin/certificates' },
  { name: 'Notifications', href: '/lms/admin/notifications', apiSubstring: '/admin/notifications' },
  { name: 'Password Reset Requests', href: '/lms/admin/password-reset-requests', apiSubstring: '/admin/password-reset-requests' },
  { name: 'Teacher Reports', href: '/lms/admin/reports', apiSubstring: '/admin/teacher-reports' },
  { name: 'Joining Codes', href: '/lms/admin/joining-codes', apiSubstring: '/admin/schools' },
  // Licenses only calls adminApi.licenses.list() once a school is selected —
  // no auto GET fires on mount.
  { name: 'Licenses', href: '/lms/admin/licenses', apiSubstring: null },
  { name: 'Logos', href: '/lms/admin/logos', apiSubstring: '/admin/logos' },
  { name: 'Community', href: '/lms/admin/community', apiSubstring: '/admin/community' },
  { name: 'Analytics', href: '/lms/admin/analytics', apiSubstring: '/admin/analytics' },
  { name: 'Assignment Analytics', href: '/lms/admin/assignment-analytics', apiSubstring: '/admin/assignment-analytics' },
  { name: 'Monitoring', href: '/lms/admin/monitoring', apiSubstring: '/admin/monitoring-dashboard' },
  { name: 'Audit Log', href: '/lms/admin/audit-log', apiSubstring: '/admin/audit-logs' },
  { name: 'System Controls', href: '/lms/admin/system-controls', apiSubstring: '/admin/system-controls' },
  { name: 'Trash', href: '/lms/admin/trash', apiSubstring: '/admin/trash' },
  { name: 'Contact Submissions', href: '/lms/admin/contact-submissions', apiSubstring: '/admin/contact-submissions' },
  // Settings only calls adminApi.profile.update on save — no GET on mount.
  { name: 'Settings', href: '/lms/admin/settings', apiSubstring: null },
];

test.describe('Admin — smoke: route loads + real API call succeeds', () => {
  for (const tab of TABS) {
    test(`${tab.name} (${tab.href})`, async ({ page }) => {
      // Generous timeout: on a freshly (re)started dev server, Turbopack
      // compiles each route on first visit, which can itself take well over
      // 20s and was observed timing out the API wait before the request
      // even started.
      const apiResponse = tab.apiSubstring
        ? page.waitForResponse(
            (res) => res.url().includes(tab.apiSubstring!) && res.request().method() === 'GET',
            { timeout: 45000 },
          )
        : null;
      await page.goto(tab.href, { waitUntil: 'commit' });
      if (apiResponse) {
        const res = await apiResponse;
        expect(res.ok(), `${tab.apiSubstring} should return 2xx on ${tab.href}`).toBeTruthy();
      }

      await expect(page.getByText(/Application error/i)).toHaveCount(0);
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15000 });
    });
  }
});
