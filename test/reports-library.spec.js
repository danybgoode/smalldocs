const { test, expect } = require('@playwright/test');

async function expectNoHorizontalOverflow(page) {
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(fits).toBeTruthy();
}

// reporthub-as-notion S2.1: public/reports.js now tries the live registry endpoint
// (/api/live/roadmap-status) FIRST and falls back to the build-time-baked /public/reports-data.json on
// any failure. Playwright runs against a real server.js with no REPORT_REGISTRY_STORAGE_BASE_URL
// override, so an un-mocked /api/live/roadmap-status would hit the REAL production GCS bucket over the
// network on every test — slow, flaky, and an unwanted external dependency for a UI test. Every test in
// this file mocks it to 404 (matching today's actual state: nothing has been published to live/ yet),
// forcing the deterministic, already-covered fallback path — except the one test below that explicitly
// exercises a successful live fetch.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/live/roadmap-status', (route) => route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: '{"error":"not_found"}',
  }));
});

test('reports library renders Roadmap views and opens the reader', async ({ page }) => {
  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: 'Biblioteca PMO' })).toBeVisible();
  await expect(page.locator('.view-card')).toHaveCount(5);
  await expect(page.locator('.report-card').first()).toBeVisible();
  await expect(page.locator('#stat-items')).not.toHaveText('--');

  const initialCount = await page.locator('.report-card').count();
  await page.fill('#search', 'pmo operational');
  await expect(page.locator('#result-count')).toContainText('reportes');
  await expect(page.locator('.report-card').first()).toBeVisible();
  await expect.poll(() => page.locator('.report-card').count()).toBeLessThan(initialCount);
  const visibleTitles = (await page.locator('.report-title').allTextContents()).join(' ');
  expect(visibleTitles).toMatch(/pmo operational/i);

  await page.fill('#search', '');
  await page.selectOption('#status-filter', { label: 'Shipped' });
  await expect(page.locator('.report-card').first()).toBeVisible();
  for (const text of await page.locator('.chip-status').allTextContents()) {
    expect(text).toBe('Shipped');
  }

  await page.selectOption('#area-filter', { label: '09 Platform-infra' });
  await expect(page.locator('.report-card').first()).toBeVisible();
  for (const text of await page.locator('.chip-area').allTextContents()) {
    expect(text).toBe('09 Platform-infra');
  }

  await page.selectOption('#status-filter', '');
  await page.selectOption('#area-filter', '');
  await page.fill('#search', '__no_report_match__');
  await expect(page.locator('.report-card')).toHaveCount(0);
  await expect(page.locator('#empty')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.fill('#search', '');
  await page.locator('.view-card').first().click();
  await expect(page).toHaveURL(/\/docs#md=/);
});

test('reports library fits mobile controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/reports');
  await expect(page.locator('.view-card').first()).toBeVisible();
  await expect(page.locator('.report-card').first()).toBeVisible();

  await page.getByRole('button', { name: 'Sprints' }).click();
  await page.fill('#search', 'sprint');
  await expect(page.locator('#result-count')).toContainText('reportes');
  const buttonHeight = await page.getByRole('button', { name: 'Sprints' }).evaluate((node) => node.getBoundingClientRect().height);
  expect(buttonHeight).toBeGreaterThanOrEqual(44);
  await expectNoHorizontalOverflow(page);
});

test('reports library shows an error state when report data fails', async ({ page }) => {
  await page.route('**/public/reports-data.json', (route) => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: '{"error":"unavailable"}',
  }));
  await page.goto('/reports');
  await expect(page.locator('#empty')).toBeVisible();
  await expect(page.locator('#empty')).toContainText('La biblioteca publicada no esta disponible.');
  await expect(page.locator('.report-card')).toHaveCount(0);
});

// reporthub-as-notion S2.1: with the live registry endpoint unavailable (the beforeEach mock, matching
// today's real "nothing published yet" state), the hub must still render from the bundled fallback and
// say so — this is the "source" indicator smoke a stakeholder can eyeball to tell live vs stale.
test('reports library falls back to the bundled snapshot when the live endpoint 404s, and labels it', async ({ page }) => {
  await page.goto('/reports');
  await expect(page.locator('.report-card').first()).toBeVisible();
  await expect(page.locator('#generated-at')).toContainText('instantanea local');
});

// The live path itself: when /api/live/roadmap-status DOES resolve, the hub renders that payload
// instead of the bundled one, and labels it "en vivo" — proves the two-tier fetch actually prefers live
// data when it's present, not just that the fallback works.
test('reports library renders the LIVE payload and labels it, when the live endpoint succeeds', async ({ page }) => {
  const liveGeneratedAt = '2099-01-01T00:00:00.000Z';
  await page.route('**/api/live/roadmap-status', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      schemaVersion: 1,
      generatedAt: liveGeneratedAt,
      stats: { shippedEpics: 42, activeEpics: 7, total: 1 },
      views: [],
      items: [{
        id: 'live-only-item', title: 'Live-only report card', grain: 'Epic', grainLabel: 'Epic',
        status: 'Shipped', statusLabel: 'Shipped', area: 'Live area', href: '/docs#md=live',
        sourceUrl: 'https://example.test/live', sourcePath: 'live.md',
      }],
    }),
  }));
  await page.goto('/reports');
  await expect(page.locator('#stat-shipped')).toHaveText('42');
  await expect(page.getByText('Live-only report card')).toBeVisible();
  await expect(page.locator('#generated-at')).toContainText('en vivo');
  await expect(page.locator('#generated-at')).not.toContainText('instantanea local');
});
