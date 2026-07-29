import { test, expect } from './base';
import type { APIRequestContext, APIResponse } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';
import { BACKEND_URL } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);

async function jsonOrThrow(res: APIResponse, label: string) {
  const text = await res.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : {}; } catch { body = text; }
  if (!res.ok()) throw new Error(`${label} failed: ${JSON.stringify(body)}`);
  return body as Record<string, unknown>;
}

async function loginStudent(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${BACKEND_URL}/auth/login`, { data: { email, password } });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  const token = body?.tokens?.accessToken as string | undefined;
  expect(token).toBeTruthy();
  return token as string;
}

/**
 * Creates a second, unrelated QA school with its own student so the
 * cross-school delivery-scoping check has a genuine negative case: the
 * teacher's "role:student" broadcast is scoped server-side to the school_id
 * in the request (teacher-extra.controller.ts createNotification), so a
 * student in a completely different school must never receive it.
 */
async function createOutsideStudent(request: APIRequestContext): Promise<{
  schoolId: string;
  email: string;
  password: string;
}> {
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${fixture.admin.token}`,
  };
  const prefix = `__qa_test_${fixture.runId}_outside__`;
  const schoolRes = await request.post(`${BACKEND_URL}/admin/schools`, {
    headers: authHeaders,
    data: {
      name: `${prefix} School`,
      grades_offered: [fixture.grade],
      number_of_sections: 1,
      school_admin_email: `${prefix}_admin@example.test`,
      school_admin_temp_password: 'QaTest123!',
      school_admin_name: 'QA Outside Admin',
    },
  });
  const schoolBody = await jsonOrThrow(schoolRes, 'create outside school');
  const data = schoolBody.data as Record<string, unknown> | undefined;
  const school = (data?.school ?? data) as { id?: string };
  const schoolId = String(school.id);

  const email = `${prefix}_student@example.test`;
  const password = 'QaTest123!';
  const studentRes = await request.post(`${BACKEND_URL}/admin/students`, {
    headers: authHeaders,
    data: {
      email,
      password,
      full_name: 'QA Outside Student',
      school_id: schoolId,
      grade: fixture.grade,
      section: 'Section A',
    },
  });
  await jsonOrThrow(studentRes, 'create outside student');

  return { schoolId, email, password };
}

async function teardownOutsideSchool(request: APIRequestContext, schoolId: string): Promise<void> {
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${fixture.admin.token}`,
  };
  await request.delete(`${BACKEND_URL}/admin/schools/${schoolId}`, { headers: authHeaders }).catch(() => undefined);
  await request
    .delete(`${BACKEND_URL}/admin/trash?entity_type=schools&id=${schoolId}`, { headers: authHeaders })
    .catch(() => undefined);
}

test.describe('Teacher — Notifications', () => {
  test('compose a notification to All Students, confirm it appears in Sent, reaches the fixture student, and does not leak to a different school', async ({
    page,
    request,
  }) => {
    const outside = await createOutsideStudent(request);

    try {
      const uniqueTitle = `QA E2E Teacher Notification ${Date.now()}`;
      const uniqueMessage = 'This is a QA e2e teacher notification body.';

      const recipientsResponse = page.waitForResponse((res) =>
        res.url().includes('/teacher/notifications/recipients'),
      );
      await page.goto('/lms/teacher/notifications');
      await recipientsResponse;

      await page.getByRole('tab', { name: 'Send Notification' }).click();
      await page.locator('#title').fill(uniqueTitle);
      await page.locator('#message').fill(uniqueMessage);

      const studentRoleCheckbox = page
        .locator('label', { hasText: /All Students/i })
        .locator('input[type="checkbox"]');
      await studentRoleCheckbox.check();

      const createResponse = page.waitForResponse(
        (res) => res.url().endsWith('/teacher/notifications') && res.request().method() === 'POST',
      );
      await page.getByRole('button', { name: /^Send Notification$/ }).click();
      const createRes = await createResponse;
      expect(createRes.ok(), await createRes.text()).toBeTruthy();

      // handleSendNotification switches to the "view" tab automatically.
      await expect(page.getByRole('tab', { name: 'View Sent' })).toHaveAttribute('data-state', 'active');
      await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 10000 });

      // Cross-user delivery check: the fixture student's own feed must contain it.
      const studentToken = await loginStudent(request, fixture.students[0].email, fixture.students[0].password);
      const studentNotifsRes = await request.get(`${BACKEND_URL}/student/notifications`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      expect(studentNotifsRes.ok(), await studentNotifsRes.text()).toBeTruthy();
      const studentNotifsBody = await studentNotifsRes.json();
      const studentNotifs = (studentNotifsBody?.notifications ?? []) as Array<{ title: string; message: string }>;
      expect(
        studentNotifs.some((n) => n.title === uniqueTitle && n.message === uniqueMessage),
        'expected fixture student\'s own /student/notifications feed to contain the notification',
      ).toBeTruthy();

      // Negative case: a student in a completely different school must not receive it.
      const outsideToken = await loginStudent(request, outside.email, outside.password);
      const outsideNotifsRes = await request.get(`${BACKEND_URL}/student/notifications`, {
        headers: { Authorization: `Bearer ${outsideToken}` },
      });
      expect(outsideNotifsRes.ok(), await outsideNotifsRes.text()).toBeTruthy();
      const outsideNotifsBody = await outsideNotifsRes.json();
      const outsideNotifs = (outsideNotifsBody?.notifications ?? []) as Array<{ title: string; message: string }>;
      expect(
        outsideNotifs.some((n) => n.title === uniqueTitle),
        'a student in a different school must never receive a school-scoped "role:student" broadcast',
      ).toBeFalsy();
    } finally {
      await teardownOutsideSchool(request, outside.schoolId);
    }
  });
});
