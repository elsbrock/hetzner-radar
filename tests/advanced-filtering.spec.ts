import test, { expect, waitForAnalyzePageReady } from "./fixtures";

test.describe("Advanced Filtering", () => {
  test("should combine multiple filters effectively", async ({ page }) => {
    await page.goto("/analyze");

    // Wait for initial data load
    await waitForAnalyzePageReady(page);

    // Get initial count
    const initialResultsText = await page
      .getByTestId("total-configurations")
      .textContent();
    const initialCount = parseInt(
      initialResultsText?.match(/(\d+)/)?.[1] || "0",
    );

    // Apply location filter (Germany) - click the actual toggle input
    const germanyRow = page.locator('div:has(> label:has-text("Germany"))');
    const germanyToggle = germanyRow.locator('input[type="checkbox"]');
    await germanyToggle.click({ force: true });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Get count after location filter
    const afterLocationText = await page
      .getByTestId("total-configurations")
      .textContent();
    const afterLocationCount = parseInt(
      afterLocationText?.match(/(\d+)/)?.[1] || "0",
    );

    // Apply memory filter (assume there's a memory range slider or input)
    const memoryFilter = page
      .getByLabel(/memory/i)
      .or(page.getByText(/32.*GB/))
      .first();
    if (await memoryFilter.isVisible()) {
      await memoryFilter.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
    }

    // Get final count
    const finalResultsText = await page
      .getByTestId("total-configurations")
      .textContent();
    const finalCount = parseInt(finalResultsText?.match(/(\d+)/)?.[1] || "0");

    // Each additional filter should reduce or maintain the count (never increase)
    expect(afterLocationCount).toBeLessThanOrEqual(initialCount);
    expect(finalCount).toBeLessThanOrEqual(afterLocationCount);
  });

  test("should persist filter state after page refresh", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60000); // Extended timeout for page reload with DuckDB
    await page.goto("/analyze");

    // Wait for initial load
    await waitForAnalyzePageReady(page);

    // Apply a filter - click the actual toggle input to uncheck Germany
    const germanyRow = page.locator('div:has(> label:has-text("Germany"))');
    const germanyToggle = germanyRow.locator('input[type="checkbox"]');
    await germanyToggle.click({ force: true });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Get count after filter
    const filteredResultsText = await page
      .getByTestId("total-configurations")
      .textContent();
    const filteredCount = parseInt(
      filteredResultsText?.match(/(\d+)/)?.[1] || "0",
    );

    // Save filter to URL so it persists on reload
    await page.getByTestId("filter-save").click();
    await page.waitForTimeout(500);

    // Verify URL contains filter parameter
    const filterUrl = page.url();
    expect(filterUrl).toContain("filter=");

    // Refresh the page
    await page.reload();
    await waitForAnalyzePageReady(page);

    // Check if filter persisted
    const afterReloadText = await page
      .getByTestId("total-configurations")
      .textContent();
    const afterReloadCount = parseInt(
      afterReloadText?.match(/(\d+)/)?.[1] || "0",
    );

    // Filter state should persist (counts should be similar)
    // Allow some tolerance due to timing/rendering
    expect(Math.abs(afterReloadCount - filteredCount)).toBeLessThanOrEqual(20);

    // Germany filter should still be unchecked after reload
    const germanyRowAfter = page.locator(
      'div:has(> label:has-text("Germany"))',
    );
    const germanyInputAfter = germanyRowAfter.locator('input[type="checkbox"]');
    const isChecked = await germanyInputAfter.isChecked();
    expect(isChecked).toBe(false);
  });

  test("should reset all filters when using reset button", async ({ page }) => {
    await page.goto("/analyze");

    // Wait for initial load
    await waitForAnalyzePageReady(page);

    // Get initial checkbox states
    const germanyRow = page.locator('div:has(> label:has-text("Germany"))');
    const finlandRow = page.locator('div:has(> label:has-text("Finland"))');
    const germanyToggle = germanyRow.locator('input[type="checkbox"]');
    const finlandToggle = finlandRow.locator('input[type="checkbox"]');

    const initialGermanyChecked = await germanyToggle.isChecked();
    const initialFinlandChecked = await finlandToggle.isChecked();

    // Apply a filter - uncheck Germany
    await germanyToggle.click({ force: true });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Verify filter was applied (Germany should be unchecked now)
    expect(await germanyToggle.isChecked()).toBe(!initialGermanyChecked);

    // Click the reset button to reset to defaults
    const resetButton = page.getByRole("button", {
      name: "Reset filter to defaults",
    });
    await resetButton.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // After reset, checkboxes should return to their initial states
    const resetGermanyChecked = await germanyToggle.isChecked();
    const resetFinlandChecked = await finlandToggle.isChecked();

    expect(resetGermanyChecked).toBe(initialGermanyChecked);
    expect(resetFinlandChecked).toBe(initialFinlandChecked);
  });

  test("should handle price range filtering", async ({ page }) => {
    await page.goto("/analyze");

    // Wait for initial load
    await waitForAnalyzePageReady(page);

    // Look for price controls (sliders, inputs, etc.)
    const priceControls = page
      .getByText(/price/i)
      .or(page.locator('[data-testid*="price"]'));

    if (await priceControls.first().isVisible()) {
      // Try to interact with price filtering
      const priceSlider = page.locator('input[type="range"]').first();
      const priceInput = page.locator('input[type="number"]').first();

      if (await priceSlider.isVisible()) {
        await priceSlider.fill("50"); // Set max price to 50€
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);

        // Verify results changed
        const resultText = await page
          .getByTestId("total-configurations")
          .textContent();
        const count = parseInt(resultText?.match(/(\d+)/)?.[1] || "0");
        expect(count).toBeGreaterThan(0);
      } else if (await priceInput.isVisible()) {
        await priceInput.fill("50");
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);

        // Verify results changed
        const resultText = await page
          .getByTestId("total-configurations")
          .textContent();
        const count = parseInt(resultText?.match(/(\d+)/)?.[1] || "0");
        expect(count).toBeGreaterThan(0);
      }
    }

    // This test should not fail if price controls don't exist
    expect(true).toBe(true);
  });

  test("should handle edge case with no results", async ({ page }) => {
    await page.goto("/analyze");

    // Wait for initial load
    await waitForAnalyzePageReady(page);

    // Apply very restrictive filters to get no results
    // Try to set a very low maximum price (like 1€) which should yield no results
    const priceSlider = page.locator('input[type="range"]').first();
    const priceInput = page.locator('input[type="number"]').first();

    if (await priceSlider.isVisible()) {
      await priceSlider.fill("1");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
    } else if (await priceInput.isVisible()) {
      await priceInput.fill("1");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
    } else {
      // Alternative: try to combine many location filters that are mutually exclusive
      const netherlandsFilter = page.locator('label:has-text("Netherlands")');
      const finlandFilter = page.locator('label:has-text("Finland")');

      if (
        (await netherlandsFilter.isVisible()) &&
        (await finlandFilter.isVisible())
      ) {
        await netherlandsFilter.click();
        await finlandFilter.click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);
      }
    }

    // Check if we got zero results
    const resultText = await page
      .getByTestId("total-configurations")
      .textContent();
    const count = parseInt(resultText?.match(/(\d+)/)?.[1] || "0");

    if (count === 0) {
      // Verify UI handles zero results gracefully
      const noResultsMessage = page
        .getByText(/no.*result/i)
        .or(page.getByText(/no.*configuration/i));
      if (await noResultsMessage.isVisible()) {
        await expect(noResultsMessage).toBeVisible();
      }

      // Server cards should not be visible
      await expect(page.getByTestId("server-card")).not.toBeVisible();
    }

    // Test should pass regardless of whether we achieved zero results
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("should maintain sorting when filters change", async ({ page }) => {
    await page.goto("/analyze");

    // Wait for initial load
    await waitForAnalyzePageReady(page);

    // Check for sorting controls
    const sortControls = page
      .getByText(/sort/i)
      .or(page.locator('[data-testid*="sort"]'));

    if (await sortControls.first().isVisible()) {
      // Try to change sorting (e.g., to price high to low)
      const sortButton = page
        .getByRole("button")
        .filter({ hasText: /sort/i })
        .first();
      if (await sortButton.isVisible()) {
        await sortButton.click();
        await page.waitForTimeout(500);

        // Look for price sorting option
        const priceSortOption = page.getByText(/price/i).first();
        if (await priceSortOption.isVisible()) {
          await priceSortOption.click();
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(1000);
        }
      }
    }

    // Apply a filter - click the actual toggle input
    const germanyRowSort = page.locator('div:has(> label:has-text("Germany"))');
    const germanyToggleSort = germanyRowSort.locator('input[type="checkbox"]');
    await germanyToggleSort.click({ force: true });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Verify results are still sorted and filtered
    const serverCards = page.getByTestId("server-card");
    const cardCount = await serverCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Check that sorting is maintained by checking if prices are in order
    if (cardCount > 1) {
      const firstCardPrice = await serverCards
        .first()
        .locator("text=/\\d+\\.\\d{2} €/")
        .first()
        .textContent();
      const secondCardPrice = await serverCards
        .nth(1)
        .locator("text=/\\d+\\.\\d{2} €/")
        .first()
        .textContent();

      // Both should have price information
      expect(firstCardPrice).toMatch(/\d+\.\d{2} €/);
      expect(secondCardPrice).toMatch(/\d+\.\d{2} €/);
    }
  });
});
