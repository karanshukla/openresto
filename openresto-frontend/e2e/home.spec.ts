import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("should load the home page and show restaurants", async ({ page }) => {
    await page.goto("/");

    // Check if the app name is visible in the hero section
    await expect(page.locator("text=Open Resto").first()).toBeVisible();

    // Check if Navbar is visible
    await expect(page.getByRole("link", { name: "Locations" })).toBeVisible();
    await expect(page.getByRole("link", { name: "My Bookings" })).toBeVisible();

    // Check if we have restaurant cards
    const restaurantCards = page
      .getByRole("link")
      .filter({ has: page.locator("text=/./") })
      .filter({ hasNotText: "Locations" })
      .filter({ hasNotText: "My Bookings" })
      .filter({ hasNotText: "Admin" });

    // Wait for the API to load and cards to appear
    await expect(restaurantCards.first()).toBeVisible({ timeout: 15000 });

    const count = await restaurantCards.count();

    expect(count).toBeGreaterThan(0);
  });

  test("should navigate to booking page when clicking a restaurant", async ({ page }) => {
    // Booking specs that run first can exhaust the 60 req/min Docker rate limit.
    // Poll with reloads (up to 4×) to give the window time to recover.
    test.setTimeout(120_000);

    await page.goto("/");

    const restaurantCard = page.getByText("Pasta Place").first();
    let visible = false;
    for (let i = 0; i < 4; i++) {
      if (i > 0) {
        await page.waitForTimeout(20_000);
        await page.reload();
      }
      try {
        await expect(restaurantCard).toBeVisible({ timeout: 10_000 });
        visible = true;
        break;
      } catch {
        // rate-limit window hasn't cleared yet — loop and wait
      }
    }
    if (!visible) throw new Error("Restaurant cards never appeared — rate limit did not recover");

    await restaurantCard.click({ force: true });
    // Restaurant cards now route into the merged Locations page, which
    // auto-expands the clicked location with its booking form inline.
    await page.waitForURL(/.*\/locations\/\d+/, { timeout: 10_000 });
    await expect(page.getByText("Book a table")).toBeVisible({ timeout: 20_000 });
  });
});
