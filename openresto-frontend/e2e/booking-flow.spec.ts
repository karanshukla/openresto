import { test, expect, type Browser } from "@playwright/test";
import { futureDateStr, openBookingDrawer, selectBookingDate, selectMealWindow } from "./helpers";
import { ADMIN_STATE_FILE } from "./global-setup";

const PASTA_PLACE_ID = 1;
const TEST_EMAIL = "e2e-booking-flow@example.com";

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

/**
 * Full customer journey: locations list → pick a time → drawer → hold acquired → confirm.
 *
 * Party size, date and meal window are set on the page-level filter bar, then the booking
 * drawer opens from a slot on the location's card carrying all three.
 *
 * Timezone note: futureDateStr uses UTC. We narrow to Lunch before picking a slot so the
 * booked time is a predictable non-midnight one, and clean up test bookings before/after
 * the suite to prevent slot saturation across CI runs at the same UTC hour.
 */
test.describe("Customer booking end to end", { tag: "@smoke" }, () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    // Remove any bookings left by previous runs so slots are free
    await purgeTestBookings(browser);
  });

  test.afterAll(async ({ browser }) => {
    // Remove bookings created by this run to keep the DB clean
    await purgeTestBookings(browser);
  });

  test("search → hold → confirm shows booking reference", async ({ page }) => {
    // ── 1. Navigate to the location ──────────────────────────────────────────
    await page.goto(`/book?restaurantId=${PASTA_PLACE_ID}`);
    await expect(page.getByTestId("locations-filter-bar")).toBeVisible({ timeout: 20_000 });

    // ── 2. Set a date 14 days out via the page-level calendar picker ─────────
    await selectBookingDate(page, futureDateStr(14));

    // ── 3. Narrow to lunch, then open the drawer on the first bookable time ──
    await selectMealWindow(page, "Lunch");
    const bookedTime = await openBookingDrawer(page);
    expect(bookedTime).toMatch(/^\d{2}:\d{2}$/);

    // ── 4. Fill customer details to trigger the hold (debounce = 2 s) ────────
    await page.getByPlaceholder("Your full name").fill("E2E Booking Flow");
    await page.getByPlaceholder("your@email.com").fill(TEST_EMAIL);

    // ── 5. Hold banner appears (allow 30 s to handle any slot re-selection) ──
    await expect(page.locator("text=Table held")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("text=/expires in \\d+:\\d+/")).toBeVisible();

    // ── 6. Confirm the booking ────────────────────────────────────────────────
    const confirmBtn = page.getByText("Confirm Booking");
    await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
    await confirmBtn.click();

    // ── 7. Confirmation page ──────────────────────────────────────────────────
    await page.waitForURL(/.*booking-confirmation\/.*/, { timeout: 15_000 });
    await expect(page.getByText("Booking Confirmed")).toBeVisible();
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();

    const bookingRef = page.url().split("/booking-confirmation/")[1].split("?")[0];
    expect(bookingRef.length).toBeGreaterThan(0);
    // Scoped to the result panel: the freshly-confirmed booking is cached, so its ref also
    // shows up in the recent-bookings sidebar next to it, and a bare getByText matches both.
    await expect(page.getByTestId("result-panel").getByText(bookingRef)).toBeVisible();
  });

  test("My Bookings link in navbar navigates to the lookup page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "My Bookings" }).click();
    await page.waitForURL(/.*lookup.*/, { timeout: 10_000 });
    await expect(page.getByText("Find my booking")).toBeVisible();
  });
});
