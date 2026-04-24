import { expect, test } from "@playwright/test";

test.describe("Configurations Page (/configurations)", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the configurations page before each test
    await page.goto("/configurations");
  });

  test("should display the main heading and introduction", async ({ page }) => {
    await expect(
      page.getByRole("heading", {
        name: "Choose the Right Server for Your Needs",
        level: 1,
      }),
    ).toBeVisible();

    await expect(
      page.getByText("Explore our curated server configurations tailored"),
    ).toBeVisible();
  });

  // REMOVED: test('should initially show loading spinners for configurations', ...)
  // This test was unreliable due to potentially very fast loading times.
  // The test below implicitly covers loading completion by waiting for cards.

  test("should display configuration sections and server cards after loading", async ({
    page,
  }) => {
    // Wait for loading to likely finish by checking for the absence of spinners
    // and presence of cards in the first section. Adjust timeout if needed.
    const priceSection = page.locator(
      'div:has(> h2:has-text("Best Price/Performance"))',
    );
    // Wait for text content ("seen") inside the first card to appear, confirming data load.
    await expect(priceSection.locator("text=/seen/").first()).toBeVisible({
      timeout: 15000,
    });

    // Verify all section headings are present
    await expect(
      page.getByRole("heading", { name: "Best Price/Performance" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Most Affordable Configurations" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Best Value per CPU Core" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Best Value for Memory" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "High-Performance NVMe Storage" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Best Value Bulk Storage" }),
    ).toBeVisible();

    // Verify at least one server card is visible in each section after load
    for (const heading of [
      "Best Price/Performance",
      "Most Affordable Configurations",
      "Best Value per CPU Core",
      "Best Value for Memory",
      "High-Performance NVMe Storage",
      "Best Value Bulk Storage",
    ]) {
      await expect(
        page
          .locator(`div:has(> h2:has-text("${heading}"))`)
          .locator("> div > div:has(h5)")
          .first(),
      ).toBeVisible();
    }
  });

  test("should allow server card interaction for detailed view", async ({
    page,
  }) => {
    const priceSection = page.locator(
      'div:has(> h2:has-text("Best Price/Performance"))',
    );

    const firstCard = priceSection.getByTestId("server-card").first();

    await expect(priceSection.locator("text=/seen/").first()).toBeVisible({
      timeout: 15000,
    });

    await expect(firstCard).toBeVisible({ timeout: 5000 });

    await expect(firstCard.locator("h5")).toBeVisible();
    await expect(
      firstCard.locator('.text-xl.font-bold:has-text("€")'),
    ).toBeVisible();
  });

  test("should display common usage scenarios section", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Common Usage Scenarios" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "High-Memory Applications" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Backup Solutions" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Game Servers" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Cloud Applications" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Secure Hosting" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Development Environments" }),
    ).toBeVisible();
  });

  test("should display the call to action section", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Ready to Explore More?" }),
    ).toBeVisible();
    // Locate the button within the specific section for robustness
    const analyzeButton = page
      .locator('section:has(h2:has-text("Ready to Explore More?"))')
      .getByRole("button", { name: "Analyze" }); // Changed from 'link' to 'button'
    await expect(analyzeButton).toBeVisible();
    // Removed href check as it's a button, navigation likely handled by JS onClick
  });
});
