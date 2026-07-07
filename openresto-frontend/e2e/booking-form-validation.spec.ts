import { test, expect } from "@playwright/test";
import { futureDateStr, selectBookingDate } from "./helpers";

/**
 * Guards the customer booking-funnel validation invariant: the Confirm Booking
 * Pressable must stay inert until the customer has entered a name, a valid
 * email, AND acquired a table hold. Without name+email the hold effect never
 * fires (useTableHold early-returns when isValidEmail(email) is false), so
 * "Table held" never appears and Confirm is permanently disabled.
 *
 * This is a pure UI guard — no booking is ever created, so it's self-contained,
 * fast, and needs no cleanup.
 */
test.describe("Booking form validation", () => {
  test("Confirm Booking stays disabled and no hold is acquired while name/email are empty", async ({
    page,
  }) => {
    await page.goto(`/book?restaurantId=1`);
    await expect(page.getByText("Book a table")).toBeVisible({ timeout: 20_000 });

    // Pick a far-out date (28 days — distinct from other specs' offsets).
    await selectBookingDate(page, futureDateStr(28));

    // Wait for availability, then pick a midday lunch slot.
    await expect(page.getByText("Lunch").first()).toBeVisible({ timeout: 20_000 });
    const slot = page.getByText(/^1[1-4]:\d{2}$/).first();
    await slot.waitFor({ state: "attached", timeout: 10_000 });
    await slot.evaluate((el) => el.scrollIntoView({ block: "nearest", inline: "nearest" }));
    await slot.dispatchEvent("click");

    // With name/email still empty, the confirm Pressable is present but the
    // hold effect has short-circuited — give it well past the 2s debounce to
    // prove "Table held" never appears.
    const confirmBtn = page.getByText("Confirm Booking", { exact: true });
    await expect(confirmBtn).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Table held")).toHaveCount(0);

    // Wait beyond the hold debounce to be sure no hold fires with empty fields.
    await page.waitForTimeout(3000);
    await expect(page.getByText("Table held")).toHaveCount(0);

    // Force-clicking the disabled Pressable must not leave the booking page —
    // the form guard (isValid) blocks submission regardless of the DOM event.
    await confirmBtn.click({ force: true });
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/.*\/book/, { timeout: 5_000 });
    await expect(page.getByText("Booking Confirmed")).toHaveCount(0);
  });
});
