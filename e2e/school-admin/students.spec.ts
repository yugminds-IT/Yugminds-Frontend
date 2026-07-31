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

    // Only the toolbar trigger exists before the dialog opens, so this click is
    // unambiguous. Once the dialog is open, both it and the dialog's own submit
    // button are named "Add Student" — scope everything else to the dialog to
    // avoid a strict-mode (multiple-match) locator error.
    await page.getByRole('button', { name: /^Add Student$/ }).click();
    const addDialog = page.getByRole('dialog', { name: /Add New Student/i });
    await expect(addDialog).toBeVisible();

    await addDialog.getByLabel(/Full Name/).fill(newName);
    await addDialog.getByLabel(/^Email/).fill(newEmail);

    // Grade/Section are Radix Selects. NOTE: the <Label htmlFor="grade">/
    // <Label htmlFor="section"> in students/page.tsx (~line 950, ~970) point at
    // ids that are never actually set on the <Select>/<SelectTrigger> — so
    // getByLabel() can't reach these controls; click the trigger by its visible
    // placeholder text instead.
    await addDialog.getByText('Select grade', { exact: true }).click();
    await page.getByRole('option', { name: fixture.grade, exact: true }).click();

    // NOTE: the section SelectItem renders the raw value verbatim (students/
    // page.tsx ~line 970 `<SelectItem value={section}>{section}</SelectItem>`),
    // and that value comes straight from the school's `sections_offered`
    // (school.service.ts), which stores full names like "Section A" — not the
    // bare letter — so the option text is "Section A", matching fixture.section.
    await addDialog.getByText('Select section', { exact: true }).click();
    await page.getByRole('option', { name: fixture.section, exact: true }).click();

    await addDialog.getByLabel(/Password/).fill('QaTest123!');
    await addDialog.getByLabel(/Parent Name/).fill('QA E2E Parent');
    await addDialog.getByLabel(/Parent Number/).fill('9999999999');

    const createResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/students') && res.request().method() === 'POST',
    );
    await addDialog.getByRole('button', { name: /^Add Student$/ }).click();
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

  test('Edit dialog pre-fills the Section dropdown with the student\'s real, already-assigned section', async ({
    page,
  }) => {
    const studentsResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/students') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin/students');
    await studentsResponse;

    // Regression test for a bug where the Edit form blanked out a student's
    // real section whenever it didn't byte-for-byte match the school's
    // *current* configured section list (predefinedSections.includes check),
    // showing "Select section" instead of the real, correct value.
    const studentRow = page.getByRole('row', { name: /QA Student 0/ });
    await expect(studentRow).toBeVisible();
    await studentRow.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    const editDialog = page.getByRole('dialog', { name: /Edit Student/i });
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByText('Select section', { exact: true })).toHaveCount(0);
    await expect(editDialog.getByText(fixture.section, { exact: true })).toBeVisible();
  });

  test('Student Details modal shows the grade without a doubled "Grade Grade" prefix', async ({
    page,
  }) => {
    const studentsResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/students') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin/students');
    await studentsResponse;

    const studentRow = page.getByRole('row', { name: /QA Student 0/ });
    await expect(studentRow).toBeVisible();
    await studentRow.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'View details' }).click();

    const detailsDialog = page.getByRole('dialog', { name: /Student Details/i });
    await expect(detailsDialog).toBeVisible();
    // fixture.grade is 'Grade 1' — the stored value already includes the
    // "Grade " prefix, so the badge must show it exactly once, not
    // "Grade Grade 1".
    await expect(detailsDialog.getByText(fixture.grade, { exact: true })).toBeVisible();
    await expect(detailsDialog.getByText(`Grade ${fixture.grade}`)).toHaveCount(0);
  });
});
