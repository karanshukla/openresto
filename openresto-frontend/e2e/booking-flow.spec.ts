import { test, expect } from "@playwright/test";
import { futureDateStr } from "./helpers";
import { ADMIN_STATE_FILE } from "./global-setup";

const PASTA_PLACE_ID = 1;
const TEST_EMAIL = "e2e-booking-flow@example.com";

async function purgeTestBookings(
  browser: Parameters<Parameters<typeof test.beforeAll>[0]>[0]["browser"]
) {
  const ctx = await browser.newContext({ storageState: ADMIN_STATE_FILE });
  const page = await ctx.newPage();
  const res = await page.request.get(
    `/api/admin/bookings?restaurantId=${PASTA_PLACE_ID}&email=${encodeURIComponent(TEST_EMAIL)}&status=all`
  );
  if (res.ok()) {
    const bookings = (await res.json()) as Array<{ id: number }>;
    for (const b of bookings) {
      await page.request.delete(`/api/admin/bookings/${b.id}/purge`);
    }
  }
  await ctx.close();
}

/**
 * Full customer journey: home → restaurant → fill form → hold acquired → confirm.
 *
 * Timezone note: futureDateStr uses UTC. The auto-suggested time is the current
 * UTC hour rounded to the next 15 min, which can accumulate bookings across CI
 * runs at the same UTC hour. We explicitly click a midday Lunch slot after
 * availability loads to pick a predictable non-midnight time, and we clean up
 * test bookings before/after the suite to prevent slot saturation.
 */
test.describe("Customer booking end to end", () => {
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
    // ── 1. Navigate directly to the booking page ─────────────────────────────
    await page.goto(`/book?restaurantId=${PASTA_PLACE_ID}`);
    await expect(page.getByText("Book a table")).toBeVisible({ timeout: 20_000 });

    // ── 2. Set a date 14 days out ─────────────────────────────────────────────
    // plain fill() sets the native value but React's controlled input may not
    // fire onChange. Use the native setter + synthetic events so React re-renders.
    await page.evaluate((value: string) => {
      const input = document.querySelector('input[type="date"]') as HTMLInputElement;
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )!.set!;
      nativeSetter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, futureDateStr(14));

    // ── 3. Wait for availability to load, then pick a midday slot ────────────
    // Waiting for the "Lunch" tab confirms availability has loaded.
    await expect(page.getByText("Lunch").first()).toBeVisible({ timeout: 20_000 });
    await page
      .getByText(/^1[1-4]:\d{2}$/)
      .first()
      .click();

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
    await expect(page.getByText(bookingRef)).toBeVisible();
  });

  test("My Bookings link in navbar navigates to the lookup page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "My Bookings" }).click();
    await page.waitForURL(/.*lookup.*/, { timeout: 10_000 });
    await expect(page.getByText("Find My Booking")).toBeVisible();
  });
});
