// tests/fixtures.ts
import { test as base, expect, type Page } from "@playwright/test";

type ErrorTracking = {
  consoleErrors: string[];
  http404s: string[];
};

/**
 * Helper to wait for the analyze page to be fully loaded and ready.
 * This waits for the DuckDB database to load and content to appear.
 */
export async function waitForAnalyzePageReady(
  page: Page,
  options: { timeout?: number; requireCards?: boolean } = {},
): Promise<void> {
  const timeout = options.timeout ?? 45000;
  const requireCards = options.requireCards ?? true;

  // First, wait for the loading spinner to disappear (if it appears)
  // The spinner shows "Loading..." text
  const loadingSpinner = page.getByText("Loading...");

  // Wait for either:
  // 1. Loading spinner to appear then disappear, OR
  // 2. Server cards to appear directly (if loading was fast)
  try {
    // Give a short time for loading spinner to potentially appear
    await loadingSpinner.waitFor({ state: "visible", timeout: 5000 });
    // If it appeared, wait for it to disappear
    await loadingSpinner.waitFor({ state: "hidden", timeout: timeout - 5000 });
  } catch {
    // Loading spinner didn't appear or was too fast - that's fine
  }

  // Wait for either server cards or the total configurations counter
  // (which appears even when there are 0 results)
  if (requireCards) {
    // Try to wait for server cards, but if they don't appear quickly,
    // check if the page is actually loaded with 0 results
    try {
      await page.getByTestId("server-card").first().waitFor({ timeout: 15000 });
    } catch {
      // No server cards found - verify page is still loaded by checking for filter controls
      await page
        .getByTestId("total-configurations")
        .waitFor({ timeout: timeout - 15000 });
    }
  } else {
    // Just wait for the total configurations counter to confirm page is loaded
    await page.getByTestId("total-configurations").waitFor({ timeout });
  }

  await page.waitForLoadState("networkidle");
}

// Extend the base test with custom fixtures
const test = base.extend<ErrorTracking>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];

    // Listen to console events
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await use(errors);
  },
  http404s: async ({ page }, use) => {
    const notFoundUrls: string[] = [];

    // Listen to response events
    page.on("response", (response) => {
      if (response.status() === 404) {
        notFoundUrls.push(response.url());
      }
    });

    await use(notFoundUrls);
  },
});

// After each test, check for errors and 404s
test.afterEach(async ({ consoleErrors, http404s }, testInfo) => {
  if (consoleErrors.length > 0 || http404s.length > 0) {
    const errorMessages = [
      ...consoleErrors.map((err) => `Console error: ${err}`),
      ...http404s.map((url) => `404 Not Found: ${url}`),
    ].join("\n");

    // Fail the test with detailed error messages
    throw new Error(
      `Test "${testInfo.title}" encountered issues:\n${errorMessages}`,
    );
  }
});

export default test;
export { expect };
export type { Page };
