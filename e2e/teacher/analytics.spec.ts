import { test, expect } from './base';
import type { APIRequestContext } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';
import { BACKEND_URL } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const todayDayName = DAY_NAMES[new Date().getDay()];

async function login(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${BACKEND_URL}/auth/login`, { data: { email, password } });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  const token = body?.tokens?.accessToken as string | undefined;
  expect(token, 'login should return an access token').toBeTruthy();
  return token as string;
}

// Self-contained seeding (own period/schedule/grade + own leave request) so
// this spec's assertions don't depend on execution order relative to the
// other spec files that also submit reports/leaves for the fixture teacher.
async function seedReportAndLeave(request: APIRequestContext): Promise<void> {
  const adminToken = await login(request, fixture.schoolAdmin.email, fixture.schoolAdmin.password);
  const periodRes = await request.post(`${BACKEND_URL}/school-admin/periods`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { period_number: 3, start_time: '11:00', end_time: '12:00' },
  });
  expect(periodRes.ok(), await periodRes.text()).toBeTruthy();
  const periodBody = await periodRes.json();
  const periodId = periodBody?.period?.id as string;
  expect(periodId).toBeTruthy();

  const analyticsGrade = `${fixture.grade} A3`;
  const scheduleRes = await request.post(`${BACKEND_URL}/school-admin/schedules`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      teacher_id: fixture.teachers[0].id,
      subject: 'QA E2E Analytics Subject',
      grade: analyticsGrade,
      day_of_week: todayDayName,
      period_id: periodId,
    },
  });
  expect(scheduleRes.ok(), await scheduleRes.text()).toBeTruthy();

  const teacherToken = await login(request, fixture.teachers[0].email, fixture.teachers[0].password);
  const today = new Date().toISOString().split('T')[0];
  const reportRes = await request.post(`${BACKEND_URL}/teacher/reports`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
    data: {
      school_id: fixture.schoolId,
      grade: analyticsGrade,
      date: today,
      period_id: periodId,
      start_time: '11:00',
      end_time: '12:00',
      topics_taught: 'QA e2e analytics topic',
    },
  });
  expect(reportRes.ok(), await reportRes.text()).toBeTruthy();

  const leaveRes = await request.post(`${BACKEND_URL}/teacher/leaves`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
    data: {
      school_id: fixture.schoolId,
      start_date: today,
      end_date: today,
      reason: 'QA e2e analytics leave',
    },
  });
  expect(leaveRes.ok(), await leaveRes.text()).toBeTruthy();
}

test.describe('Teacher — Analytics', () => {
  test('renders real, non-zero report and leave data from the fixture teacher', async ({ page, request }) => {
    await seedReportAndLeave(request);

    const reportsResponse = page.waitForResponse(
      (res) => res.url().includes('/teacher/reports') && res.request().method() === 'GET',
    );
    await page.goto('/lms/teacher/analytics');
    await reportsResponse;

    await expect(page.getByRole('heading', { name: 'Analytics Dashboard' })).toBeVisible();

    const totalReportsCard = page.getByText('Total Reports').locator('..').locator('..');
    const totalReportsText = await totalReportsCard.locator('.text-2xl').first().innerText();
    expect(Number(totalReportsText), 'Total Reports should reflect the real report just seeded, not 0').toBeGreaterThan(0);

    // A real report/leave was just submitted — the charts' empty states must not show.
    await expect(page.getByText('No reports submitted yet')).not.toBeVisible();
    await expect(page.getByText('No leave requests submitted yet')).not.toBeVisible();
  });
});
