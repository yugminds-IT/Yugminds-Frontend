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
  test('create a DAILY assignment via the real modal, grade a real student submission, and confirm the grade reaches the student', async ({
    page,
    request,
  }) => {
    const uniqueTitle = `QA E2E Assignment ${Date.now()}`;

    const listResponse = page.waitForResponse(
      (res) => res.url().includes('/teacher/assignments?') && res.request().method() === 'GET',
    );
    await page.goto('/lms/teacher/assignments');
    await listResponse;

    await page.getByRole('button', { name: 'New Assignment' }).first().click();
    await expect(page.getByRole('heading', { name: 'New Daily Assignment' })).toBeVisible();

    await page.locator('input[placeholder="e.g. Mathematics, Science…"]').fill('QA E2E Subject');

    await page.getByText('Select school', { exact: true }).click();
    await page.getByRole('option', { name: new RegExp(fixture.runId) }).click();

    // The builder's own "Create Assignment" button (enabled) is distinct from
    // the modal's footer submit button of the same name (disabled until a
    // title exists) — target the enabled one.
    await page.locator('button:not([disabled])', { hasText: /^Create Assignment$/ }).click();
    const assignmentDialog = page.getByRole('dialog', { name: 'Create Assignment' });
    await expect(assignmentDialog).toBeVisible();
    await assignmentDialog.locator('#assignment-title').fill(uniqueTitle);
    await assignmentDialog.getByRole('button', { name: 'Create Assignment' }).click();
    await expect(assignmentDialog).not.toBeVisible();

    const createResponse = page.waitForResponse(
      (res) => res.url().endsWith('/teacher/assignments') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Create Assignment' }).click();
    const createRes = await createResponse;
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const createBody = await createRes.json();
    const assignmentId = createBody?.assignment?.id as string;
    expect(assignmentId).toBeTruthy();

    await expect(page.locator('button', { hasText: uniqueTitle })).toBeVisible({ timeout: 10000 });

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
    await page.locator('button', { hasText: uniqueTitle }).click();
    await submissionsResponse;

    const studentRow = page.getByRole('row', { name: /QA Student 0/ });
    await expect(studentRow).toBeVisible({ timeout: 10000 });
    await expect(studentRow.getByText('Pending')).toBeVisible();
    await studentRow.click();

    await page.getByPlaceholder('Score').fill('8');
    await page.getByPlaceholder('Feedback').fill('QA e2e feedback');

    const gradeResponse = page.waitForResponse(
      (res) =>
        res.url().includes(`/teacher/assignments/${assignmentId}/submissions/`) &&
        res.url().endsWith('/grade') &&
        res.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Grade' }).click();
    const gradeRes = await gradeResponse;
    expect(gradeRes.ok(), await gradeRes.text()).toBeTruthy();

    await expect(studentRow.getByText('Graded')).toBeVisible({ timeout: 10000 });

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
