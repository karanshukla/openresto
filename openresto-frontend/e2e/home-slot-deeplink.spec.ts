import { test, expect, type Browser } from "@playwright/test";
import { buildUpdateRestaurantBody, expectVisibleWithReload } from "./helpers";
import { ADMIN_STATE_FILE } from "./global-setup";

const PASTA_PLACE_ID = 1;

/** Minutes past midnight, in UTC — the timezone the seeded locations run on. */
function utcMinutesNow(): number {
  const now = new Date();
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

/**
 * Pressing a time on a home-page card is a booking intent aimed at one specific
 * location: it deep-links into /locations/:id?time=…, which must both open the
 * booking panel on that time *and* expand the location it belongs to. Issue #310
 * — the panel opened over a list of collapsed cards, leaving no sign of which
 * location was being booked.
 *
 * The home card offers *today's* remaining slots and nothing else, so with the
 * seeded 09:00–22:00 hours and a 30-minute interval the last chip of the day is
 * 21:30 and this spec had nothing to click after that — it timed out for two and
 * a half hours out of every twenty-four, which is how it failed a run that had
 * nothing to do with it. It now opens the location around the clock on a 15-minute
 * interval for the duration of the spec, and restores the seeded hours afterwards.
 */
test.describe("Home slot deep link", () => {
  test.describe.configure({ mode: "serial" });

  let original: Record<string, unknown> | undefined;

  async function putRestaurant(browser: Browser, body: Record<string, unknown>) {
    const ctx = await browser.newContext({ storageState: ADMIN_STATE_FILE });
    const page = await ctx.newPage();
    const res = await page.request.put(`/api/restaurants/${PASTA_PLACE_ID}`, { data: body });
    expect(res.ok()).toBeTruthy();
    await ctx.close();
  }

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    original = (await page.request
      .get(`/api/restaurants/${PASTA_PLACE_ID}`)
      .then((r) => r.json())) as Record<string, unknown>;
    await ctx.close();

    await putRestaurant(
      browser,
      buildUpdateRestaurantBody(original, {
        openTime: "00:00",
        closeTime: "23:59",
        openDays: "1,2,3,4,5,6,7",
        openHours: null,
        bookingSlotIntervalMinutes: 15,
        walkInOnly: false,
        walkInDays: "",
      })
    );
  });

  test.afterAll(async ({ browser }) => {
    if (!original) return;
    await putRestaurant(
      browser,
      buildUpdateRestaurantBody(original, {
        openTime: original.openTime,
        closeTime: original.closeTime,
        bookingSlotIntervalMinutes: original.bookingSlotIntervalMinutes ?? 30,
      })
    );
  });

  test("opens the booking panel and expands the location it belongs to", async ({ page }) => {
    // The last 15-minute slot of the day starts at 23:45. Past that there is
    // genuinely nothing left to book today and no chip to press — the product is
    // right and the spec has no subject, so say so rather than time out.
    test.skip(
      utcMinutesNow() >= 23 * 60 + 45,
      "no slot remains today; the home card only offers today's times"
    );

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
