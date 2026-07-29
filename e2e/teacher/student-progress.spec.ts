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

    await expect(page.getByRole('heading', { name: 'Student Progress' })).toBeVisible();

    await expect(page.getByText('Total Students')).toBeVisible();
    const totalStudentsCard = page.getByText('Total Students').locator('..');
    await expect(totalStudentsCard.getByText('3', { exact: true })).toBeVisible();

    // Toolbar's live row count reflects exactly the 3 fixture students.
    await expect(page.getByText('3 students', { exact: true })).toBeVisible();

    await expect(page.getByText('QA Student 0')).toBeVisible();
    await expect(page.getByText('QA Student 1')).toBeVisible();
    await expect(page.getByText('QA Student 2')).toBeVisible();

    await expect(page.getByText('No students enrolled yet')).not.toBeVisible();

    // Fixture course has no chapters authored, so every row's progress genuinely reads 0%.
    const rows = page.locator('table').first().locator('tbody tr');
    await expect(rows.filter({ hasText: 'QA Student 0' }).getByText('0%')).toBeVisible();
    await expect(rows.filter({ hasText: 'QA Student 0' }).getByText('Not Started')).toBeVisible();
  });

  test('section filter narrows results to the teacher\'s assigned section', async ({ page }) => {
    await page.goto('/lms/teacher/student-progress');
    await page.waitForResponse(
      (res) => res.url().includes('/teacher/student-progress') && res.request().method() === 'GET',
    );

    await page.getByText('All Sections', { exact: true }).click();
    await page.getByRole('option', { name: fixture.section, exact: true }).click();

    await expect(page.getByText('3 students', { exact: true })).toBeVisible();
  });
});
