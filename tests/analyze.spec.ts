import test, { expect } from './fixtures';

test('analyze: we have data', async ({ page }) => {
  await page.goto('/analyze');
  await expect(page.getByTestId('server-filter')).toBeVisible();
  await expect(page.getByTestId('server-pricechart')).toBeVisible();
  await page.getByTestId('server-card').first().waitFor({ timeout: 10000});
  await expect(await page.getByTestId('server-card').count()).toBeGreaterThan(0);
  await expect(page.getByTestId('filter-clear')).not.toBeVisible();
  await page.getByTestId('filter-save').click();
  await expect(page.getByTestId('filter-clear')).toBeVisible();
  await page.getByTestId('filter-clear').click();
  await expect(page.getByTestId('filter-clear')).not.toBeVisible();
  await expect(page.getByTestId('total-configurations')).toBeVisible();
});

test('analyze: price filter works', async ({ page }) => {
  await page.goto('/analyze');

  // Wait for initial data load to complete
  await page.getByTestId('server-card').first().waitFor({ timeout: 10000 });

  // Get initial count of servers from the QuickStat component
  const initialResultsText = await page.getByTestId('total-configurations').textContent();
  const initialCount = parseInt(initialResultsText?.match(/(\d+)/)?.[1] || '0');

  // Enter a minimum price to filter servers
  await page.getByTestId('price-min-input').fill('50');

  // Wait for filtering to take effect (using debounce)
  await page.waitForTimeout(600);

  // Verify filtered results
  const minFilteredResultsText = await page.getByTestId('total-configurations').textContent();
  const minFilteredCount = parseInt(minFilteredResultsText?.match(/(\d+)/)?.[1] || '0');

  // The count should be less than or equal to the initial count
  expect(minFilteredCount).toBeLessThanOrEqual(initialCount);

  // Clear min price and add max price
  await page.getByTestId('price-min-input').fill('');
  await page.getByTestId('price-max-input').fill('40');

  // Wait for filtering to take effect
  await page.waitForTimeout(600);

  // Verify max price filtered results
  const maxFilteredResultsText = await page.getByTestId('total-configurations').textContent();
  const maxFilteredCount = parseInt(maxFilteredResultsText?.match(/(\d+)/)?.[1] || '0');

  // Count should be less than or equal to the initial count
  expect(maxFilteredCount).toBeLessThanOrEqual(initialCount);

  // Test min and max together
  await page.getByTestId('price-min-input').fill('35');
  await page.getByTestId('price-max-input').fill('40');

  // Wait for filtering to take effect
  await page.waitForTimeout(600);

  // Verify range filtered results
  const rangeFilteredResultsText = await page.getByTestId('total-configurations').textContent();
  const rangeFilteredCount = parseInt(rangeFilteredResultsText?.match(/(\d+)/)?.[1] || '0');

  // Count should be less than or equal to both the initial and previous filtered counts
  expect(rangeFilteredCount).toBeLessThanOrEqual(initialCount);

  // Clear filters and verify we return to initial state
  await page.getByTestId('price-min-input').fill('');
  await page.getByTestId('price-max-input').fill('');

  // Wait for filtering to take effect
  await page.waitForTimeout(600);

  // Count should return to initial
  const finalResultsText = await page.getByTestId('total-configurations').textContent();
  const finalCount = parseInt(finalResultsText?.match(/(\d+)/)?.[1] || '0');
  expect(finalCount).toEqual(initialCount);
});
