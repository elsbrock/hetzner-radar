import { expect, test } from '@playwright/test';

test('landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Find the Best Deals on' })).toBeVisible();
  await expect(page.getByText('Server Radar monitors Hetzner')).toBeVisible();
});