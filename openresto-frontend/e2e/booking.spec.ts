import { test, expect, type Browser } from "@playwright/test";
import { futureDateStr, selectBookingDate } from "./helpers";
import { ADMIN_STATE_FILE } from "./global-setup";

const PASTA_PLACE_ID = 1;
const TEST_EMAIL = "test-e2e@example.com";

async function purgeTestBookings(browser: Browser) {
  const ctx = await browser.newContext({ storageState: ADMIN_STATE_FILE });
  const page = await ctx.newPage();
  const res = await page.request.get(
    `/api/admin/bookings?restaurantId=${PASTA_PLACE_ID}&email=${encodeURIComponent(TEST_EMAIL)}&status=all`
  );
  if (res.ok()) {
    const bookings = (await res.json()) as { id: number }[];
    for (const b of bookings) {
      await page.request.delete(`/api/admin/bookings/${b.id}`);
    }
  }
  await ctx.close();
}

test.describe("Booking Flow", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    // Remove any bookings left by previous runs so lunch slots are free
    await purgeTestBookings(browser);
  });

  test.afterAll(async ({ browser }) => {
    // Remove bookings created by this run to keep the DB clean
    await purgeTestBookings(browser);
  });

  test("should complete a booking successfully", async ({ page }) => {
    // 1. Start on Home
    await page.goto("/");

    // 2. Click the first restaurant card
    const restaurantCards = page.getByText("Pasta Place");

    await expect(restaurantCards.first()).toBeVisible({ timeout: 30_000 });
    await restaurantCards.first().click({ force: true });

    // Wait for navigation and booking form to load. Clicking a card routes
    // into the merged Locations page, which auto-expands with the booking
    // form inline (the old standalone /book/:id page is now just a redirect).
    // If the restaurant data is rate-limited after the preceding API-heavy tests,
    // reload once — the client's 429 retry will then succeed.
    await page.waitForURL(/.*\/locations\/\d+/, { timeout: 10000 });
    try {
      await expect(page.getByText("Book a table")).toBeVisible({ timeout: 15_000 });
    } catch {
      await page.reload();
      await expect(page.getByText("Book a table")).toBeVisible({ timeout: 20_000 });
    }

    // 3. Set a far-out date via the calendar picker.
    //    21 days out uses a different date than booking-flow.spec.ts (14 days) to avoid
    //    accumulating bookings on the same date across test files.
    await selectBookingDate(page, futureDateStr(21));

    // 4. Wait for availability then click a lunchtime slot
    await expect(page.getByText("Lunch").first()).toBeVisible({ timeout: 20_000 });
    const slot = page.getByText(/^1[1-4]:\d{2}$/).first();
    await slot.waitFor({ state: "attached", timeout: 10_000 });
    // Slots live inside a horizontal ScrollView whose wrapper has overflow:hidden.
    // Scroll the chip into view, then dispatch a native click so it bubbles to
    // the Pressable's onClick regardless of Playwright's clip detection.
    await slot.evaluate((el) => el.scrollIntoView({ block: "nearest", inline: "nearest" }));
    await slot.dispatchEvent("click");

    // 5. Fill out the form
    const nameInput = page.getByPlaceholder("Your full name");
    await expect(nameInput).toBeVisible();
    await nameInput.fill("E2E Test User");

    const emailInput = page.getByPlaceholder("your@email.com");
    await expect(emailInput).toBeVisible();
    await emailInput.fill(TEST_EMAIL);

    // 6. Wait for the hold to trigger (debounce is 2s, then hold API call)
    await expect(page.locator("text=Table held")).toBeVisible({ timeout: 30_000 });

    // 7. Confirm the booking
    const confirmButton = page.getByText("Confirm Booking");
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // 8. Should be on the confirmation page
    await page.waitForURL(/.*booking-confirmation\/.*/, { timeout: 10000 });
    await expect(page.locator("text=Booking Confirmed")).toBeVisible();
    await expect(page.locator(`text=${TEST_EMAIL}`)).toBeVisible();
  });
});
