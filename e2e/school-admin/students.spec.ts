import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);

test.use({ storageState: path.resolve(__dirname, '.auth/school-admin.json') });

test.describe('School Admin — Students', () => {
  test('renders real student roster, not a zero-state', async ({ page }) => {
    const studentsResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/students') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin/students');
    await studentsResponse;

    await expect(page.getByText('QA Student 0')).toBeVisible();
    await expect(page.getByText('QA Student 1')).toBeVisible();
    await expect(page.getByText('QA Student 2')).toBeVisible();
  });

  test('add-student form creates a real student via POST /school-admin/students', async ({
    page,
  }) => {
    const studentsResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/students') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin/students');
    await studentsResponse;

    const newName = `QA E2E New Student ${Date.now()}`;
    const newEmail = `qa_e2e_new_${Date.now()}@example.test`;

    await page.getByRole('button', { name: /Add Student/i }).click();
    await page.getByLabel(/Full Name/).fill(newName);
    await page.getByLabel(/^Email/).fill(newEmail);

    // Grade select (Radix Select — click trigger, then pick the option by text).
    await page.locator('#grade').click();
    await page.getByRole('option', { name: fixture.grade, exact: true }).click();

    // Section select.
    await page.locator('#section').click();
    await page.getByRole('option', { name: fixture.section.replace('Section ', ''), exact: true }).click();

    await page.getByLabel(/Password/).fill('QaTest123!');
    await page.getByLabel(/Parent Name/).fill('QA E2E Parent');
    await page.getByLabel(/Parent Number/).fill('9999999999');

    const createResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/students') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /^Add Student$/ }).click();
    const createRes = await createResponse;
    expect(createRes.ok(), await createRes.text()).toBeTruthy();

    await expect(page.getByText(newName)).toBeVisible({ timeout: 10000 });

    // --- Cleanup: delete only the student we just created via the real UI delete flow. ---
    const newRow = page.getByRole('row', { name: new RegExp(newName) });
    await expect(newRow).toBeVisible();
    await newRow.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    const deleteConfirm = page.getByRole('button', { name: /Delete student/i });
    await expect(deleteConfirm).toBeVisible();
    const deleteResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/students/') && res.request().method() === 'DELETE',
    );
    await deleteConfirm.click();
    const deleteRes = await deleteResponse;
    expect(deleteRes.ok(), await deleteRes.text()).toBeTruthy();
    await expect(page.getByText(newName)).toHaveCount(0);
  });

  test('password reset (Change Password in Edit dialog) calls PATCH /school-admin/students/:id/password', async ({
    page,
  }) => {
    const studentsResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/students') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin/students');
    await studentsResponse;

    // NOTE: there is no standalone "Reset Password" row action in the UI —
    // students/page.tsx defines an unused `_handleResetPassword` helper
    // (prefixed with `_`, never wired to any button — see students/page.tsx
    // ~line 557) that is dead code. The only reachable password-reset path is
    // the "Change Password" control inside the row's Edit dialog, which calls
    // schoolAdminApi.students.changePassword -> PATCH
    // /school-admin/students/:id/password. Exercising that real path here.
    const studentRow = page.getByRole('row', { name: /QA Student 0/ });
    await expect(studentRow).toBeVisible();
    await studentRow.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    await expect(page.getByRole('dialog', { name: /Edit Student/i })).toBeVisible();
    const newPasswordInput = page.locator('#new_password');
    await newPasswordInput.fill('QaTestReset123!');

    const passwordResponse = page.waitForResponse(
      (res) =>
        /\/school-admin\/students\/[^/]+\/password$/.test(res.url()) &&
        res.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: /^Change Password$/ }).click();
    const passwordRes = await passwordResponse;
    expect(passwordRes.ok(), await passwordRes.text()).toBeTruthy();

    await expect(page.getByText(/Password updated for/i)).toBeVisible({ timeout: 10000 });
  });
});
