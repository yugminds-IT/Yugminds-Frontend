import { test, expect } from './base';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';
import { BACKEND_URL } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);


test.describe('School Admin — Teachers', () => {
  test('renders real teacher roster, not a zero-state', async ({ page }) => {
    const teachersResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/teachers') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin/teachers');
    await teachersResponse;

    await expect(page.getByText('QA Teacher 0')).toBeVisible();
    await expect(page.getByText('QA Teacher 1')).toBeVisible();
  });

  test('teacher classes and subjects are shown in the teacher list', async ({ page }) => {
    const teachersResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/teachers') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin/teachers');
    const res = await teachersResponse;
    const body = await res.json();
    const teachers = (body?.teachers ?? []) as Array<{
      email: string;
      teacher_schools?: Array<{ grades_assigned?: string[]; subjects?: string[] }>;
    }>;

    const teacher0 = teachers.find((t) => t.email === fixture.teachers[0].email);
    expect(teacher0, 'fixture teacher 0 should be present in API response').toBeTruthy();
    // The backend returns the fixture's grade and subject...
    expect(teacher0!.teacher_schools?.[0]?.grades_assigned).toContain(fixture.grade);
    expect(teacher0!.teacher_schools?.[0]?.subjects).toContain('General');
    // NOTE: the backend only derives `grades_assigned` (the grade name) from
    // teacherSectionAssignments; it does not return the assigned *section* name
    // (school-admin-extra.controller.ts listTeachers()), so the row shows the grade only.

    // ...and the list now shows both. (The old table dropped teacher_schools
    // entirely, so a school admin could not see what a teacher was assigned.)
    const teacherRow = page.getByRole('article').filter({ hasText: 'QA Teacher 0' });
    await expect(teacherRow).toBeVisible();
    await expect(teacherRow).toContainText(fixture.grade);
    await expect(teacherRow).toContainText('General');
  });

  test('picking an attendance band on the track filters the list', async ({ page }) => {
    const teachersResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/teachers') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin/teachers');
    await teachersResponse;
    await expect(page.getByText('QA Teacher 0')).toBeVisible();

    // Bands are buttons named "<band>: <n> teachers". Choosing one narrows the list
    // and offers a way back.
    await page.getByRole('button', { name: /^(Below 75%|75 to 89%|90% and up|No data): \d+ teachers?$/ }).first().click();
    await expect(page.getByRole('button', { name: /Show all teachers/ })).toBeVisible();
    await page.getByRole('button', { name: /Show all teachers/ }).click();
    await expect(page.getByText('QA Teacher 0')).toBeVisible();
  });

  test('school admin can approve a pending teacher leave request through the real UI', async ({
    page,
    request,
  }) => {
    // The fixture (fixture-client.ts createQaFixture) does not create any leave
    // request, so there is nothing pending to approve on a fresh run. Create one
    // for real via the teacher's own account against the real backend endpoint
    // (POST /teacher/leaves — see Yugminds Backend/src/teacher/leaves/leaves.controller.ts),
    // exactly like an actual teacher would, then exercise the school-admin
    // approval UI against that real record.
    const teacher = fixture.teachers[0];
    const loginRes = await request.post(`${BACKEND_URL}/auth/login`, {
      data: { email: teacher.email, password: teacher.password },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginBody = await loginRes.json();
    const teacherToken = loginBody?.tokens?.accessToken as string | undefined;
    expect(teacherToken, 'teacher login should return an access token').toBeTruthy();

    const start = new Date();
    start.setDate(start.getDate() + 10);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const toDateStr = (d: Date) => d.toISOString().split('T')[0];

    const createLeaveRes = await request.post(`${BACKEND_URL}/teacher/leaves`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: {
        school_id: fixture.schoolId,
        start_date: toDateStr(start),
        end_date: toDateStr(end),
        reason: 'QA e2e leave request',
        substitute_required: false,
      },
    });
    expect(createLeaveRes.ok(), await createLeaveRes.text()).toBeTruthy();

    // Open the school-admin Teachers page on the leave requests tab.
    const leavesResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/leaves') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin/teachers?tab=leaves');
    await leavesResponse;

    // NOTE: teachers.service.ts / the SchoolAdminModule registers BOTH
    // SchoolAdminExtraController (school-admin/extra/school-admin-extra.controller.ts,
    // listed first in school-admin.module.ts's `controllers` array) and the
    // dedicated SchoolAdminLeavesController (school-admin/leaves/leaves.controller.ts)
    // on the identical `GET/PATCH school-admin/leaves(/:id)` routes. Nest/Express
    // resolves overlapping routes in registration order, so
    // SchoolAdminExtraController's handlers win and the dedicated
    // leaves.controller.ts is dead code. This test asserts against the observed
    // (Extra controller) behavior, not the unreachable one.
    await expect(page.getByText('QA Teacher 0').first()).toBeVisible();
    await expect(page.getByText('QA e2e leave request')).toBeVisible();

    const approveButton = page.getByRole('button', { name: /Approve/i }).first();
    await expect(approveButton).toBeVisible();

    const patchResponse = page.waitForResponse(
      (res) =>
        /\/school-admin\/leaves\/[^/]+$/.test(res.url()) && res.request().method() === 'PATCH',
    );
    await approveButton.click();
    const patchRes = await patchResponse;
    expect(patchRes.ok(), await patchRes.text()).toBeTruthy();

    // The request's own card should show the Approved chip after the page reloads its leaves.
    // (The "Approved" filter pill is always on screen, so check inside the request.)
    await expect(
      page.getByRole('article').filter({ hasText: 'QA e2e leave request' }).getByText('Approved', { exact: true }),
    ).toBeVisible({ timeout: 10000 });
  });
});
