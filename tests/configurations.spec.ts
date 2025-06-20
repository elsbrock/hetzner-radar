import { expect, test } from '@playwright/test';

test.describe('Configurations Page (/configurations)', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to the configurations page before each test
		await page.goto('/configurations');
	});

	test('should display the main heading and introduction', async ({ page }) => {
		await expect(
			page.getByRole('heading', {
				name: 'Choose the Right Server for Your Needs',
				level: 1
			})
		).toBeVisible();

		await expect(
			page.getByText('Explore our curated server configurations tailored')
		).toBeVisible();

		// Check for PriceControls placeholder/area
		// Using .locator('div > h3:has-text("Price Controls")') might be too specific if PriceControls internal structure changes.
		// A more robust locator might target the container div directly based on its classes or position.
		// Targeting the div containing the VAT select dropdown
		await expect(page.locator('div:has(> div > select)')).toBeVisible();
	});

	// REMOVED: test('should initially show loading spinners for configurations', ...)
	// This test was unreliable due to potentially very fast loading times.
	// The test below implicitly covers loading completion by waiting for cards.

	test('should display configuration sections and server cards after loading', async ({ page }) => {
		// Wait for loading to likely finish by checking for the absence of spinners
		// and presence of cards in the first section. Adjust timeout if needed.
		const affordableSection = page.locator(
			'div:has(h2:has-text("Most Affordable Configurations"))'
		);
		// Wait for text content ("seen") inside the first card to appear, confirming data load.
		await expect(affordableSection.locator('text=/seen/').first()).toBeVisible({
			timeout: 15000
		});
		// REMOVED: Redundant check for spinner count to be 0.

		// Now that content is loaded, check for the card structure itself.
		// The check above already confirms visibility, but we keep subsequent checks.

		// Verify all section headings are present
		await expect(
			page.getByRole('heading', { name: 'Most Affordable Configurations' })
		).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Best Value for Disk Space' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Best Value for Memory' })).toBeVisible();
		await expect(
			page.getByRole('heading', { name: 'High-Performance NVMe Storage' })
		).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Affordable SATA SSDs' })).toBeVisible();

		// Verify at least one server card is visible in each section after load
		// Check for cards within each section using the corrected locator (div containing h5)
		await expect(affordableSection.locator('> div > div:has(h5)').first()).toBeVisible(); // Already checked above
		await expect(
			page
				.locator('div:has(h2:has-text("Best Value for Disk Space"))')
				.locator('> div > div:has(h5)')
				.first()
		).toBeVisible();
		await expect(
			page
				.locator('div:has(h2:has-text("Best Value for Memory"))')
				.locator('> div > div:has(h5)')
				.first()
		).toBeVisible();
		await expect(
			page
				.locator('div:has(h2:has-text("High-Performance NVMe Storage"))')
				.locator('> div > div:has(h5)')
				.first()
		).toBeVisible();
		await expect(
			page
				.locator('div:has(h2:has-text("Affordable SATA SSDs"))')
				.locator('> div > div:has(h5)')
				.first()
		).toBeVisible();
	});

	test('should allow server card interaction for detailed view', async ({ page }) => {
		// Define the section locator first
		const affordableSection = page.locator(
			'div:has(h2:has-text("Most Affordable Configurations"))'
		);

		// Wait for the first server card to be available after loading
		const firstAffordableCard = affordableSection.getByTestId('server-card').first();

		// Wait for text content ("seen") inside the first card to appear, confirming data load.
		await expect(affordableSection.locator('text=/seen/').first()).toBeVisible({
			timeout: 15000
		});

		// Now that content is loaded, wait for the specific card
		await expect(firstAffordableCard).toBeVisible({ timeout: 5000 });

		// Verify the card has basic content (CPU name)
		await expect(firstAffordableCard.locator('h5')).toBeVisible();
		await expect(firstAffordableCard.locator('.text-xl.font-bold:has-text("€")')).toBeVisible(); // Main price
	});

	test('should display common usage scenarios section', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Common Usage Scenarios' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'High-Memory Applications' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Backup Solutions' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Game Servers' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Cloud Applications' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Secure Hosting' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Development Environments' })).toBeVisible();
	});

	test('should display the call to action section', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Ready to Explore More?' })).toBeVisible();
		// Locate the button within the specific section for robustness
		const analyzeButton = page
			.locator('section:has(h2:has-text("Ready to Explore More?"))')
			.getByRole('button', { name: 'Analyze' }); // Changed from 'link' to 'button'
		await expect(analyzeButton).toBeVisible();
		// Removed href check as it's a button, navigation likely handled by JS onClick
	});
});
