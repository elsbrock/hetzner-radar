import test, { expect } from './fixtures';

test('analyze: we have data', async ({ page }) => {
  await page.goto('/analyze');
  await expect(page.getByTestId('server-filter')).toBeVisible();
  await expect(page.getByTestId('server-pricechart')).toBeVisible();
  await page.getByTestId('server-card').first().waitFor();
  await expect(await page.getByTestId('server-card').count()).toBeGreaterThan(0);
  await expect(page.getByText('Volume', { exact: true })).toBeVisible();
  await expect(page.getByText('Price (€)', { exact: true })).toBeDefined();
  await expect(page.getByLabel('Clear Filter')).not.toBeVisible();
  await page.getByLabel('Save Filter').click();
  await expect(page.getByLabel('Clear Filter')).toBeDefined();
  await page.getByLabel('Clear Filter').click();
  await expect(page.getByLabel('Clear Filter')).not.toBeVisible();
});