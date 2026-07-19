import { test } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.resolve(__dirname, '.auth/school-admin.json') });

test('diag', async ({ page }) => {
  page.on('console', (msg) => console.log('[console]', msg.text()));
  page.on('response', (res) => {
    if (res.url().includes('/api/auth/') || res.url().includes('/school-admin/') || res.url().includes('/auth/')) {
      console.log('[response]', res.status(), res.request().method(), res.url());
    }
  });
  await page.goto('/lms/school-admin');
  await page.waitForTimeout(6000);
  console.log('[cookies]', JSON.stringify(await page.context().cookies()));
});
