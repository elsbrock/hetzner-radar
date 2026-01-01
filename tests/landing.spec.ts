import test, { expect, type Page } from "./fixtures"; // Use shared fixtures with Playwright types

test.describe("Landing Page Tests", () => {
  let page: Page;

  // Use beforeAll to navigate once and capture initial load errors
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto("/");
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("should have the correct page title", async () => {
    await expect(page).toHaveTitle(
      /Server Radar – Find Best Deals on Hetzner Dedicated Servers/,
    );
  });

  test("should display the main heading", async () => {
    // Target the h1 and check its text content
    await expect(page.locator("h1")).toContainText(
      /Hetzner market data, visualized/i,
    );
  });

  test("should display key introductory text", async () => {
    await expect(page.getByText(/free, open-source tool/i)).toBeVisible();
    await expect(page.getByText(/check cloud availability/i)).toBeVisible();
  });

  test("should display primary call-to-action buttons", async () => {
    await expect(page.getByTestId("cta-get-started")).toBeVisible();
    await expect(page.getByTestId("cta-view-github")).toBeVisible();
  });

  test("should display navigation links (unauthenticated)", async () => {
    // Check if navigation might be collapsed - open it if needed
    const hamburger = page.getByTestId("nav-hamburger");
    if (await hamburger.isVisible()) {
      await hamburger.click();
      await page.waitForTimeout(300); // Wait for animation
    }

    // Test IDs added to NavLi elements
    await expect(page.getByTestId("nav-link-home")).toBeVisible();
    await expect(page.getByTestId("nav-link-configurations")).toBeVisible();
    await expect(page.getByTestId("nav-link-analyze")).toBeVisible();

    // Statistics and About are only visible when not authenticated
    // Wait a bit longer for them to appear if needed
    await expect(page.getByTestId("nav-link-statistics")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("nav-link-about")).toBeVisible();

    // Sign in button might be desktop or mobile specific
    // Check that exactly one of the sign-in buttons (desktop or mobile) is visible
    const signInButton = page
      .getByTestId("nav-signin-desktop")
      .or(page.getByTestId("nav-signin-mobile"));
    await expect(
      signInButton.filter({ has: page.locator(":visible") }),
    ).toHaveCount(1);
  });

  test("should display key feature sections", async () => {
    await expect(page.getByRole("heading", { name: "Features" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Dedicated Server Auctions" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Cloud Server Availability" }),
    ).toBeVisible();
  });

  test("should display feature details", async () => {
    // Check for feature details in the cards
    await expect(page.getByText(/Filter by CPU, RAM, storage/i)).toBeVisible();
    await expect(page.getByText(/Historical price charts/i)).toBeVisible();
    await expect(
      page.getByText(/Price alerts via email or Discord/i),
    ).toBeVisible();
  });

  test("should display live metrics section", async () => {
    // Check the containers for the stats using test IDs with increased timeout
    const glanceTimeout = { timeout: 10000 }; // 10 seconds
    await expect(page.getByTestId("glance-auctions-tracked")).toBeVisible(
      glanceTimeout,
    );
    await expect(page.getByTestId("glance-last-batch")).toBeVisible(
      glanceTimeout,
    );
    await expect(page.getByTestId("glance-active-users")).toBeVisible(
      glanceTimeout,
    );
    await expect(page.getByTestId("glance-active-alerts")).toBeVisible(
      glanceTimeout,
    );
    await expect(page.getByTestId("glance-notifications-sent")).toBeVisible(
      glanceTimeout,
    );
  });

  test("should display footer links", async () => {
    // Use test IDs for footer links and copyright
    await expect(page.getByTestId("footer-link-cloud-status")).toBeVisible();
    await expect(page.getByTestId("footer-link-privacy")).toBeVisible();
    await expect(page.getByTestId("footer-link-terms")).toBeVisible();
    await expect(page.getByTestId("footer-link-contact")).toBeVisible();
    await expect(page.getByTestId("footer-copyright")).toBeVisible();
  });

  // Optional: Basic Mobile View Check
  test.describe("Mobile Viewport", () => {
    // Use a separate page instance for viewport tests to avoid interference
    test("should display main heading and hamburger menu on mobile", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/");
      // Target the h1 and check its text content
      await expect(page.locator("h1")).toContainText(
        /Hetzner market data, visualized/i,
      );
      // Check for the hamburger menu button using test ID
      await expect(page.getByTestId("nav-hamburger")).toBeVisible();
    });
  });
});
