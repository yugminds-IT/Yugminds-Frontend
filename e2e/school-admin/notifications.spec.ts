import { test, expect } from './base';
import type { APIRequestContext } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';
import { BACKEND_URL } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);


async function loginTeacher(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${BACKEND_URL}/auth/login`, {
    data: { email: fixture.teachers[0].email, password: fixture.teachers[0].password },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  const token = body?.tokens?.accessToken as string | undefined;
  expect(token).toBeTruthy();
  return token as string;
}

test.describe('School Admin — Notifications', () => {
  test('compose a notification addressed to teachers, confirm it appears in Sent, and actually reaches the recipient', async ({
    page,
    request,
  }) => {
    const uniqueTitle = `QA E2E Notification ${Date.now()}`;
    const uniqueMessage = 'This is a QA e2e notification body.';

    const recipientsResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/notifications/recipients'),
    );
    await page.goto('/lms/school-admin/notifications');
    await recipientsResponse;

    // Compose tab is "Send Notification"; default recipientType is 'role', which
    // per notifications/page.tsx offers role-level checkboxes (Teachers/Students).
    await page.getByRole('tab', { name: 'Send Notification' }).click();
    await page.locator('#title').fill(uniqueTitle);
    await page.locator('#message').fill(uniqueMessage);

    // Select the "Teachers" role checkbox so the fixture teacher receives it.
    const teacherRoleCheckbox = page
      .locator('label', { hasText: /Teacher/i })
      .locator('input[type="checkbox"]')
      .first();
    await teacherRoleCheckbox.check();

    const createResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/notifications') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /^Send Notification$/ }).click();
    const createRes = await createResponse;
    expect(createRes.ok(), await createRes.text()).toBeTruthy();

    // handleSendNotification switches to the "view" tab automatically and the
    // page defaults notificationMode to 'received' — switch to 'sent' to see
    // what this school-admin composed (per the mode select in page.tsx).
    await expect(page.getByRole('tab', { name: 'View Sent' })).toHaveAttribute('data-state', 'active');
    await page.getByText('Received by Me').click();
    const sentResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/notifications') && res.request().method() === 'GET',
    );
    await page.getByRole('option', { name: 'Sent (Grouped)' }).click();
    await sentResponse;

    await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 10000 });

    // Cross-user delivery check: log in as the fixture teacher directly and
    // confirm the notification actually reached their own notifications feed
    // (GET /teacher/notifications — teacher-extra.controller.ts:206), not just
    // that the school-admin's own "sent" view shows it.
    const teacherToken = await loginTeacher(request);
    const teacherNotifsRes = await request.get(`${BACKEND_URL}/teacher/notifications`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(teacherNotifsRes.ok(), await teacherNotifsRes.text()).toBeTruthy();
    const teacherNotifsBody = await teacherNotifsRes.json();
    const teacherNotifs = (teacherNotifsBody?.notifications ?? []) as Array<{
      title: string;
      message: string;
    }>;
    const delivered = teacherNotifs.some(
      (n) => n.title === uniqueTitle && n.message === uniqueMessage,
    );
    expect(
      delivered,
      `expected teacher's own /teacher/notifications feed to contain "${uniqueTitle}" — if this fails, the notification never reached its intended recipient despite the school-admin UI reporting success`,
    ).toBeTruthy();
  });
});
