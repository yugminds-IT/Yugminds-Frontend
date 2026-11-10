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

    // Step 1: Add a period in the real "Periods and breaks" dialog.
    await page.getByRole('button', { name: 'Add periods' }).click();
    const periodsDialog = page.getByRole('dialog', { name: /Periods and breaks/i });
    await expect(periodsDialog).toBeVisible();
    const periodResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/periods') && res.request().method() === 'POST',
    );
    // With no periods yet the number and start time are editable; fill start and end.
    await periodsDialog.locator('#pf-start').fill('09:00');
    await periodsDialog.locator('#pf-end').fill('10:00');
    await periodsDialog.getByRole('button', { name: 'Add period', exact: true }).click();
    const periodRes = await periodResponse;
    expect(periodRes.ok(), await periodRes.text()).toBeTruthy();
    await periodsDialog.getByRole('button', { name: 'Done' }).click();

    // Step 2: Add a room in the real "Rooms" dialog.
    await page.getByRole('button', { name: 'Add rooms' }).click();
    const roomsDialog = page.getByRole('dialog', { name: /Rooms/i });
    await roomsDialog.locator('#rf-num').fill('QA-R101');
    const roomResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/rooms') && res.request().method() === 'POST',
    );
    await roomsDialog.getByRole('button', { name: 'Add room', exact: true }).click();
    const roomRes = await roomResponse;
    expect(roomRes.ok(), await roomRes.text()).toBeTruthy();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /Start building the timetable/ }).click();
    await expect(page.getByRole('heading', { name: 'Set up your timetable' })).not.toBeVisible();

    // Step 3: Create a class for QA Teacher 0 (Grade 1) in the real "Add a class" dialog.
    await page.getByRole('button', { name: 'Add class', exact: true }).click();
    const classDialog = page.getByRole('dialog', { name: /Add a class/i });
    await expect(classDialog).toBeVisible();

    await classDialog.locator('#sc-subject').fill('QA E2E Subject');

    // Day defaults to Monday. Grade, section and period are pill buttons.
    await classDialog.getByRole('button', { name: fixture.grade, exact: true }).click();
    // Section is required when the grade has configured sections.
    await classDialog.getByRole('button', { name: fixture.section, exact: true }).click();
    await classDialog.getByRole('button', { name: /^P1/ }).click();

    // Teacher: pick QA Teacher 0 explicitly (the fixture teacher whose delivery
    // we verify below), not the suggested one. Options read "<name> · <load>".
    const teacherSelect = classDialog.locator('#sc-teacher');
    const teacherValue = await teacherSelect.locator('option', { hasText: 'QA Teacher 0' }).getAttribute('value');
    expect(teacherValue, 'QA Teacher 0 should be offered in the teacher list').toBeTruthy();
    await teacherSelect.selectOption(teacherValue!);

    const scheduleResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/schedules') && res.request().method() === 'POST',
    );
    await classDialog.getByRole('button', { name: 'Add class', exact: true }).click();
    const scheduleRes = await scheduleResponse;
    expect(scheduleRes.ok(), await scheduleRes.text()).toBeTruthy();

    // The dialog closes (it was the last period) and the class now shows in the week grid.
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
      section?: string | null;
    }>;
    expect(
      teacherSchedules.some((s) => s.subject === 'QA E2E Subject' && s.section === fixture.section),
      'the newly-created schedule slot should be visible on the assigned teacher\'s own schedule endpoint with section',
    ).toBeTruthy();

    // Step 5: exercise "Send to teachers" — this fires a real-time notification
    // to the teacher (school-admin-extra.controller.ts syncSchedulesToTeachers),
    // it does NOT itself create the schedule linkage (that already happened in
    // step 3) — confirm the endpoint call succeeds and the teacher receives a
    // notification about it.
    await page.getByRole('button', { name: 'Send to teachers' }).click();
    const pushDialog = page.getByRole('dialog', { name: /Send timetables to teachers/i });
    await expect(pushDialog).toBeVisible();

    const pushResponse = page.waitForResponse(
      (res) => res.url().endsWith('/school-admin/schedules/sync-to-teachers') && res.request().method() === 'POST',
    );
    await pushDialog.getByRole('button', { name: /^Send to \d+ teachers?$/ }).click();
    const pushRes = await pushResponse;
    expect(pushRes.ok(), await pushRes.text()).toBeTruthy();
    await expect(pushDialog.getByText(/Notifications successfully sent/i)).toBeVisible({ timeout: 10000 });

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

  test('custom template: period count + duration + lunch gap between teaching periods', async ({
    page,
  }) => {
    await page.goto('/lms/school-admin/schedules');

    // First-run setup button, or the Periods summary button once periods exist — both open the same dialog.
    const addPeriods = page.getByRole('button', { name: 'Add periods' });
    const periodsSummary = page.getByRole('button', { name: /^Periods \d/ });
    await expect(addPeriods.or(periodsSummary).first()).toBeVisible({ timeout: 15000 });
    if (await addPeriods.isVisible()) {
      await addPeriods.click();
    } else {
      await periodsSummary.click();
    }
    const dialog = page.getByRole('dialog', { name: /Periods and breaks/i });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Build my own', exact: true }).click();
    const customPanel = dialog.getByRole('region', { name: 'Build your own day' });
    await expect(customPanel).toBeVisible();

    // 4 periods × 40 min from 08:30, lunch after period 2.
    await customPanel.locator('#pc-start').fill('08:30');
    await customPanel.locator('#pc-count').fill('4');
    await customPanel.locator('#pc-dur').fill('40');

    await customPanel.getByRole('button', { name: 'Lunch', exact: true }).click();
    await expect(customPanel.getByText('Lunch · 30 min')).toBeVisible();

    let periodPostCount = 0;
    const onResponse = (res: { url: () => string; request: () => { method: () => string } }) => {
      if (res.url().includes('/school-admin/periods') && res.request().method() === 'POST') {
        periodPostCount += 1;
      }
    };
    page.on('response', onResponse);

    await customPanel.getByRole('button', { name: 'Use this day' }).click();
    await page.getByRole('button', { name: 'Apply', exact: true }).click();

    await expect(page.getByText(/Created 4 periods/i)).toBeVisible({ timeout: 15000 });
    page.off('response', onResponse);
    expect(periodPostCount).toBe(4);

    // Four teaching periods; the 30-minute lunch gap after P2 shows between rows.
    await expect(dialog.locator('.ts-gap').getByText('Lunch · 30 min')).toBeVisible();
    for (const n of [1, 2, 3, 4]) {
      await expect(dialog.locator('.ts-pnum', { hasText: String(n) })).toBeVisible();
    }

    // P1 starts 8:30 AM; after P2 lunch, P3 starts 10:20 AM.
    await expect(dialog.getByText('8:30 AM').first()).toBeVisible();
    await expect(dialog.getByText('10:20 AM').first()).toBeVisible();
  });
});
