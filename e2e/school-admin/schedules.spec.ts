import { test, expect } from './base';
import type { APIRequestContext } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';
import { BACKEND_URL } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);


async function loginTeacher(request: APIRequestContext, index: 0 | 1): Promise<string> {
  const res = await request.post(`${BACKEND_URL}/auth/login`, {
    data: { email: fixture.teachers[index].email, password: fixture.teachers[index].password },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  return body?.tokens?.accessToken as string;
}

// The fixture (createQaFixture) provisions no rooms, periods, or schedule
// slots — schedules/page.tsx shows a "Set up your timetable" onboarding
// wizard whenever both periods and rooms are empty (showWizard state, ~line
// 189: `periods.length === 0 && rooms.length === 0`), so every real-data
// assertion here starts from that wizard, not the grid view.
test.describe('School Admin — Schedules', () => {
  test('full flow: create a period, a room, a schedule slot for a fixture teacher, then push and confirm the teacher actually receives it', async ({
    page,
    request,
  }) => {
    await page.goto('/lms/school-admin/schedules');
    await expect(page.getByRole('heading', { name: 'Set up your timetable' })).toBeVisible({
      timeout: 15000,
    });

    // Step 1: Add a period via the real "Manage Periods" dialog.
    await page.getByRole('button', { name: 'Add Periods' }).click();
    const periodResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/periods') && res.request().method() === 'POST',
    );
    // period_number/start_time/end_time default to sensible values; fill start/end explicitly.
    await page.locator('input[type="time"]').first().fill('09:00');
    await page.locator('input[type="time"]').nth(1).fill('10:00');
    await page.getByRole('button', { name: '^Add Period$' }).click().catch(() =>
      page.getByRole('button', { name: 'Add Period', exact: true }).click(),
    );
    const periodRes = await periodResponse;
    expect(periodRes.ok(), await periodRes.text()).toBeTruthy();
    await page.getByRole('button', { name: 'Done' }).click();

    // Step 2: Add a room via the real "Manage Rooms" dialog.
    await page.getByRole('button', { name: 'Add Rooms' }).click();
    await page.locator('input[placeholder="R101"]').fill('QA-R101');
    const roomResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/rooms') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Add Room', exact: true }).click();
    const roomRes = await roomResponse;
    expect(roomRes.ok(), await roomRes.text()).toBeTruthy();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /Start Building Timetable/ }).click();
    await expect(page.getByRole('heading', { name: 'Set up your timetable' })).not.toBeVisible();

    // Step 3: Create a schedule slot for QA Teacher 0 (Grade 1) via the real "Add Schedule" dialog.
    await page.getByRole('button', { name: 'Add Schedule', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Add New Schedule' })).toBeVisible();

    await page.locator('#subject').fill('QA E2E Subject');

    // Grade select (placeholder "Grade").
    await page.getByText('Grade', { exact: true }).click();
    await page.getByRole('option', { name: fixture.grade, exact: true }).click();

    // Period select (placeholder "Select period").
    await page.getByText('Select period').click();
    await page.getByRole('option', { name: /Period 1/ }).click();

    // Teacher select — pick QA Teacher 0 explicitly (the fixture teacher whose
    // delivery we verify below), not the auto-suggested one.
    await page.getByText('Select teacher (optional)').click();
    await page.getByRole('option', { name: /QA Teacher 0/ }).click();

    const scheduleResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/schedules') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Create Schedule' }).click();
    const scheduleRes = await scheduleResponse;
    expect(scheduleRes.ok(), await scheduleRes.text()).toBeTruthy();

    // The dialog closes and the schedule now appears in the grid/list.
    await expect(page.getByText('QA E2E Subject').first()).toBeVisible({ timeout: 10000 });

    // Step 4 — THE cross-user check per the project plan: does QA Teacher 0
    // actually see this schedule slot on their own side? A ClassSchedule row
    // is scoped by teacherId at creation time (school-admin-extra.controller.ts),
    // so the teacher's own GET /teacher/schedules (teacher-extra.controller.ts:991)
    // should reflect it immediately, independent of the separate "push"
    // notification action exercised below.
    const teacher0Token = await loginTeacher(request, 0);
    const teacherSchedulesRes = await request.get(`${BACKEND_URL}/teacher/schedules`, {
      headers: { Authorization: `Bearer ${teacher0Token}` },
    });
    expect(teacherSchedulesRes.ok(), await teacherSchedulesRes.text()).toBeTruthy();
    const teacherSchedulesBody = await teacherSchedulesRes.json();
    const teacherSchedules = (teacherSchedulesBody?.schedules ?? teacherSchedulesBody ?? []) as Array<{
      subject?: string;
    }>;
    expect(
      teacherSchedules.some((s) => s.subject === 'QA E2E Subject'),
      'the newly-created schedule slot should be visible on the assigned teacher\'s own schedule endpoint',
    ).toBeTruthy();

    // Step 5: exercise "Push to Teachers" — this fires a real-time notification
    // to the teacher (school-admin-extra.controller.ts syncSchedulesToTeachers),
    // it does NOT itself create the schedule linkage (that already happened in
    // step 3) — confirm the endpoint call succeeds and the teacher receives a
    // notification about it.
    await page.getByRole('button', { name: 'Push to Teachers' }).click();
    await expect(page.getByRole('heading', { name: 'Push Schedule to Teachers' })).toBeVisible();

    const pushResponse = page.waitForResponse(
      (res) => res.url().endsWith('/school-admin/schedules/sync-to-teachers') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /^Push to \d+ Teachers?$/ }).click();
    const pushRes = await pushResponse;
    expect(pushRes.ok(), await pushRes.text()).toBeTruthy();
    await expect(page.getByText('Push Complete')).toBeVisible({ timeout: 10000 });

    const teacherNotifsRes = await request.get(`${BACKEND_URL}/teacher/notifications`, {
      headers: { Authorization: `Bearer ${teacher0Token}` },
    });
    expect(teacherNotifsRes.ok(), await teacherNotifsRes.text()).toBeTruthy();
    const teacherNotifsBody = await teacherNotifsRes.json();
    const teacherNotifs = (teacherNotifsBody?.notifications ?? []) as Array<{ message?: string; title?: string }>;
    expect(
      teacherNotifs.some((n) => `${n.title ?? ''} ${n.message ?? ''}`.toLowerCase().includes('schedule')),
      'pushing to teachers should create a real notification containing the word "schedule" in the teacher\'s own feed',
    ).toBeTruthy();
  });
});
