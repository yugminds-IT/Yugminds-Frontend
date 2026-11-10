import { test, expect } from './base';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);


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

    // Only the hero button exists before the dialog opens. Once it is open, scope
    // everything to the dialog (its own submit button has the same name).
    await page.getByRole('button', { name: /^Add student$/ }).click();
    const addDialog = page.getByRole('dialog', { name: /Add a student/i });
    await expect(addDialog).toBeVisible();

    await addDialog.getByLabel('Full name').fill(newName);
    await addDialog.getByLabel('Email').fill(newEmail);

    // Grade and section are pill buttons. Section values are stored as full
    // names like "Section A" (school.service.ts sections_offered), so the pill
    // text matches fixture.section as is.
    await addDialog.getByRole('button', { name: fixture.grade, exact: true }).click();
    await addDialog.getByRole('button', { name: fixture.section, exact: true }).click();

    // exact: the eye button is labelled "Show password"
    await addDialog.getByLabel('Password', { exact: true }).fill('QaTest123!');
    await addDialog.getByLabel('Name', { exact: true }).fill('QA E2E Parent');
    await addDialog.getByLabel('Phone number').fill('9999999999');

    const createResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/students') && res.request().method() === 'POST',
    );
    await addDialog.getByRole('button', { name: /^Add student$/ }).click();
    const createRes = await createResponse;
    expect(createRes.ok(), await createRes.text()).toBeTruthy();

    await expect(page.getByText(newName)).toBeVisible({ timeout: 10000 });

    // --- Cleanup: delete only the student we just created via the real UI delete flow. ---
    const newRow = page.getByRole('article').filter({ hasText: newName });
    await expect(newRow).toBeVisible();
    await newRow.getByRole('button', { name: `More actions for ${newName}` }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    const deleteConfirm = page.getByRole('button', { name: /^Delete student$/ });
    await expect(deleteConfirm).toBeVisible();
    const deleteResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/students/') && res.request().method() === 'DELETE',
    );
    await deleteConfirm.click();
    const deleteRes = await deleteResponse;
    expect(deleteRes.ok(), await deleteRes.text()).toBeTruthy();
    await expect(page.getByText(newName)).toHaveCount(0);
  });

  test('Reset password calls PATCH /school-admin/students/:id/password', async ({ page }) => {
    const studentsResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/students') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin/students');
    await studentsResponse;

    // "Reset password" is in each row's more-actions menu (and in the details dialog).
    const studentRow = page.getByRole('article').filter({ hasText: 'QA Student 0' });
    await expect(studentRow).toBeVisible();
    await studentRow.getByRole('button', { name: /^More actions for/ }).click();
    await page.getByRole('menuitem', { name: 'Reset password' }).click();

    const dialog = page.getByRole('dialog', { name: /Reset password/i });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('New password', { exact: true }).fill('QaTestReset123!');

    const passwordResponse = page.waitForResponse(
      (res) =>
        /\/school-admin\/students\/[^/]+\/password$/.test(res.url()) &&
        res.request().method() === 'PATCH',
    );
    await dialog.getByRole('button', { name: /^Set new password$/ }).click();
    const passwordRes = await passwordResponse;
    expect(passwordRes.ok(), await passwordRes.text()).toBeTruthy();

    await expect(page.getByText(/Password updated for/i)).toBeVisible({ timeout: 10000 });
  });

  test('Edit dialog pre-selects the student\'s real, already-assigned section', async ({ page }) => {
    const studentsResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/students') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin/students');
    await studentsResponse;

    // Regression test for a bug where the Edit form blanked out a student's real
    // section whenever it didn't match the school's *current* configured list.
    const studentRow = page.getByRole('article').filter({ hasText: 'QA Student 0' });
    await expect(studentRow).toBeVisible();
    await studentRow.getByRole('button', { name: /^Edit QA Student 0/ }).click();

    const editDialog = page.getByRole('dialog', { name: /Edit student/i });
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByRole('button', { name: fixture.section, exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('student details show the grade without a doubled "Grade Grade" prefix', async ({ page }) => {
    const studentsResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/students') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin/students');
    await studentsResponse;

    await page.getByRole('button', { name: /^QA Student 0/ }).click();

    const detailsDialog = page.getByRole('dialog', { name: /QA Student 0/ });
    await expect(detailsDialog).toBeVisible();
    // fixture.grade is 'Grade 1': the stored value already includes "Grade ",
    // so it must show once, not "Grade Grade 1".
    await expect(detailsDialog).toContainText(fixture.grade);
    await expect(detailsDialog).not.toContainText(`Grade ${fixture.grade}`);
  });

  test('picking a grade on the class track filters the list', async ({ page }) => {
    const studentsResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/students') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin/students');
    await studentsResponse;

    const filtered = page.waitForResponse(
      (res) =>
        res.url().includes('/school-admin/students') &&
        res.url().includes('grade=') &&
        res.url().includes('limit=25') &&
        res.request().method() === 'GET',
    );
    await page.getByRole('button', { name: new RegExp(`^${fixture.grade},`) }).click();
    const res = await filtered;
    expect(res.ok()).toBeTruthy();
    await expect(page.getByRole('button', { name: /Show all grades/ })).toBeVisible();
  });
});
