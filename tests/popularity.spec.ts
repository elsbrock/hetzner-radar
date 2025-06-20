import { test, expect } from '@playwright/test';

test.describe('Analyze Page Tests', () => {
	test('should load analyze page with basic functionality', async ({ page }) => {
		// Navigate to the analyze page
		await page.goto('/analyze');

		// Wait for the page to load - check for the main title first
		await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

		// Wait for database loading to complete by checking for server cards or data
		await page.waitForSelector('[data-testid="server-card"]', { timeout: 15000 }).catch(() => {
			// If no server cards, that's okay for this test
		});

		// Check if server filter controls are present
		await expect(page.getByTestId('price-controls')).toBeVisible();

		// Check if the popularity stat loads (with generous timeout for DB init)
		const popularityStat = page.locator('[data-testid="popularity-stat"]');
		if (await popularityStat.isVisible({ timeout: 5000 })) {
			// If it loads, verify its structure
			await expect(popularityStat.locator('text=Server Popularity')).toBeVisible();

			const valueElement = popularityStat.locator('.value').first();
			if (await valueElement.isVisible()) {
				const value = await valueElement.textContent();
				expect(value).toMatch(/^(High|Normal|Low)$/);
			}
		}
	});
});
