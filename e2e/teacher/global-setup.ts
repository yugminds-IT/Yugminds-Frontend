import fs from 'fs';
import path from 'path';
import type { FullConfig } from '@playwright/test';
import { createQaFixture } from './fixture-client';

const FIXTURE_PATH = path.resolve(__dirname, '.fixture.json');

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

// NOTE: this used to also launch a browser here, log in once as the fixture
// school-admin, and save a storageState.json for every spec file to share.
// Dropped that: the backend rotates the refresh_token cookie on every
// /api/auth/refresh call (auth.controller.ts refresh()), and this app's
// session model forces a refresh on every full page load (session-utils.ts
// keeps the access token in-memory only). A single on-disk storageState
// snapshot is invalidated the moment ANY test consumes it, so only the first
// spec in a run could ever pass. Each spec now logs in for real through the
// UI itself (see e2e/teacher/base.ts's `page` fixture) instead.
export default async function globalSetup(_config: FullConfig): Promise<void> {
  loadAdminSeedCreds();

  const fixture = await createQaFixture();
  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2));
  console.log(
    `[global-setup] Created QA fixture school ${fixture.schoolId} (run ${fixture.runId}) with ${fixture.teachers.length} teachers, ${fixture.students.length} students, 1 course.`,
  );
}
