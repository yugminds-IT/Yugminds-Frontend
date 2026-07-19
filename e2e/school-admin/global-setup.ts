import fs from 'fs';
import path from 'path';
import { chromium, type FullConfig } from '@playwright/test';
import { createQaFixture } from './fixture-client';

const FIXTURE_PATH = path.resolve(__dirname, '.fixture.json');
const AUTH_DIR = path.resolve(__dirname, '.auth');
const STORAGE_STATE_PATH = path.resolve(AUTH_DIR, 'school-admin.json');

/** Reads ADMIN_SEED_EMAIL/PASSWORD out of the backend's .env without ever logging them. */
function loadAdminSeedCreds(): void {
  if (process.env.ADMIN_SEED_EMAIL && process.env.ADMIN_SEED_PASSWORD) return;
  const backendEnvPath = path.resolve(__dirname, '../../../Yugminds Backend/.env');
  const raw = fs.readFileSync(backendEnvPath, 'utf8');
  for (const line of raw.split('\n')) {
    const match = line.match(/^\s*(ADMIN_SEED_EMAIL|ADMIN_SEED_PASSWORD)\s*=\s*(.*)\s*$/);
    if (match) {
      const [, key, value] = match;
      process.env[key] = value.trim().replace(/^["']|["']$/g, '');
    }
  }
  if (!process.env.ADMIN_SEED_EMAIL || !process.env.ADMIN_SEED_PASSWORD) {
    throw new Error(`Could not read ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD from ${backendEnvPath}`);
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  loadAdminSeedCreds();

  const fixture = await createQaFixture();
  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2));
  console.log(
    `[global-setup] Created QA fixture school ${fixture.schoolId} (run ${fixture.runId}) with ${fixture.teachers.length} teachers, ${fixture.students.length} students, 1 course.`,
  );

  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';

  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${baseURL}/lms/login`);
  await page.locator('#email').fill(fixture.schoolAdmin.email);
  await page.locator('#password').fill(fixture.schoolAdmin.password);
  await Promise.all([
    page.waitForURL(/\/lms\/school-admin/, { timeout: 30_000 }),
    page.locator('button[type="submit"]').click(),
  ]);

  // Let the dashboard's initial bootstrap calls (profile/school) settle so the
  // saved storage state reflects a fully-authenticated, loaded session.
  await page.waitForSelector('text=Admin Panel, text=School Admin Dashboard', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1000);

  await context.storageState({ path: STORAGE_STATE_PATH });
  await browser.close();

  console.log(`[global-setup] Logged in as fixture school-admin, saved storage state to ${STORAGE_STATE_PATH}`);
}
