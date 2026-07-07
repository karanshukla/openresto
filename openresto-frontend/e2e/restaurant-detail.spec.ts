import { test, expect, type Browser } from "@playwright/test";
import { buildUpdateRestaurantBody } from "./helpers";
import { ADMIN_STATE_FILE } from "./global-setup";

// Pasta Place (id=1) is the primary seeded restaurant used across specs.
const PASTA_PLACE_ID = 1;

/**
 * The restaurant detail page — a core customer entry point into the booking
 * flow that no other spec exercises directly. Covers four real paths:
 *
 *   1. /restaurant/:id renders the restaurant's name + address.
 *   2. The "Book a Table" CTA navigates into /book/:id.
 *   3. A walk-in-only location shows the WalkInNotice and hides the CTA. The
 *      seed has no walk-in restaurant, so Pasta Place is flipped to walk-in
 *      via the admin API for this test and restored in afterEach.
 *   4. An unknown id renders the "Restaurant not found." fallback.
 *
 * Runs under the public "chromium" project. The walk-in flip uses the
 * global-setup storageState cookie via a fresh admin context, not the page.
 *
 * IMPORTANT: the PUT /api/restaurants/:id handler assigns every field from
 * the request body unconditionally (Address, OpenTime, …), so a partial body
 * would wipe the seeded state. We therefore read the FULL restaurant first and
 * send it back with only walkInOnly changed — both on flip and on restore — so
 * no other spec ever sees Pasta Place mutated.
 */
test.describe("Restaurant detail page", () => {
  test.describe.configure({ mode: "serial" });

  // Captured once in the test that flips, restored verbatim in afterEach.
  // `unknown` (vs false) lets afterEach tell "no flip happened, nothing to
  // restore" apart from "flip happened, restore to false".
  let originalRestaurant: Record<string, unknown> | undefined;

  async function readRestaurant(browser: Browser): Promise<Record<string, unknown>> {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const res = await page.request.get(`/api/restaurants/${PASTA_PLACE_ID}`);
    const body = (await res.json()) as Record<string, unknown>;
    await ctx.close();
    return body;
  }

  /**
   * PUT a full restaurant update (see buildUpdateRestaurantBody in helpers for
   * why the full body is required). `overrides` are applied last.
   */
  async function putRestaurant(
    browser: Browser,
    body: Record<string, unknown>,
    expectOk = true
  ): Promise<void> {
    const ctx = await browser.newContext({ storageState: ADMIN_STATE_FILE });
    const page = await ctx.newPage();
    const res = await page.request.put(`/api/restaurants/${PASTA_PLACE_ID}`, { data: body });
    if (expectOk) expect(res.ok()).toBeTruthy();
    await ctx.close();
  }

  test.afterEach(async ({ browser }) => {
    // Always restore the full original state, even if a test failed mid-flip.
    if (originalRestaurant !== undefined) {
      await putRestaurant(
        browser,
        buildUpdateRestaurantBody(originalRestaurant, {
          walkInOnly: originalRestaurant.walkInOnly,
          walkInDays: originalRestaurant.walkInDays,
        })
      );
      originalRestaurant = undefined;
    }
  });

  test("renders the restaurant name and address", async ({ browser, page }) => {
    // Read the address from the API rather than hardcoding the seed value, so
    // this stays correct regardless of what other specs (or this one) do.
    const restaurant = await readRestaurant(browser);
    const address = restaurant.address as string | null;

    await page.goto(`/restaurant/${PASTA_PLACE_ID}`);

    await expect(page.getByText("Pasta Place").first()).toBeVisible({ timeout: 15_000 });
    if (address) {
      await expect(page.getByText(address).first()).toBeVisible();
    }
  });

  test("the 'Book a Table' CTA navigates into the booking flow", async ({ page }) => {
    await page.goto(`/restaurant/${PASTA_PLACE_ID}`);
    const bookButton = page.getByText("Book a Table", { exact: true });
    await expect(bookButton).toBeVisible({ timeout: 15_000 });

    await bookButton.click();
    // The link's href is /book/1, so the URL change alone proves the CTA works.
    await page.waitForURL(/.*\/book\/1/, { timeout: 15_000 });

    // Confirm the booking page hydrated. Its restaurant-data fetch can get a
    // transient 429 when the shared rate-limit window is saturated by earlier
    // specs (booking.spec.ts handles the same edge with a reload fallback);
    // mirror that here so this isn't flaky under load.
    try {
      await expect(page.getByText("Book a table")).toBeVisible({ timeout: 15_000 });
    } catch {
      await page.reload();
      await expect(page.getByText("Book a table")).toBeVisible({ timeout: 20_000 });
    }
  });

  test("a walk-in-only location shows the walk-in notice and hides the booking CTA", async ({
    browser,
    page,
  }) => {
    // Capture full state, then flip walk-in only.
    originalRestaurant = await readRestaurant(browser);
    await putRestaurant(
      browser,
      buildUpdateRestaurantBody(originalRestaurant, { walkInOnly: true })
    );

    // The detail page refetches /api/restaurants/:id on mount, so a fresh
    // navigation picks up the flip.
    await page.goto(`/restaurant/${PASTA_PLACE_ID}`);
    await expect(page.getByText("Walk-ins only").first()).toBeVisible({ timeout: 15_000 });

    // The CTA is replaced by the notice — it must not be rendered at all.
    await expect(page.getByText("Book a Table", { exact: true })).toHaveCount(0);
  });

  test("an unknown restaurant id renders the not-found fallback", async ({ page }) => {
    await page.goto("/restaurant/99999");
    await expect(page.getByText("Restaurant not found.")).toBeVisible({ timeout: 15_000 });
  });
});
