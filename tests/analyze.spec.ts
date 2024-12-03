import test, { expect } from './fixtures';

test('analyze: we have data', async ({ page }) => {
  await page.goto('/analyze');
  await expect(page.getByTestId('server-filter')).toBeVisible();
  await expect(page.getByTestId('server-pricechart')).toBeVisible();
  await page.getByTestId('server-card').first().waitFor({ timeout: 10000});
  await expect(await page.getByTestId('server-card').count()).toBeGreaterThan(0);
  await expect(page.getByText('Volume', { exact: true })).toBeVisible();
  await expect(page.getByText('Price (€)', { exact: true })).toBeDefined();
  await expect(page.getByTestId('filter-clear')).not.toBeVisible();
  await page.getByTestId('filter-save').click();
  await expect(page.getByTestId('filter-clear')).toBeVisible();
  await page.getByTestId('filter-clear').click();
  await expect(page.getByTestId('filter-clear')).not.toBeVisible();
  await expect(page.getByTestId('results-count')).toHaveText(/^\d+ results/);
});
