import test, { expect } from "./fixtures";

// Critical CI test suite - only the most essential tests for deployment confidence
test.describe("Critical CI Tests", () => {
  test("analyze page loads with data", async ({ page }) => {
    await page.goto("/analyze");

    // Wait for DuckDB to load
    await page.getByTestId("server-card").first().waitFor({ timeout: 30000 });
    await page.waitForLoadState("networkidle");

    // Verify basic functionality
    await expect(page.getByTestId("server-filter")).toBeVisible();
    await expect(page.getByTestId("total-configurations")).toBeVisible();
    await expect(await page.getByTestId("server-card").count()).toBeGreaterThan(
      0,
    );
  });

  test("basic filtering works", async ({ page }) => {
    await page.goto("/analyze");

    // Wait for initial load
    await page.getByTestId("server-card").first().waitFor({ timeout: 30000 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Get initial count
    const initialResultsText = await page
      .getByTestId("total-configurations")
      .textContent();
    const initialCount = parseInt(
      initialResultsText?.match(/(\d+)/)?.[1] || "0",
    );

    // Apply Germany filter
    const germanyLabel = page.locator('label:has-text("Germany")');
    await germanyLabel.click();

    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Verify filtering worked
    const filteredResultsText = await page
      .getByTestId("total-configurations")
      .textContent();
    const filteredCount = parseInt(
      filteredResultsText?.match(/(\d+)/)?.[1] || "0",
    );

    // Count should have changed
    expect(filteredCount).not.toEqual(initialCount);
  });

  test("server detail drawer opens", async ({ page }) => {
    await page.goto("/analyze");

    // Wait for data load
    await page.getByTestId("server-card").first().waitFor({ timeout: 30000 });
    await page.waitForLoadState("networkidle");

    // Click first server card
    await page.getByTestId("server-card").first().click();

    // Verify drawer opens
    const drawer = page.locator("#server-detail-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Server Details")).toBeVisible();
  });

  test("handles 404 gracefully", async ({ page }) => {
    await page.goto("/nonexistent-page");
    await page.waitForLoadState("networkidle");

    // Should show error or redirect to home
    const errorText = page.getByText(/404|not found/i);
    const homeRedirect = page.url().endsWith("/");

    const hasError = await errorText.isVisible();
    expect(hasError || homeRedirect).toBe(true);
  });
});
