import { test, expect } from "@playwright/test";

test.describe("Booking Flow", () => {
  test("should complete a booking successfully", async ({ page }) => {
    // 1. Start on Home
    await page.goto("/");

    // 2. Click the first restaurant card
    const restaurantCards = page
      .getByRole("link")
      .filter({ has: page.locator("text=/./") })
      .filter({ hasNotText: "Home" })
      .filter({ hasNotText: "My Bookings" })
      .filter({ hasNotText: "Admin" });

    await expect(restaurantCards.first()).toBeVisible({ timeout: 15000 });
    await restaurantCards.first().click({ force: true });

    // Wait for navigation
    await page.waitForURL(/.*book\?restaurantId=.*/, { timeout: 10000 });

    // 3. Fill out the form
    const emailInput = page.getByPlaceholder("your@email.com");
    await expect(emailInput).toBeVisible();
    await emailInput.fill("test-e2e@example.com");

    // 4. Wait for the hold to trigger (debounce is 2s)
    await expect(page.locator("text=Table held")).toBeVisible({ timeout: 15000 });

    // 5. Confirm the booking
    const confirmButton = page.getByRole("button", { name: "Confirm Booking" });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // 6. Should be on the confirmation page
    await page.waitForURL(/.*booking-confirmation\/.*/, { timeout: 10000 });
    await expect(page.locator("text=Booking Confirmed")).toBeVisible();
    await expect(page.locator("text=test-e2e@example.com")).toBeVisible();
  });
});
