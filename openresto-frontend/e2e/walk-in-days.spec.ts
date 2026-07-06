import { test, expect, type Browser } from "@playwright/test";
import { buildUpdateRestaurantBody } from "./helpers";
import { ADMIN_STATE_FILE } from "./global-setup";

const PASTA_PLACE_ID = 1;

/**
 * Day-scoped walk-in-only — distinct from the location-wide walkInOnly case
 * covered in restaurant-detail.spec.ts. When `walkInDays` includes a given
 * ISO day (1=Mon … 7=Sun) but `walkInOnly` is false, the location is bookable
 * on most days but the booking form must disable itself for the walk-in days
 * and show the day-scoped WalkInNotice ("Walk-ins only on this day").
 *
 * Setup/teardown runs via the admin API (full UpdateRestaurantRequest body so
 * no other field is wiped — see buildUpdateRestaurantBody). The customer-facing
 * assertion navigates the booking form unauthenticated.
 */
test.describe("Walk-in-only day on the booking form", () => {
  test.describe.configure({ mode: "serial" });

  let original: Record<string, unknown> | undefined;

  // Tomorrow, far enough out that its slots aren't half-gone.
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowIsoDay = ((tomorrow.getUTCDay() + 6) % 7) + 1; // 1=Mon … 7=Sun
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  // A guaranteed-non-walk-in day: the ISO day after tomorrow, wrapped.
  const otherIsoDay = (tomorrowIsoDay % 7) + 1;
  const otherDay = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
  const otherDayStr = otherDay.toISOString().split("T")[0];

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
    const res = await page.request.get(`/api/restaurants/${PASTA_PLACE_ID}`);
    original = (await res.json()) as Record<string, unknown>;
    await ctx.close();

    // Mark tomorrow's weekday as walk-in-only (location-wide flag stays false).
    await putRestaurant(
      browser,
      buildUpdateRestaurantBody(original, {
        walkInOnly: false,
        walkInDays: String(tomorrowIsoDay),
      })
    );
  });

  test.afterAll(async ({ browser }) => {
    if (!original) return;
    await putRestaurant(
      browser,
      buildUpdateRestaurantBody(original, {
        walkInOnly: original.walkInOnly,
        walkInDays: original.walkInDays,
      })
    );
  });

  test("selecting the walk-in-only day shows the day-scoped notice and hides slots", async ({
    page,
  }) => {
    await page.goto(`/book?restaurantId=${PASTA_PLACE_ID}`);
    await expect(page.getByText("Book a table")).toBeVisible({ timeout: 20_000 });

    // Select tomorrow (a walk-in-only day) via the native setter so React's
    // controlled input fires onChange (same technique as booking-flow.spec.ts).
    await page.evaluate((value: string) => {
      const input = document.querySelector('input[type="date"]') as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )!.set!;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, tomorrowStr);

    // The day-scoped notice renders in place of the slot list / booking form.
    await expect(page.getByText("Walk-ins only on this day").first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("a non-walk-in day still shows the normal booking form", async ({ page }) => {
    await page.goto(`/book?restaurantId=${PASTA_PLACE_ID}`);
    await expect(page.getByText("Book a table")).toBeVisible({ timeout: 20_000 });

    // Select a different day that isn't in walkInDays.
    await page.evaluate((value: string) => {
      const input = document.querySelector('input[type="date"]') as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )!.set!;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, otherDayStr);

    // The day-scoped notice must NOT appear; instead the slot picker hydrates.
    await expect(page.getByText("Walk-ins only on this day")).toHaveCount(0);
    // The Lunch/Dinner category tabs appear once availability loads — proves
    // the booking flow is live for this day.
    await expect(page.getByText("Lunch").first()).toBeVisible({ timeout: 20_000 });
  });
});
