import { test, expect } from "@playwright/test";
import { expectVisibleWithReload } from "./helpers";

/**
 * Pressing a time on a home-page card is a booking intent aimed at one specific
 * location: it deep-links into /locations/:id?time=…, which must both open the
 * booking panel on that time *and* expand the location it belongs to. Issue #310
 * — the panel opened over a list of collapsed cards, leaving no sign of which
 * location was being booked.
 */
test.describe("Home slot deep link", () => {
  test("opens the booking panel and expands the location it belongs to", async ({ page }) => {
    await page.goto("/");

    const slot = page.getByLabel(/^Book \d{2}:\d{2} at .+$/).first();
    await expectVisibleWithReload(page, slot, { timeout: 20_000 });
    const time = ((await slot.getAttribute("aria-label")) ?? "").slice(5, 10);
    await slot.click();

    await page.waitForURL(/.*\/locations\/\d+\?time=/, { timeout: 15_000 });

    const drawer = page.getByTestId("booking-drawer");
    await expect(drawer).toBeVisible({ timeout: 20_000 });
    await expect(drawer.getByText(time, { exact: false }).first()).toBeVisible();

    // "Seating & tables" only renders inside the expanded details accordion.
    await expect(page.getByText("Seating & tables").first()).toBeVisible({ timeout: 15_000 });
  });
});
