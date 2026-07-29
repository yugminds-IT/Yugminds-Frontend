import fs from 'fs';
import path from 'path';
import { teardownQaFixture, type QaFixture } from './fixture-client';

const FIXTURE_PATH = path.resolve(__dirname, '.fixture.json');
const AUTH_DIR = path.resolve(__dirname, '.auth');

export default async function globalTeardown(): Promise<void> {
  if (!fs.existsSync(FIXTURE_PATH)) {
    console.warn('[global-teardown] No fixture file found, nothing to tear down.');
    return;
  }
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as QaFixture;

  await teardownQaFixture(fixture);
  console.log(`[global-teardown] Tore down QA fixture school ${fixture.schoolId} (run ${fixture.runId}).`);

  fs.rmSync(FIXTURE_PATH, { force: true });
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
}
