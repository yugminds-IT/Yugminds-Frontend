import { test, expect } from './base';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);

// Page: src/app/lms/teacher/student-progress/page.tsx wraps
// StudentProgressTab.tsx -> useTeacherStudentProgress -> GET
// /teacher/student-progress. Backend (teacher-extra.controller.ts
// getStudentProgress) scopes results to students whose section the teacher
// is assigned to (teacherSectionAssignment) — the fixture assigns teacher 0
// to Section A and all 3 fixture students are also in Section A, so all 3
// should be visible to this teacher.

test.describe('Teacher — Student Progress', () => {
  test('lists all 3 fixture students with a real, correctly-labeled zero-progress state', async ({ page }) => {
    const progressResponse = page.waitForResponse(
      (res) => res.url().includes('/teacher/student-progress') && res.request().method() === 'GET',
    );
    await page.goto('/lms/teacher/student-progress');
    const res = await progressResponse;
    expect(res.ok()).toBeTruthy();

    await expect(page.getByRole('heading', { level: 1, name: 'Student progress' })).toBeVisible();

    // The first number under the hero is the student count; the Students tab carries it too.
    const summary = page.getByRole('group', { name: 'Progress summary' });
    await expect(summary.locator('.sd-n').first()).toHaveText('3');
    await expect(page.getByRole('tab', { name: /Students\s*3/ })).toBeVisible();

    await expect(page.getByText('QA Student 0')).toBeVisible();
    await expect(page.getByText('QA Student 1')).toBeVisible();
    await expect(page.getByText('QA Student 2')).toBeVisible();

    await expect(page.getByText('No students in your sections yet')).not.toBeVisible();

    // Fixture course has no chapters authored, so every row's progress genuinely reads 0%.
    const row = page.getByRole('article').filter({ hasText: 'QA Student 0' });
    await expect(row.getByText('0%')).toBeVisible();
    await expect(row.getByText('not started')).toBeVisible();
  });

  test("sections tab shows the teacher's assigned section with its students", async ({ page }) => {
    await page.goto('/lms/teacher/student-progress');
    await page.waitForResponse(
      (res) => res.url().includes('/teacher/student-progress') && res.request().method() === 'GET',
    );

    await page.getByRole('tab', { name: /Sections/ }).click();
    const section = page.getByRole('article').filter({ hasText: fixture.section });
    await expect(section.getByText('3', { exact: true }).first()).toBeVisible();
  });
});
