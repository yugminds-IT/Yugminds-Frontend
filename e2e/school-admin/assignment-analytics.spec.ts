import { test, expect } from './base';


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
  test('renders honest zero-activity state: students listed with no scores, other tabs empty', async ({
    page,
  }) => {
    const leaderboardResponse = page.waitForResponse(
      (res) => res.url().includes('/school-admin/leaderboard') && res.request().method() === 'GET',
    );
    await page.goto('/lms/school-admin/assignment-analytics');
    const res = await leaderboardResponse;
    expect(res.ok()).toBeTruthy();

    await expect(page.getByRole('heading', { name: 'Assignment analytics' })).toBeVisible();

    // Summary ledger: 3 real students, 0 assignments published, no average yet.
    const ledger = page.getByRole('group', { name: 'Score summary' });
    await expect(ledger.locator('div', { hasText: /^Students/ }).getByText('3', { exact: true })).toBeVisible();
    await expect(ledger.locator('div', { hasText: /^Assignments/ }).getByText('0', { exact: true }).first()).toBeVisible();

    // The hero says why there is nothing to show.
    await expect(page.getByText('No assignments are published yet')).toBeVisible();

    // Leaderboard tab (default) is NOT empty: all 3 fixture students appear with "No scores yet".
    await expect(page.getByRole('tab', { name: /Leaderboard/ })).toHaveAttribute('aria-selected', 'true');
    const ranking = page.getByRole('region', { name: 'Student ranking' });
    await expect(ranking.getByText('QA Student 0')).toBeVisible();
    await expect(ranking.getByText('QA Student 1')).toBeVisible();
    await expect(ranking.getByText('QA Student 2')).toBeVisible();
    await expect(ranking.getByText('No scores yet').first()).toBeVisible();

    // Nobody has scores, so there is no top-three podium.
    await expect(page.getByRole('list', { name: 'Top three students' })).toHaveCount(0);
  });

  test('score track filters the leaderboard', async ({ page }) => {
    await page.goto('/lms/school-admin/assignment-analytics');
    await page.waitForResponse(
      (res) => res.url().includes('/school-admin/leaderboard') && res.request().method() === 'GET',
    );

    // All fixture students sit in "No scores yet"; picking "Under 50%" leaves nobody.
    await page.getByRole('button', { name: /^Under 50%/ }).click();
    await expect(page.getByText('No students match')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByText('QA Student 0')).toBeVisible();
  });

  test('Classes and Subjects tabs show real "no scores" state (no graded submissions exist)', async ({
    page,
  }) => {
    await page.goto('/lms/school-admin/assignment-analytics');
    await page.waitForResponse(
      (res) => res.url().includes('/school-admin/leaderboard') && res.request().method() === 'GET',
    );

    await page.getByRole('tab', { name: /^Classes/ }).click();
    await expect(page.getByText('No class scores yet')).toBeVisible();

    await page.getByRole('tab', { name: /^Subjects/ }).click();
    await expect(page.getByText('No subject scores yet')).toBeVisible();
  });

  test('Assignments tab shows "No assignments published yet" (fixture course has no assignments)', async ({
    page,
  }) => {
    await page.goto('/lms/school-admin/assignment-analytics');
    await page.waitForResponse(
      (res) => res.url().includes('/school-admin/leaderboard') && res.request().method() === 'GET',
    );

    await page.getByRole('tab', { name: /^Assignments/ }).click();
    await expect(page.getByText('No assignments published yet')).toBeVisible();
  });
});
