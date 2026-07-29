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

/**
 * The fixture (createQaFixture) provisions no periods/schedules, and
 * attendance.spec.ts's own page (attendance/page.tsx) documents that
 * attendance is only ever auto-marked by submitting a report for every
 * scheduled period on a given day — there's no manual "mark attendance"
 * control in the teacher UI. So "marking attendance" here means: create a
 * real period + a schedule slot for TODAY assigned to the fixture teacher,
 * then submit a real teaching report against it, and confirm the attendance
 * page reflects that as a genuine "Present" day, not a stubbed one.
 */
async function seedTodaysScheduleAndReport(request: APIRequestContext): Promise<void> {
  const adminToken = await login(request, fixture.schoolAdmin.email, fixture.schoolAdmin.password);
  const periodRes = await request.post(`${BACKEND_URL}/school-admin/periods`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { period_number: 1, start_time: '09:00', end_time: '10:00' },
  });
  expect(periodRes.ok(), await periodRes.text()).toBeTruthy();
  const periodBody = await periodRes.json();
  const periodId = periodBody?.period?.id as string;
  expect(periodId).toBeTruthy();

  const scheduleRes = await request.post(`${BACKEND_URL}/school-admin/schedules`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      teacher_id: fixture.teachers[0].id,
      subject: 'QA E2E Attendance Subject',
      grade: fixture.grade,
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
      grade: fixture.grade,
      date: today,
      period_id: periodId,
      start_time: '09:00',
      end_time: '10:00',
      topics_taught: 'QA e2e attendance topic',
    },
  });
  expect(reportRes.ok(), await reportRes.text()).toBeTruthy();
}

test.describe('Teacher — Attendance', () => {
  test('submitting a report for every scheduled period today marks attendance as Present', async ({
    page,
    request,
  }) => {
    await seedTodaysScheduleAndReport(request);

    const todayResponse = page.waitForResponse(
      (res) => res.url().includes('/teacher/attendance/today') && res.request().method() === 'GET',
    );
    await page.goto('/lms/teacher/attendance');
    const todayRes = await todayResponse;
    expect(todayRes.ok()).toBeTruthy();

    await expect(page.getByRole('heading', { name: "Today's Attendance Status" })).toBeVisible();
    await expect(page.getByText('All period reports submitted!')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Present', { exact: true })).toBeVisible();
  });

  test('monthly attendance log reflects the present day for the current month', async ({ page }) => {
    const monthlyResponse = page.waitForResponse(
      (res) => res.url().includes('/teacher/attendance/monthly') && res.request().method() === 'GET',
    );
    await page.goto('/lms/teacher/attendance');
    await monthlyResponse;

    // Current-month stat card: at least 1 day present from the report seeded above.
    const presentCard = page.getByText('Present', { exact: true }).locator('..').locator('..');
    await expect(presentCard.getByText(/^[1-9]\d*$/)).toBeVisible({ timeout: 10000 });

    const now = new Date();
    const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    await expect(page.getByRole('cell', { name: monthLabel })).toBeVisible({ timeout: 10000 });
  });
});
