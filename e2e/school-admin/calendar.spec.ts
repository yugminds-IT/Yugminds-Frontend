import { test, expect } from './base';
import path from 'path';


// The fixture creates no calendar entries — src/hooks/useSchoolCalendar.ts backs
// this page with GET/POST/PATCH/DELETE /school-admin/calendar.
test.describe('School Admin — Calendar', () => {
  test('create, edit, and delete a calendar entry through the real UI', async ({ page }) => {
    const currentYear = String(new Date().getFullYear());
    const entryName = `QA E2E Holiday ${Date.now()}`;

    await page.goto('/lms/school-admin/calendar');
    await page.waitForResponse((res) => res.url().includes('/school-admin/calendar'));

    await page.getByRole('button', { name: 'Add Entry' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.first().fill(`${currentYear}-12-25`);
    await page.getByPlaceholder(/Diwali, Summer Break/).fill(entryName);

    const createResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/calendar') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Add Entry', exact: true }).click();
    const createRes = await createResponse;
    expect(createRes.ok(), await createRes.text()).toBeTruthy();

    await expect(page.getByText(entryName)).toBeVisible({ timeout: 10000 });
    // Default type is "Holiday" per emptyForm — confirm the badge reflects it.
    const entryRow = page.getByRole('row', { name: new RegExp(entryName) });
    await expect(entryRow.getByText('Holiday', { exact: true })).toBeVisible();

    // Edit: change the name.
    const editedName = `${entryName} (edited)`;
    await entryRow.locator('button').first().click(); // Pencil edit button
    await expect(page.getByRole('dialog', { name: /Edit Calendar Entry/i })).toBeVisible();
    await page.getByPlaceholder(/Diwali, Summer Break/).fill(editedName);

    const updateResponse = page.waitForResponse(
      (res) => /\/school-admin\/calendar\/[^/]+$/.test(res.url()) && res.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Save Changes' }).click();
    const updateRes = await updateResponse;
    expect(updateRes.ok(), await updateRes.text()).toBeTruthy();
    await expect(page.getByText(editedName)).toBeVisible({ timeout: 10000 });

    // Delete.
    const editedRow = page.getByRole('row', { name: new RegExp(editedName.replace(/[()]/g, '\\$&')) });
    await editedRow.locator('button').nth(1).click(); // Trash delete button
    await expect(page.getByRole('dialog', { name: /Delete Calendar Entry/i })).toBeVisible();

    const deleteResponse = page.waitForResponse(
      (res) => /\/school-admin\/calendar\/[^/]+$/.test(res.url()) && res.request().method() === 'DELETE',
    );
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    const deleteRes = await deleteResponse;
    expect(deleteRes.ok(), await deleteRes.text()).toBeTruthy();
    await expect(page.getByText(editedName)).toHaveCount(0);
  });
});
