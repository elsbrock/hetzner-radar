import { test, expect } from '@playwright/test';

test('analyze: we have data', async ({ page }) => {
  await page.goto('/analyze');
  await page.getByRole('cell', { name: /We have observed \d+ unique/ }).waitFor();
  await expect(page.getByText('Volume', { exact: true })).toBeVisible();
  await expect(page.getByText('Price (€)', { exact: true })).toBeDefined();
  await expect(page.getByLabel('Clear Filter')).not.toBeVisible();
  await page.getByLabel('Save Filter').click();
  await expect(page.getByLabel('Clear Filter')).toBeDefined();
  await page.getByLabel('Clear Filter').click();
  await expect(page.getByLabel('Clear Filter')).not.toBeVisible();
});