import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);

test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

test.describe('Admin — Courses', () => {
  test('renders the real fixture course, not a zero-state', async ({ page }) => {
    const coursesResponse = page.waitForResponse(
      (res) => res.url().includes('/admin/courses') && res.request().method() === 'GET',
    );
    await page.goto('/lms/admin/courses');
    await coursesResponse;

    // The fixture's course AND school names both contain the run id (e.g.
    // "__qa_test_<runid>__ Course" and "...School"), so this matches 2
    // elements — scope to .first() to avoid a strict-mode violation.
    await expect(page.getByText(new RegExp(fixture.runId)).first()).toBeVisible();
  });

  test('publishing the fixture course (draft -> published) hits POST /admin/courses/:id/publish', async ({
    page,
  }) => {
    const coursesResponse = page.waitForResponse(
      (res) => res.url().includes('/admin/courses') && res.request().method() === 'GET',
    );
    await page.goto('/lms/admin/courses');
    await coursesResponse;

    const row = page.getByRole('row', { name: new RegExp(fixture.runId) });
    await expect(row).toBeVisible();
    // Draft courses show this exact title; Published ones show "Manage
    // publishing (schools / grades / sections)" instead (page.tsx).
    await row.getByTitle('Publish to schools, grades & sections').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const publishResponse = page.waitForResponse(
      (res) => /\/admin\/courses\/[^/]+\/publish$/.test(res.url()) && res.request().method() === 'POST',
    );
    // CoursePublishDialog's confirm button is titled "Publish Course", not
    // just "Publish".
    await dialog.getByRole('button', { name: 'Publish Course' }).click();
    const res = await publishResponse;
    expect(res.ok(), await res.text()).toBeTruthy();
  });
});
