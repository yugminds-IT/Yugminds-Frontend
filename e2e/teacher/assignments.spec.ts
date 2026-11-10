import { test, expect } from './base';
import type { APIRequestContext } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';
import { BACKEND_URL } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);

async function login(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${BACKEND_URL}/auth/login`, { data: { email, password } });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  const token = body?.tokens?.accessToken as string | undefined;
  expect(token, 'login should return an access token').toBeTruthy();
  return token as string;
}

test.describe('Teacher — Assignments', () => {
  test('create a DAILY assignment through the three-step form, grade a real student submission, and confirm the grade reaches the student', async ({
    page,
    request,
  }) => {
    const uniqueTitle = `QA E2E Assignment ${Date.now()}`;

    const listResponse = page.waitForResponse(
      (res) => res.url().includes('/teacher/assignments?') && res.request().method() === 'GET',
    );
    await page.goto('/lms/teacher/assignments');
    await listResponse;

    // Open the three-step form from the hero. The active school is already chosen, so the title and subject are enough.
    await page.getByRole('button', { name: 'New assignment' }).first().click();
    const drawer = page.getByRole('dialog', { name: 'New assignment' });
    await expect(drawer).toBeVisible();
    await drawer.locator('#as-title').fill(uniqueTitle);
    await drawer.locator('#as-subject').fill('QA E2E Subject');
    await drawer.getByRole('button', { name: 'Next', exact: true }).click();
    // Audience: "Entire school" is on by default.
    await drawer.getByRole('button', { name: 'Next', exact: true }).click();

    const createResponse = page.waitForResponse(
      (res) => res.url().endsWith('/teacher/assignments') && res.request().method() === 'POST',
    );
    await drawer.getByRole('button', { name: 'Create assignment' }).click();
    const createRes = await createResponse;
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const createBody = await createRes.json();
    const assignmentId = createBody?.assignment?.id as string;
    expect(assignmentId).toBeTruthy();

    const listItem = page.getByRole('button', { name: new RegExp(uniqueTitle) });
    await expect(listItem).toBeVisible({ timeout: 10000 });

    // A real student submits it (raw API — the student UI submission flow is
    // covered by the student-side suite; this spec is about the teacher's
    // grading path).
    const studentToken = await login(request, fixture.students[0].email, fixture.students[0].password);
    const submitRes = await request.post(`${BACKEND_URL}/student/assignments/${assignmentId}/submit`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: {},
    });
    expect(submitRes.ok(), await submitRes.text()).toBeTruthy();

    const submissionsResponse = page.waitForResponse(
      (res) => res.url().includes(`/teacher/assignments/${assignmentId}/submissions`) && res.request().method() === 'GET',
    );
    await listItem.click();
    await submissionsResponse;

    const studentRow = page.locator('.tg-item-wrap').filter({ hasText: 'QA Student 0' });
    await expect(studentRow).toBeVisible({ timeout: 10000 });
    await expect(studentRow.getByText('To grade')).toBeVisible();
    await studentRow.getByRole('button', { name: /Show attempts for QA Student 0/ }).click();

    await studentRow.getByLabel('Score for attempt 1').fill('8');
    await studentRow.getByLabel('Feedback for attempt 1').fill('QA e2e feedback');

    const gradeResponse = page.waitForResponse(
      (res) =>
        res.url().includes(`/teacher/assignments/${assignmentId}/submissions/`) &&
        res.url().endsWith('/grade') &&
        res.request().method() === 'PATCH',
    );
    await studentRow.getByRole('button', { name: 'Grade', exact: true }).click();
    const gradeRes = await gradeResponse;
    expect(gradeRes.ok(), await gradeRes.text()).toBeTruthy();

    await expect(studentRow.getByText('Graded').first()).toBeVisible({ timeout: 10000 });

    // Cross-user check: the grade must actually reach the student's own view.
    const studentAssignmentRes = await request.get(`${BACKEND_URL}/student/assignments/${assignmentId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(studentAssignmentRes.ok(), await studentAssignmentRes.text()).toBeTruthy();
    const studentAssignmentBody = await studentAssignmentRes.json();
    const submission = studentAssignmentBody?.submission as { status?: string; score?: number } | null;
    expect(submission?.status, 'student\'s own submission should read as graded').toBe('graded');
    expect(submission?.score, 'student\'s own submission should reflect the score the teacher entered').toBe(8);
  });
});
