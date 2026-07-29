import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);

test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

test.describe('Admin — Students', () => {
  test('renders real fixture students, not a zero-state', async ({ page }) => {
    const studentsResponse = page.waitForResponse(
      (res) => res.url().includes('/admin/students') && res.request().method() === 'GET',
    );
    await page.goto('/lms/admin/students');
    await studentsResponse;

    // Scope by this run's email (not just "QA Student 0") — orphaned
    // fixtures from earlier interrupted runs can leave duplicate-named rows.
    await expect(page.getByText(new RegExp(fixture.students[0].email))).toBeVisible();
    await expect(page.getByText(new RegExp(fixture.students[1].email))).toBeVisible();
    await expect(page.getByText(new RegExp(fixture.students[2].email))).toBeVisible();
  });

  test('edit dialog updates a real student via PATCH /admin/students/:id', async ({ page }) => {
    const studentsResponse = page.waitForResponse(
      (res) => res.url().includes('/admin/students') && res.request().method() === 'GET',
    );
    await page.goto('/lms/admin/students');
    await studentsResponse;

    const newName = `QA Student 0 Edited ${Date.now()}`;
    const row = page.getByRole('row', { name: new RegExp(fixture.students[0].email) });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    await expect(page.getByRole('dialog', { name: /Edit Student/i })).toBeVisible();
    await page.getByLabel(/Full Name/).fill(newName);

    const updateResponse = page.waitForResponse(
      (res) => /\/admin\/students\/\d+$/.test(res.url()) && res.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: /^(Update Student|Save Changes)$/ }).click();
    const res = await updateResponse;
    expect(res.ok(), await res.text()).toBeTruthy();

    await expect(page.getByText(newName)).toBeVisible({ timeout: 10000 });
  });
});
