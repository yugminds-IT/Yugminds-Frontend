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

/**
 * Seeds one real, submittable teacher report. The fixture (createQaFixture)
 * creates no periods and no reports, and POST /teacher/reports hard-requires a
 * real period_id (teacher/reports/reports.service.ts:70 `if (!body.period_id)
 * throw new BadRequestException(...)`), so a period must be created first via
 * the school-admin API, then the teacher submits a report against it.
 */
async function seedReport(request: APIRequestContext): Promise<string> {
  const adminToken = await login(request, fixture.schoolAdmin.email, fixture.schoolAdmin.password);
  const periodRes = await request.post(`${BACKEND_URL}/school-admin/periods`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { period_number: 1, start_time: '09:00', end_time: '10:00' },
  });
  expect(periodRes.ok(), await periodRes.text()).toBeTruthy();
  const periodBody = await periodRes.json();
  const periodId = periodBody?.period?.id as string;
  expect(periodId).toBeTruthy();

  const teacherToken = await login(request, fixture.teachers[0].email, fixture.teachers[0].password);
  const today = new Date().toISOString().split('T')[0];
  const reportRes = await request.post(`${BACKEND_URL}/teacher/reports`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
    data: {
      school_id: fixture.schoolId,
      grade: fixture.grade,
      date: today,
      period_id: periodId,
      start_time: '09:00',
      end_time: '10:00',
      topics_taught: 'QA e2e report topic',
      student_count: 3,
    },
  });
  expect(reportRes.ok(), await reportRes.text()).toBeTruthy();
  return periodId;
}

test.describe('School Admin — Reports', () => {
  test('empty state renders correctly when no reports exist yet', async ({ page }) => {
    // Runs before any report is seeded in this file (test order within a
    // describe block is declaration order under the default serial config).
    const reportsResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/reports') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin/reports');
    const res = await reportsResponse;
    expect(res.ok()).toBeTruthy();

    await expect(page.getByText('No reports found')).toBeVisible();
    const totalCard = page.locator('text=Total Reports').locator('..').locator('..');
    await expect(totalCard.getByText('0', { exact: true })).toBeVisible();
  });

  test('a real submitted report shows as Pending and can be approved through the UI', async ({
    page,
    request,
  }) => {
    await seedReport(request);

    const reportsResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/reports') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin/reports');
    await reportsResponse;

    const reportRow = page.getByRole('row', { name: /QA e2e report topic/ });
    await expect(reportRow).toBeVisible();
    await expect(reportRow.getByText('Pending')).toBeVisible();

    const approveResponse = page.waitForResponse(
      (res) =>
        /\/school-admin\/reports\/[^/]+$/.test(res.url()) && res.request().method() === 'PATCH',
    );
    await reportRow.getByRole('button', { name: /Approve/i }).click();
    const approveRes = await approveResponse;
    expect(approveRes.ok(), await approveRes.text()).toBeTruthy();

    await expect(page.getByRole('row', { name: /QA e2e report topic/ }).getByText('Approved')).toBeVisible({
      timeout: 10000,
    });
  });

  test('bulk-approve regression guard: PATCH /school-admin/reports/bulk is not shadowed by /reports/:id route ordering', async ({
    page,
    request,
  }) => {
    // Seed a second, still-pending report so there's something real to bulk-select.
    await seedReport(request);

    const reportsResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/reports') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin/reports');
    await reportsResponse;

    // Select-all toggles every currently-Pending row (handleSelectAll in reports/page.tsx).
    const selectAllButton = page.locator('thead button').first();
    await selectAllButton.click();

    await page.getByRole('button', { name: /Bulk Approve/i }).click();
    const bulkDialog = page.getByRole('dialog', { name: /Bulk Approve Reports/i });
    await expect(bulkDialog).toBeVisible();

    const bulkResponse = page.waitForResponse(
      (res) => res.url().endsWith('/school-admin/reports/bulk') && res.request().method() === 'PATCH',
    );
    await bulkDialog.getByRole('button', { name: /^Approve All$/ }).click();
    const bulkRes = await bulkResponse;
    // A regression where /reports/bulk got shadowed by /reports/:id would surface
    // here as a 400/404 (":id" being the literal string "bulk", not a UUID) —
    // this assertion is the actual regression guard the project plan asked for.
    expect(bulkRes.ok(), await bulkRes.text()).toBeTruthy();

    await expect(page.getByText(/Successfully approved/i)).toBeVisible({ timeout: 10000 });
  });
});
