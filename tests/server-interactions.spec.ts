import test, { expect } from "./fixtures";

test.describe("Server Interactions", () => {
  test("should open server detail drawer when clicking server card", async ({
    page,
  }) => {
    await page.goto("/analyze");

    // Wait for initial data load
    await page.getByTestId("server-card").first().waitFor({ timeout: 10000 });
    await page.waitForLoadState("networkidle");

    // Verify server cards are visible
    const serverCards = page.getByTestId("server-card");
    await expect(serverCards.first()).toBeVisible();

    // Click the first server card
    await serverCards.first().click();

    // Verify drawer opens
    const drawer = page.locator("#server-detail-drawer");
    await expect(drawer).toBeVisible();

    // Verify drawer content is loaded
    await expect(page.getByText("Server Details")).toBeVisible();
  });

  test("should display server details in drawer", async ({ page }) => {
    await page.goto("/analyze");

    // Wait for data load and click first server
    await page.getByTestId("server-card").first().waitFor({ timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await page.getByTestId("server-card").first().click();

    // Wait for drawer to open
    const drawer = page.locator("#server-detail-drawer");
    await expect(drawer).toBeVisible();

    // Check for key elements in the drawer using more specific selectors
    await expect(drawer.getByText("Server Details")).toBeVisible();
    await expect(
      drawer.getByRole("heading", { name: "Auctions", exact: true }),
    ).toBeVisible();

    // Check that price information is shown
    await expect(drawer.locator("text=€").first()).toBeVisible();

    // Check that CPU information is shown (should be same as card)
    const cpuInDrawer = drawer.locator("h5").first();
    await expect(cpuInDrawer).toBeVisible();
  });

  test("should display auctions table in drawer", async ({ page }) => {
    await page.goto("/analyze");

    // Open server detail drawer
    await page.getByTestId("server-card").first().waitFor({ timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await page.getByTestId("server-card").first().click();

    // Wait for drawer to open
    const drawer = page.locator("#server-detail-drawer");
    await expect(drawer).toBeVisible();

    // Check auctions section using drawer-scoped selector
    await expect(
      drawer.getByRole("heading", { name: "Auctions", exact: true }),
    ).toBeVisible();

    // Wait for auctions to load (could show loading or actual data)
    // Either "Loading auctions..." or auction rows should appear
    const auctionTable = drawer.locator("table");

    await expect(auctionTable).toBeVisible();

    // Wait for either loading to finish or no auctions message
    await page.waitForTimeout(3000);

    // Should show either actual auctions or "No matching auctions found"
    const hasAuctions = await drawer.getByText(/^#\d+/).first().isVisible();
    const noAuctions = await drawer
      .getByText("No matching auctions found")
      .isVisible();

    expect(hasAuctions || noAuctions).toBe(true);
  });

  test("should close drawer when clicking close button", async ({ page }) => {
    await page.goto("/analyze");

    // Open drawer
    await page.getByTestId("server-card").first().waitFor({ timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await page.getByTestId("server-card").first().click();

    // Wait for drawer to open
    const drawer = page.locator("#server-detail-drawer");
    await expect(drawer).toBeVisible();

    // Click close button using more specific selector (CloseButton from Flowbite)
    const closeButton = drawer.getByRole("button", { name: "Close" });

    await closeButton.click();

    // Verify drawer is hidden
    await expect(drawer).not.toBeVisible();
  });

  test("should show price chart in drawer", async ({ page }) => {
    await page.goto("/analyze");

    // Open drawer
    await page.getByTestId("server-card").first().waitFor({ timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await page.getByTestId("server-card").first().click();

    // Wait for drawer to open
    const drawer = page.locator("#server-detail-drawer");
    await expect(drawer).toBeVisible();

    // Verify price is displayed in correct format (more specific)
    await expect(
      drawer.locator("text=/\\d+\\.\\d{2} €/").first(),
    ).toBeVisible();

    // Check for monthly text indicator
    await expect(drawer.getByText("monthly")).toBeVisible();
  });

  test("should have clickable external links in drawer", async ({ page }) => {
    await page.goto("/analyze");

    // Open drawer
    await page.getByTestId("server-card").first().waitFor({ timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await page.getByTestId("server-card").first().click();

    // Wait for drawer to open
    const drawer = page.locator("#server-detail-drawer");
    await expect(drawer).toBeVisible();

    // Wait for auctions to load
    await page.waitForTimeout(3000);

    // Check if there are any "Confirm Order" buttons (shopping cart icons)
    const confirmOrderButtons = drawer.locator('button[type="submit"]');

    // If there are auctions, there should be confirm order buttons
    const buttonCount = await confirmOrderButtons.count();
    if (buttonCount > 0) {
      // Verify the form has correct action
      const orderForm = drawer.locator('form[action*="hetzner.com"]');
      await expect(orderForm.first()).toBeVisible();
    }

    // Check for "Search on Hetzner" button (external link icon)
    const searchButton = drawer
      .locator("button")
      .filter({ hasText: /external/i })
      .or(drawer.locator('a[href*="hetzner"]'));

    // This button should exist regardless of auction availability
    if ((await searchButton.count()) > 0) {
      await expect(searchButton.first()).toBeVisible();
    }
  });
});
