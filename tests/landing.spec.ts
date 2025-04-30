import test, { expect } from './fixtures';

test('landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Stop Overpaying' })).toBeVisible();
});
