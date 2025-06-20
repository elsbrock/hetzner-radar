import test from './fixtures';

test('auth: protected pages', async ({ page }) => {
	await page.goto('/alerts');
	await page.waitForURL('/auth/login');
	await page.goto('/settings');
	await page.waitForURL('/auth/login');
});
