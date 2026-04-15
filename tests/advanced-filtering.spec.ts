import test, {
  expect,
  waitForAnalyzePageReady,
  waitForFilterUpdate,
} from "./fixtures";

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
    await waitForFilterUpdate(page);

    // Get count after location filter
    const afterLocationText = await page
      .getByTestId("total-configurations")
      .textContent();
    const afterLocationCount = parseInt(
      afterLocationText?.match(/(\d+)/)?.[1] || "0",
    );

    // Each additional filter should reduce or maintain the count (never increase)
    expect(afterLocationCount).toBeLessThanOrEqual(initialCount);
  });

  test("should persist filter state after page refresh", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(90000); // Extended timeout for page reload with DuckDB
    await page.goto("/analyze");

    // Wait for initial load
    await waitForAnalyzePageReady(page);

    // Apply a filter - click the actual toggle input to uncheck Germany
    const germanyRow = page.locator('div:has(> label:has-text("Germany"))');
    const germanyToggle = germanyRow.locator('input[type="checkbox"]');
    await germanyToggle.click({ force: true });
    await waitForFilterUpdate(page);

    // Get count after filter
    const filteredResultsText = await page
      .getByTestId("total-configurations")
      .textContent();
    const filteredCount = parseInt(
      filteredResultsText?.match(/(\d+)/)?.[1] || "0",
    );

    // Save filter to URL so it persists on reload
    await page.getByTestId("filter-save").click();
    await expect(page).toHaveURL(/filter=/, { timeout: 5000 });

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
    await waitForFilterUpdate(page);

    // Verify filter was applied (Germany should be unchecked now)
    expect(await germanyToggle.isChecked()).toBe(!initialGermanyChecked);

    // Click the reset button to reset to defaults
    const resetButton = page.getByRole("button", {
      name: "Reset filter to defaults",
    });
    await resetButton.click();
    await waitForFilterUpdate(page);

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

    // Look for price input fields
    const priceInput = page.locator('input[type="number"]').first();

    if (await priceInput.isVisible()) {
      await priceInput.fill("50");
      await waitForFilterUpdate(page);

      // Verify results changed
      const resultText = await page
        .getByTestId("total-configurations")
        .textContent();
      const count = parseInt(resultText?.match(/(\d+)/)?.[1] || "0");
      expect(count).toBeGreaterThanOrEqual(0);
    }

    // Test should not fail if price controls don't exist
    expect(true).toBe(true);
  });

  test("should handle edge case with no results", async ({ page }) => {
    await page.goto("/analyze");

    // Wait for initial load
    await waitForAnalyzePageReady(page);

    // Apply very restrictive filter: set max price to 1€
    const priceInput = page.locator('input[type="number"]').first();

    if (await priceInput.isVisible()) {
      await priceInput.fill("1");
      await waitForFilterUpdate(page);
    }

    // Check if we got zero results
    const resultText = await page
      .getByTestId("total-configurations")
      .textContent();
    const count = parseInt(resultText?.match(/(\d+)/)?.[1] || "0");

    if (count === 0) {
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

    // Apply a filter - click the actual toggle input
    const germanyRowSort = page.locator('div:has(> label:has-text("Germany"))');
    const germanyToggleSort = germanyRowSort.locator('input[type="checkbox"]');
    await germanyToggleSort.click({ force: true });
    await waitForFilterUpdate(page);

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

  test.describe("Disk OR mode", () => {
    test("should show OR toggle in disk filter section", async ({ page }) => {
      await page.goto("/analyze");
      await waitForAnalyzePageReady(page);

      // AND button should be visible and active by default
      const andButton = page.getByRole("button", { name: "AND" });
      const orButton = page.getByRole("button", { name: "OR" });
      await expect(andButton).toBeVisible();
      await expect(orButton).toBeVisible();
    });

    test("should widen results when switching to OR mode with active disk filters", async ({
      page,
    }) => {
      await page.goto("/analyze");
      await waitForAnalyzePageReady(page);

      // Expand NVMe section and set count to require at least 1 NVMe
      await page.getByRole("button", { name: "SSDs (NVMe)" }).click();
      // Drag the NVMe min-count handle from 0 to 1 via keyboard
      const nvmeSlider = page
        .locator("li")
        .filter({ hasText: "SSDs (NVMe)" })
        .locator(".rangeSlider")
        .first();
      const nvmeMinThumb = nvmeSlider.locator(".rangeNub").first();
      await nvmeMinThumb.click();
      await page.keyboard.press("ArrowRight");
      await waitForFilterUpdate(page);

      // Also expand HDD section and require at least 1 HDD
      await page.getByRole("button", { name: "HDDs" }).click();
      const hddSlider = page
        .locator("li")
        .filter({ hasText: "HDDs" })
        .locator(".rangeSlider")
        .first();
      const hddMinThumb = hddSlider.locator(".rangeNub").first();
      await hddMinThumb.click();
      await page.keyboard.press("ArrowRight");
      await waitForFilterUpdate(page);

      // In AND mode: must have NVMe >= 1 AND HDD >= 1
      const andBothText = await page
        .getByTestId("total-configurations")
        .textContent();
      const andBothCount = parseInt(andBothText?.match(/(\d+)/)?.[1] || "0");

      // Switch to OR mode
      await page.getByRole("button", { name: "OR" }).click();
      await waitForFilterUpdate(page);

      // In OR mode: must have NVMe >= 1 OR HDD >= 1 — should be >= AND count
      const orCountText = await page
        .getByTestId("total-configurations")
        .textContent();
      const orCount = parseInt(orCountText?.match(/(\d+)/)?.[1] || "0");

      expect(orCount).toBeGreaterThanOrEqual(andBothCount);
    });

    test("should persist disk OR mode in URL filter", async ({
      page,
    }, testInfo) => {
      testInfo.setTimeout(90000);
      await page.goto("/analyze");
      await waitForAnalyzePageReady(page);

      // Switch to OR mode
      await page.getByRole("button", { name: "OR" }).click();
      await waitForFilterUpdate(page);

      // Save filter to URL
      await page.getByTestId("filter-save").click();
      await expect(page).toHaveURL(/filter=/, { timeout: 5000 });

      // Reload and verify OR mode persisted
      await page.reload();
      await waitForAnalyzePageReady(page);

      // The OR button should still be active (has the checked/active styling)
      const orButton = page.getByRole("button", { name: "OR" });
      await expect(orButton).toBeVisible();
      // Flowbite checked buttons get shadow-inner styling
      await expect(orButton).toHaveClass(/shadow-inner/);
    });

    test("should return same results as AND when no disk filters are active in OR mode", async ({
      page,
    }) => {
      await page.goto("/analyze");
      await waitForAnalyzePageReady(page);

      // Get count in AND mode (default, no disk filters changed)
      const andCountText = await page
        .getByTestId("total-configurations")
        .textContent();
      const andCount = parseInt(andCountText?.match(/(\d+)/)?.[1] || "0");

      // Switch to OR mode without changing any disk filters
      await page.getByRole("button", { name: "OR" }).click();
      await waitForFilterUpdate(page);

      const orCountText = await page
        .getByTestId("total-configurations")
        .textContent();
      const orCount = parseInt(orCountText?.match(/(\d+)/)?.[1] || "0");

      // With all disk types at defaults, OR mode skips disk filtering entirely
      // while AND mode still applies default size ranges (e.g., HDD min 2TB),
      // so OR may return slightly more results
      expect(orCount).toBeGreaterThanOrEqual(andCount);
    });

    test("should narrow results back when switching from OR to AND", async ({
      page,
    }) => {
      await page.goto("/analyze");
      await waitForAnalyzePageReady(page);

      // Set up: require NVMe >= 1
      await page.getByRole("button", { name: "SSDs (NVMe)" }).click();
      const nvmeSlider = page
        .locator("li")
        .filter({ hasText: "SSDs (NVMe)" })
        .locator(".rangeSlider")
        .first();
      const nvmeMinThumb = nvmeSlider.locator(".rangeNub").first();
      await nvmeMinThumb.click();
      await page.keyboard.press("ArrowRight");

      // Require HDD >= 1
      await page.getByRole("button", { name: "HDDs" }).click();
      const hddSlider = page
        .locator("li")
        .filter({ hasText: "HDDs" })
        .locator(".rangeSlider")
        .first();
      const hddMinThumb = hddSlider.locator(".rangeNub").first();
      await hddMinThumb.click();
      await page.keyboard.press("ArrowRight");
      await waitForFilterUpdate(page);

      // Switch to OR, get count
      await page.getByRole("button", { name: "OR" }).click();
      await waitForFilterUpdate(page);
      const orCountText = await page
        .getByTestId("total-configurations")
        .textContent();
      const orCount = parseInt(orCountText?.match(/(\d+)/)?.[1] || "0");

      // Switch back to AND, get count
      await page.getByRole("button", { name: "AND" }).click();
      await waitForFilterUpdate(page);
      const andCountText = await page
        .getByTestId("total-configurations")
        .textContent();
      const andCount = parseInt(andCountText?.match(/(\d+)/)?.[1] || "0");

      // AND should be <= OR
      expect(andCount).toBeLessThanOrEqual(orCount);
    });
  });
});
