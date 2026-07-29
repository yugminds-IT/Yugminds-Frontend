import { test, expect } from './base';
import fs from 'fs';
import path from 'path';
import type { QaFixture } from './fixture-client';

const fixture: QaFixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '.fixture.json'), 'utf8'),
);


// NOTE on scope: fixture.courseId is a bare Draft course with no chapters,
// assignments, or submissions (createQaFixture only POSTs /admin/courses).
// Seeding one real graded submission would require authoring a full
// course -> chapter -> assignment -> submission hierarchy plus a teacher
// grading flow, which is out of proportion for this page's coverage. Instead
// this spec verifies the page's genuine, code-path-confirmed empty/zero
// state for a school with real students but zero assignment activity.
//
// Page source (src/app/lms/school-admin/assignment-analytics/page.tsx) calls
// schoolAdminApi.stats.leaderboard() -> GET /school-admin/leaderboard (NOT
// /school-admin/assignment-analytics, despite the route/tab being named
// "Assignment Analytics" — schoolAdminApi.stats.assignmentAnalytics() exists
// in src/lib/api/school-admin.api.ts:20 but appears unused by this page).
//
// Backend (stats.service.ts) builds `leaderboard` from
// studentRanking.getGlobalRanking(), which includes every active enrollment
// in the school regardless of whether they have any graded submissions — so
// with 3 real fixture students the leaderboard array has 3 rows (all 0%),
// it is NOT empty. `grade_breakdown`, `subject_breakdown`, and
// `assignment_table`, by contrast, are built only from `bestSubmissions` /
// published assignments, both of which are genuinely empty for this fixture
// school — so those three tabs should show real "no data" copy.

test.describe('School Admin — Assignment Analytics', () => {
  test('renders honest zero-activity state: students listed at 0%, other tabs empty', async ({
    page,
  }) => {
    const leaderboardResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/leaderboard') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin/assignment-analytics');
    const res = await leaderboardResponse;
    expect(res.ok()).toBeTruthy();

    await expect(page.getByRole('heading', { name: 'Assignment Analytics' })).toBeVisible();

    // Summary cards: 3 real students, 0 assignments published, 0.0% avg score.
    // NOTE: "text=Assignments" alone also matches the "Assignments" tab button
    // below the cards, and `.locator('..').locator('..')` from that match
    // walks up into the shared stat-card-row container (catching every other
    // card's "0"). Scoping to `<p>` avoids matching the tab button, and the
    // value/label paragraphs are siblings one level up (not two) per the
    // actual StatCard-style markup this page uses.
    const studentsCard = page.locator('p', { hasText: /^Students$/ }).locator('..');
    await expect(studentsCard.getByText('3', { exact: true })).toBeVisible();

    const assignmentsCard = page.locator('p', { hasText: /^Assignments$/ }).locator('..');
    await expect(assignmentsCard.getByText('0', { exact: true })).toBeVisible();

    await expect(page.getByText('0.0%', { exact: true })).toBeVisible();

    // Leaderboard tab (default) is NOT empty — all 3 fixture students appear,
    // each at 0% overall score, per the getGlobalRanking behavior above.
    // NOTE: CardTitle (src/components/ui/card.tsx) renders a plain <div>, not
    // a semantic heading — getByRole('heading', ...) never matches it.
    await expect(page.getByText('Student Rankings', { exact: true })).toBeVisible();
    await expect(page.getByText('QA Student 0')).toBeVisible();
    await expect(page.getByText('QA Student 1')).toBeVisible();
    await expect(page.getByText('QA Student 2')).toBeVisible();
    // The "No data yet" placeholder must NOT show on the leaderboard tab.
    await expect(page.getByText('No data yet')).not.toBeVisible();

    // Top-3 podium renders too, since leaderboard.length >= 3.
    await expect(page.getByText('Top Performers')).toBeVisible();
  });

  test('By Grade and By Subject tabs show real "no data" state (no graded submissions exist)', async ({
    page,
  }) => {
    await page.goto('/lms/school-admin/assignment-analytics');
    await page.waitForResponse(
      (res) => res.url().includes('/school-admin/leaderboard') && res.request().method() === 'GET',
    );

    // NOTE: these tab-panel titles are CardTitle <div>s too, not headings.
    await page.getByRole('button', { name: 'By Grade' }).click();
    await expect(page.getByText('Grade-wise Performance', { exact: true })).toBeVisible();
    await expect(page.getByText('No data yet')).toBeVisible();

    await page.getByRole('button', { name: 'By Subject' }).click();
    await expect(page.getByText('Subject-wise Performance', { exact: true })).toBeVisible();
    await expect(page.getByText('No data yet')).toBeVisible();
  });

  test('Assignments tab shows "No assignments published yet" (fixture course has no assignments)', async ({
    page,
  }) => {
    await page.goto('/lms/school-admin/assignment-analytics');
    await page.waitForResponse(
      (res) => res.url().includes('/school-admin/leaderboard') && res.request().method() === 'GET',
    );

    await page.getByRole('button', { name: 'Assignments' }).click();
    await expect(page.getByText('Assignment Performance', { exact: true })).toBeVisible();
    await expect(page.getByText('No assignments published yet')).toBeVisible();
  });
});
