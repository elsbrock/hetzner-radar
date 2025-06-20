// tests/fixtures.ts
import { test as base, expect, type _Page } from '@playwright/test';

type ErrorTracking = {
	consoleErrors: string[];
	http404s: string[];
};

// Extend the base test with custom fixtures
const test = base.extend<ErrorTracking>({
	consoleErrors: async ({ page }, use) => {
		const errors: string[] = [];

		// Listen to console events
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				errors.push(msg.text());
			}
		});

		await use(errors);
	},
	http404s: async ({ page }, use) => {
		const notFoundUrls: string[] = [];

		// Listen to response events
		page.on('response', (response) => {
			if (response.status() === 404) {
				notFoundUrls.push(response.url());
			}
		});

		await use(notFoundUrls);
	}
});

// After each test, check for errors and 404s
test.afterEach(async ({ consoleErrors, http404s }, testInfo) => {
	if (consoleErrors.length > 0 || http404s.length > 0) {
		const errorMessages = [
			...consoleErrors.map((err) => `Console error: ${err}`),
			...http404s.map((url) => `404 Not Found: ${url}`)
		].join('\n');

		// Fail the test with detailed error messages
		throw new Error(`Test "${testInfo.title}" encountered issues:\n${errorMessages}`);
	}
});

export default test;
export { expect };
