import { test, expect } from './base';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);


// The fixture course (createQaFixture -> POST /admin/courses) is created without
// `status`/`is_published`, so courses.service.ts defaults it to Draft (see
// courses.service.ts:213 `status: isPublished ? 'Published' : 'Draft'`). It also
// has no chapters/content, so `num_chapters` is 0 and no students have progress.
const courseName = `__qa_test_${fixture.runId}__ Course`;

test.describe('School Admin — Courses', () => {
  test('renders the real fixture course as Draft with the correct grade', async ({ page }) => {
    const coursesResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/courses') && res.request().method() === 'GET' && !res.url().includes('progress'),
    );
    await page.goto('/lms/school-admin/courses');
    const res = await coursesResponse;
    expect(res.ok()).toBeTruthy();

    const courseRow = page.getByRole('row', { name: new RegExp(courseName) });
    await expect(courseRow).toBeVisible();
    // BUG: this course was created with `grades: ["Grade 1"]` (POST
    // /admin/courses), but the school-admin Courses list shows "N/A" for its
    // grade instead of "Grade 1". Root cause: GET /school-admin/courses
    // (school-admin-extra.controller.ts listCourses(), ~lines 1509-1560)
    // never reads the course's own configured grade(s) — it *derives*
    // `grades` purely from which grades currently-ENROLLED students belong to
    // (via StudentCourse + StudentSchool.grade). A freshly created course
    // with zero enrollments — exactly this fixture's course — will always
    // show "N/A" regardless of what grades it was actually assigned at
    // creation. Keeping this assertion failing/documented rather than
    // weakening it to match the buggy "N/A" output.
    await expect(courseRow.getByText('Grade 1')).toBeVisible();
    await expect(courseRow.getByText('Draft', { exact: true })).toBeVisible();
  });

  test('status filter correctly excludes the Draft fixture course from "Published"', async ({
    page,
  }) => {
    await page.goto('/lms/school-admin/courses');
    await page.waitForResponse(
      (res) => res.url().includes('/school-admin/courses') && res.request().method() === 'GET' && !res.url().includes('progress'),
    );

    // NOTE: page.tsx has `<Label htmlFor="status">`/`<Label htmlFor="grade">`
    // but the corresponding <SelectTrigger> never receives a matching `id`
    // prop (same htmlFor/id-mismatch pattern already found and fixed on the
    // students page's grade/section selects) — so neither #status nor a
    // getByLabel() query can reach these controls. Selecting by DOM order
    // instead (Status combobox renders before Grade combobox).
    const statusCombobox = page.getByRole('combobox').first();
    await statusCombobox.click();
    await page.getByRole('option', { name: 'Published', exact: true }).click();
    await expect(page.getByText(courseName)).not.toBeVisible();

    await statusCombobox.click();
    await page.getByRole('option', { name: 'Draft', exact: true }).click();
    await expect(page.getByText(courseName)).toBeVisible();
  });

  test('stats cards reflect the real fixture course counts', async ({ page }) => {
    await page.goto('/lms/school-admin/courses');
    await page.waitForResponse(
      (res) => res.url().includes('/school-admin/courses') && res.request().method() === 'GET' && !res.url().includes('progress'),
    );

    const totalCoursesCard = page.locator('text=Total Courses').locator('..').locator('..');
    await expect(totalCoursesCard.getByText('1', { exact: true })).toBeVisible();

    const publishedCard = page.locator('text=Published').locator('..').locator('..');
    await expect(publishedCard.getByText('0', { exact: true })).toBeVisible();
  });
});
