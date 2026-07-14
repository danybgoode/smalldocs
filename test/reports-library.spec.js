const { test, expect } = require('@playwright/test');

async function expectNoHorizontalOverflow(page) {
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(fits).toBeTruthy();
}

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
