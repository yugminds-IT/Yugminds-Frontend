import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';
import { BACKEND_URL } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);

test.use({ storageState: path.resolve(__dirname, '.auth/school-admin.json') });

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

  test('teacher grade/subject data exists in the API payload but is not surfaced in the table UI (BUG)', async ({
    page,
  }) => {
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
    // Backend does return Grade 1 / General subject via teacherSectionAssignments — confirming
    // the fixture's assignment made it into the API contract.
    expect(teacher0!.teacher_schools?.[0]?.grades_assigned).toContain(fixture.grade);
    expect(teacher0!.teacher_schools?.[0]?.subjects).toContain('General');
    // NOTE: the backend only derives `grades_assigned` (grade name) from
    // teacherSectionAssignments — it never returns the assigned *section* name
    // (see school-admin-extra.controller.ts listTeachers(), ~line 561: only
    // `a.section?.grade?.name` is read, `a.section?.name` is discarded). So even
    // at the API layer, "teacher 0 is Section A vs teacher 1 is Section B" is
    // unverifiable from this endpoint's response.

    // BUG: The Teachers Management table never renders grade/section/subject at
    // all, despite the backend supplying `teacher_schools[].grades_assigned` and
    // `.subjects` in this same response. Frontend root cause:
    //   - src/app/lms/school-admin/teachers/page.tsx mapTeacherToTableRow()
    //     (~line 48-69) drops `teacher.teacher_schools` entirely — it only maps
    //     name/email/qualification/specialization/leaves/status onto the row.
    //   - src/components/ui/management-table-presets.tsx
    //     SCHOOL_ADMIN_TEACHER_COLUMNS (~line 775) has no grade/section/subject
    //     column to render one even if the row carried the data.
    // Net effect: a school admin cannot tell which grade/section/subject a
    // teacher is assigned to from this page at all. Asserting the *absence* of
    // that text in the teacher's row to document the gap precisely (not just
    // asserting on the API body).
    const teacherRow = page.getByRole('row', { name: /QA Teacher 0/ });
    await expect(teacherRow).toBeVisible();
    await expect(teacherRow.getByText(fixture.grade, { exact: false })).toHaveCount(0);
    await expect(teacherRow.getByText('General', { exact: false })).toHaveCount(0);
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

    // Reload the school-admin teachers page and switch to the Leaves tab.
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
    const leaveRow = page.locator('div', { hasText: 'QA e2e leave request' }).last();
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

    // Status badge should flip to Approved for this leave after the reload the
    // component itself triggers (loadTeachers() re-fetch inside handleLeaveRequest).
    await expect(page.getByText('Approved').first()).toBeVisible({ timeout: 10000 });
  });
});
