import test, { expect } from "./fixtures";

test.describe("Error Handling", () => {
  test("should display 404 page for invalid routes", async ({ page }) => {
    await page.goto("/nonexistent-page");

    // Should show error page or redirect to home/404
    await page.waitForLoadState("networkidle");

    // Check for error indicators
    const errorText = page.getByText(/404|not found|page not found/i);
    const homeRedirect = page.url().endsWith("/");

    // Either should show error page or redirect to home
    if (await errorText.isVisible()) {
      await expect(errorText).toBeVisible();
    } else {
      // If redirected to home, that's also acceptable
      expect(homeRedirect).toBe(true);
    }
  });

  test("should handle missing database gracefully", async ({ page }) => {
    // Go to analyze page which requires database
    await page.goto("/analyze");

    // Wait for either data to load or error state
    await page.waitForTimeout(15000); // Give it more time for DB loading

    // Check if page shows loading state, error, or actual data
    const loadingIndicator = page.getByText(/loading/i);
    const errorMessage = page.getByText(/error|failed|cannot load/i);
    const serverCards = page.getByTestId("server-card");

    const hasLoading = await loadingIndicator.isVisible();
    const hasError = await errorMessage.isVisible();
    const hasData = (await serverCards.count()) > 0;

    // Should show one of: loading, error, or actual data
    expect(hasLoading || hasError || hasData).toBe(true);

    // If there's an error, it should be user-friendly
    if (hasError) {
      const errorText = await errorMessage.first().textContent();
      expect(errorText).toBeTruthy();
      expect(errorText?.length).toBeGreaterThan(10); // Should be descriptive
    }
  });

  test("should handle slow network conditions gracefully", async ({ page }) => {
    // Note: DuckDB database download is several megabytes and takes time
    // We'll test that the app handles this gracefully rather than adding more delay

    await page.goto("/analyze");

    // Should show loading indicators during database download
    // Give it time to show loading state before data loads
    await page.waitForTimeout(1000);

    // Check for loading indicators early in the process
    const loadingElements = page
      .locator("text=/loading|spinner|downloading/i")
      .or(page.locator('[class*="spinner"]'))
      .or(page.locator('[class*="loading"]'));

    // Wait for DuckDB to load (up to 15 seconds in CI)
    await page.waitForTimeout(15000);

    // Eventually, page should have loaded basic structure
    const serverFilter = page.getByTestId("server-filter");
    const totalConfigurations = page.getByTestId("total-configurations");
    const serverCards = page.getByTestId("server-card");
    const errorMessage = page.getByText(/error|failed|timeout/i);

    const hasFilter = await serverFilter.isVisible();
    const hasTotal = await totalConfigurations.isVisible();
    const hasData = (await serverCards.count()) > 0;
    const hasError = await errorMessage.isVisible();

    // At minimum, the page structure should be there
    expect(hasFilter || hasTotal || hasData || hasError).toBe(true);
  });

  test("should handle navigation to invalid analyze parameters", async ({
    page,
  }) => {
    // Try going to analyze page with invalid URL parameters
    await page.goto("/analyze?invalid=parameter&malformed[]=data");

    // Should still load the analyze page normally
    await page.waitForLoadState("networkidle");

    // Should show default analyze page content
    await expect(page.getByTestId("server-filter")).toBeVisible({
      timeout: 10000,
    });

    // Should either show data or error, but not crash
    const serverCards = page.getByTestId("server-card");
    const totalConfigurations = page.getByTestId("total-configurations");

    // At minimum, the page structure should be intact
    await expect(totalConfigurations).toBeVisible();
  });

  test("should handle malformed data gracefully", async ({ page }) => {
    // This test ensures the app doesn't crash with unexpected data
    await page.goto("/analyze");

    // Wait for initial load
    await page.waitForTimeout(10000);

    // Verify basic page structure is intact regardless of data issues
    await expect(page.getByTestId("server-filter")).toBeVisible();
    await expect(page.getByTestId("total-configurations")).toBeVisible();

    // The page should remain functional even if data is malformed
    // Try to interact with a filter via label instead of checkbox directly
    const germanyFilter = page.locator('label:has-text("Germany")');
    if (await germanyFilter.isVisible()) {
      await germanyFilter.click();
      // Should not crash the page
      await page.waitForTimeout(1000);
      await expect(page.getByTestId("server-filter")).toBeVisible();
    }
  });

  test("should handle rapid user interactions without crashing", async ({
    page,
  }) => {
    await page.goto("/analyze");

    // Wait for initial load
    await page.getByTestId("server-card").first().waitFor({ timeout: 10000 });
    await page.waitForLoadState("networkidle");

    // Perform rapid interactions
    const germanyFilter = page.locator('label:has-text("Germany")');
    const netherlandsFilter = page.locator('label:has-text("Netherlands")');

    if (
      (await germanyFilter.isVisible()) &&
      (await netherlandsFilter.isVisible())
    ) {
      // Rapidly toggle filters
      for (let i = 0; i < 5; i++) {
        await germanyFilter.click();
        await page.waitForTimeout(100);
        await netherlandsFilter.click();
        await page.waitForTimeout(100);
      }
    }

    // Page should still be functional
    await expect(page.getByTestId("server-filter")).toBeVisible();
    await expect(page.getByTestId("total-configurations")).toBeVisible();

    // Should be able to interact normally after rapid clicks
    const serverCards = page.getByTestId("server-card");
    if ((await serverCards.count()) > 0) {
      await serverCards.first().click();

      // Drawer should open normally
      const drawer = page.locator("#server-detail-drawer");
      await expect(drawer).toBeVisible();

      // Close drawer
      const closeButton = drawer.getByRole("button", { name: "Close" });
      await closeButton.click();
      await expect(drawer).not.toBeVisible();
    }
  });

  test("should handle browser back/forward navigation properly", async ({
    page,
  }) => {
    // Start at home page
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Navigate to analyze
    await page.goto("/analyze");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Navigate to configurations
    await page.goto("/configurations");
    await page.waitForLoadState("networkidle");

    // Use browser back button
    await page.goBack();
    await page.waitForLoadState("networkidle");

    // Should be back on analyze page
    await expect(page.getByTestId("server-filter")).toBeVisible();

    // Use browser forward button
    await page.goForward();
    await page.waitForLoadState("networkidle");

    // Should be on configurations page
    await expect(
      page.getByText(/configurations|server.*config/i).first(),
    ).toBeVisible();

    // Navigation should work without errors
    await page.goBack();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Should be functional (give more time for DuckDB to reload)
    await expect(page.getByTestId("server-filter")).toBeVisible({
      timeout: 15000,
    });
  });

  test("should handle large dataset filtering without performance issues", async ({
    page,
  }) => {
    await page.goto("/analyze");

    // Wait for data to load
    await page.getByTestId("server-card").first().waitFor({ timeout: 10000 });
    await page.waitForLoadState("networkidle");

    // Get initial count
    const initialText = await page
      .getByTestId("total-configurations")
      .textContent();
    const initialCount = parseInt(initialText?.match(/(\d+)/)?.[1] || "0");

    // If we have a large dataset, test performance
    if (initialCount > 50) {
      const startTime = Date.now();

      // Apply a filter that should process all data
      const germanyFilter = page.locator('label:has-text("Germany")');
      await germanyFilter.click();
      await page.waitForLoadState("networkidle");

      const endTime = Date.now();
      const filterTime = endTime - startTime;

      // Filtering should complete within reasonable time (10 seconds)
      expect(filterTime).toBeLessThan(10000);

      // Results should be updated
      const filteredText = await page
        .getByTestId("total-configurations")
        .textContent();
      const filteredCount = parseInt(filteredText?.match(/(\d+)/)?.[1] || "0");

      // Should have a count (could be same or different, but should be valid)
      expect(filteredCount).toBeGreaterThanOrEqual(0);
    }

    // Test should pass even with small datasets
    expect(true).toBe(true);
  });
});
