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

// A grade distinct from `fixture.grade` — reports/page.tsx's availablePeriods
// filter groups by grade ALONE (not period+grade): once any report exists
// for a grade today, every period sharing that grade is moved out of the
// selectable list, even a different period. attendance.spec.ts already
// submits a report for `fixture.grade` today, so this spec uses its own
// grade string for the schedule slot to avoid colliding with that (the
// createSchedule endpoint doesn't require the grade to match the school's
// configured grades_offered).
const reportGrade = `${fixture.grade} R2`;

async function login(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${BACKEND_URL}/auth/login`, { data: { email, password } });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  const token = body?.tokens?.accessToken as string | undefined;
  expect(token, 'login should return an access token').toBeTruthy();
  return token as string;
}

/**
 * The teacher reports page's Period select is populated from
 * useTeacherPeriods(schoolId, todayDayName), which only returns periods that
 * have a real schedule slot for the teacher on today's day of week — the
 * fixture provisions none, so a real period + schedule for TODAY must be
 * seeded first (mirrors school-admin's own reports.spec.ts seedReport, but
 * here the report is actually submitted through the real UI form, not raw
 * API, since that's the page under test).
 */
async function seedTodaysPeriod(request: APIRequestContext): Promise<void> {
  const adminToken = await login(request, fixture.schoolAdmin.email, fixture.schoolAdmin.password);
  const periodRes = await request.post(`${BACKEND_URL}/school-admin/periods`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { period_number: 2, start_time: '10:00', end_time: '11:00' },
  });
  expect(periodRes.ok(), await periodRes.text()).toBeTruthy();
  const periodBody = await periodRes.json();
  const periodId = periodBody?.period?.id as string;
  expect(periodId).toBeTruthy();

  const scheduleRes = await request.post(`${BACKEND_URL}/school-admin/schedules`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      teacher_id: fixture.teachers[0].id,
      subject: 'QA E2E Report Subject',
      grade: reportGrade,
      day_of_week: todayDayName,
      period_id: periodId,
    },
  });
  expect(scheduleRes.ok(), await scheduleRes.text()).toBeTruthy();
}

test.describe('Teacher — Reports', () => {
  test('submitting a daily teaching report through the real form shows it in Recent Reports', async ({
    page,
    request,
  }) => {
    await seedTodaysPeriod(request);

    await page.goto('/lms/teacher/reports');
    await expect(page.getByRole('heading', { name: 'Submit Daily Report' })).toBeVisible();

    const uniqueTopic = `QA e2e teaching topic ${Date.now()}`;

    // Select the period — its label embeds the grade in brackets, e.g. "... [Grade 1 R2]".
    await page.locator('#period_id').click();
    await page.getByRole('option', { name: new RegExp(`\\[${reportGrade}\\]`) }).click();

    await page.locator('#topics_taught').fill(uniqueTopic);

    const submitResponse = page.waitForResponse(
      (res) => res.url().endsWith('/teacher/reports') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Submit Report' }).click();
    const submitRes = await submitResponse;
    expect(submitRes.ok(), await submitRes.text()).toBeTruthy();

    await expect(page.getByText(uniqueTopic)).toBeVisible({ timeout: 10000 });
  });
});
