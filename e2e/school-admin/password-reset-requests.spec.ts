import { test, expect } from './base';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);


test.describe('School Admin — Password Reset Requests', () => {
  test('a request submitted through the real public forgot-password form shows up here and can be approved', async ({
    page,
    context,
  }) => {
    // Origin the request via the real, unauthenticated forgot-password page —
    // this is the actual origin of these requests (POST /auth/password-reset-request),
    // not a raw API seed, per the fixture teacher's email. Use a separate page
    // in the same context so we don't lose the school-admin storageState session
    // on the primary `page` fixture.
    //
    // Deliberately teachers[1], not teachers[0]: approving this request sets a
    // REAL new password for that teacher (schoolAdminApi.passwordResetRequests
    // .update with temp_password), which would otherwise silently break every
    // other spec file that logs in as teachers[0] with the fixture's original
    // password (notifications.spec.ts, schedules.spec.ts, teachers.spec.ts).
    // This was a real cross-spec-pollution test bug found while iterating.
    const publicPage = await context.newPage();
    await publicPage.goto('/lms/forgot-password');
    await publicPage.locator('#email').fill(fixture.teachers[1].email);

    const submitResponse = publicPage.waitForResponse(
      (res) => res.url().includes('/password-reset-request'),
    );
    await publicPage.getByRole('button', { name: /Submitting Request|^Send Reset Link$|^Reset Password$|Submit/i }).click().catch(async () => {
      // Fallback: the only submit button on this form.
      await publicPage.locator('button[type="submit"]').click();
    });
    const submitRes = await submitResponse;
    expect(submitRes.ok(), await submitRes.text()).toBeTruthy();
    await publicPage.close();

    // Now, as the school-admin, confirm it shows up under Waiting.
    const listResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/password-reset-requests') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin/password-reset-requests');
    const listRes = await listResponse;
    expect(listRes.ok()).toBeTruthy();

    await expect(page.getByRole('heading', { name: 'Password reset requests' })).toBeVisible();

    // Requests are rows (<article>) in a list, not table rows.
    const requestRow = page.getByRole('article').filter({ hasText: fixture.teachers[1].email });
    await expect(requestRow).toBeVisible({ timeout: 10000 });
    await expect(requestRow.getByRole('button', { name: /^Reject/ })).toBeVisible();

    await requestRow.getByRole('button', { name: /^Approve/ }).click();
    const approveDialog = page.getByRole('dialog', { name: /Approve request/i });
    await expect(approveDialog).toBeVisible();
    // The server needs at least 6 characters; the button stays disabled until then.
    const approveButton = approveDialog.getByRole('button', { name: /Approve and set password/i });
    await approveDialog.locator('#sa-temp-password').fill('abc');
    await expect(approveButton).toBeDisabled();
    await approveDialog.locator('#sa-temp-password').fill('QaTestTempPass123!');
    await expect(approveButton).toBeEnabled();

    const approveResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/password-reset-requests') && res.request().method() === 'PATCH',
    );
    await approveButton.click();
    const approveRes = await approveResponse;
    expect(approveRes.ok(), await approveRes.text()).toBeTruthy();

    // The dialog stays open to show the password once, so the admin can pass it on.
    const doneDialog = page.getByRole('dialog', { name: /Password set/i });
    await expect(doneDialog).toBeVisible();
    await expect(doneDialog.getByText('QaTestTempPass123!')).toBeVisible();
    await doneDialog.getByRole('button', { name: 'Done' }).click();

    // Request moves out of Waiting into History as Approved.
    await expect(page.getByRole('article').filter({ hasText: fixture.teachers[1].email })).toHaveCount(0, {
      timeout: 10000,
    });
    await page.getByRole('tab', { name: /^History/ }).click();
    const historyRow = page.getByRole('article').filter({ hasText: fixture.teachers[1].email });
    await expect(historyRow).toBeVisible();
    await expect(historyRow.getByText('Approved', { exact: true })).toBeVisible();
  });
});
