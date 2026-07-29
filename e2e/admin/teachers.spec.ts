import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);

test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

test.describe('Admin — Teachers', () => {
  test('renders real fixture teachers, not a zero-state', async ({ page }) => {
    const teachersResponse = page.waitForResponse(
      (res) => res.url().includes('/admin/teachers') && res.request().method() === 'GET',
    );
    await page.goto('/lms/admin/teachers');
    await teachersResponse;

    // Scope by this run's email — orphaned fixtures from earlier interrupted
    // runs can leave duplicate "QA Teacher 0"-named rows, and each name also
    // appears in both a preview card and the table row.
    await expect(page.getByText(new RegExp(fixture.teachers[0].email)).first()).toBeVisible();
    await expect(page.getByText(new RegExp(fixture.teachers[1].email)).first()).toBeVisible();
  });

  test('edit dialog updates a real teacher via PUT /admin/teachers/:id', async ({ page }) => {
    const teachersResponse = page.waitForResponse(
      (res) => res.url().includes('/admin/teachers') && res.request().method() === 'GET',
    );
    await page.goto('/lms/admin/teachers');
    await teachersResponse;

    const newName = `QA Teacher 0 Edited ${Date.now()}`;
    const row = page.getByRole('row', { name: new RegExp(fixture.teachers[0].email) });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    await expect(page.getByRole('dialog', { name: /Edit Teacher/i })).toBeVisible();
    await page.getByLabel('Full Name').fill(newName);

    const updateResponse = page.waitForResponse(
      (res) => /\/admin\/teachers\/\d+$/.test(res.url()) && res.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: /^Update Teacher$/ }).click();
    const res = await updateResponse;
    expect(res.ok(), await res.text()).toBeTruthy();

    await expect(page.getByText(newName)).toBeVisible({ timeout: 10000 });
  });
});
