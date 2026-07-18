import { test, expect, type Browser } from "@playwright/test";
import { buildUpdateRestaurantBody } from "./helpers";
import { ADMIN_STATE_FILE } from "./global-setup";

// Pasta Place (id=1) is the primary seeded restaurant used across specs.
const PASTA_PLACE_ID = 1;

/**
 * The old standalone `/restaurant/:id` page was folded into the Locations
 * list (issue #205): `restaurant/[id].tsx` is now a thin redirect to
 * `/locations/:id`, which renders the full Locations list with that one
 * location pre-expanded (image, blurb, opening hours, inline booking form —
 * see LocationListItem). This spec covers the redirect's real behaviour,
 * not the old detail-page-plus-separate-booking-page flow it replaced:
 *
 *   1. /restaurant/:id redirects into /locations/:id and shows the
 *      restaurant's name + address, pre-expanded with the booking form.
 *   2. A walk-in-only location shows the WalkInNotice and no booking form.
 *      The seed has no walk-in restaurant, so Pasta Place is flipped to
 *      walk-in via the admin API for this test and restored in afterEach.
 *   3. An unknown id still redirects and renders the full Locations list
 *      (nothing highlighted/expanded) rather than crashing or erroring —
 *      there's no more per-id "not found" state now that the id only
 *      controls which list item auto-expands.
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
test.describe("Restaurant detail redirect", () => {
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

  test("redirects into the Locations list, pre-expanded with the name, address, and booking form", async ({
    browser,
    page,
  }) => {
    // Read the address from the API rather than hardcoding the seed value, so
    // this stays correct regardless of what other specs (or this one) do.
    const restaurant = await readRestaurant(browser);
    const address = restaurant.address as string | null;

    await page.goto(`/restaurant/${PASTA_PLACE_ID}`);
    await page.waitForURL(new RegExp(`.*/locations/${PASTA_PLACE_ID}`), { timeout: 15_000 });

    await expect(page.getByText("Pasta Place").first()).toBeVisible({ timeout: 15_000 });
    if (address) {
      await expect(page.getByText(address).first()).toBeVisible();
    }

    // Pre-expanded via highlightId — the inline booking form is already
    // showing, not a separate CTA into a separate page.
    try {
      await expect(page.getByText("Book a table")).toBeVisible({ timeout: 15_000 });
    } catch {
      await page.reload();
      await expect(page.getByText("Book a table")).toBeVisible({ timeout: 20_000 });
    }
  });

  test("a walk-in-only location shows the walk-in notice and no booking form", async ({
    browser,
    page,
  }) => {
    // Capture full state, then flip walk-in only.
    originalRestaurant = await readRestaurant(browser);
    await putRestaurant(
      browser,
      buildUpdateRestaurantBody(originalRestaurant, { walkInOnly: true })
    );

    // The detail redirect target refetches all restaurants on mount, so a
    // fresh navigation picks up the flip.
    await page.goto(`/restaurant/${PASTA_PLACE_ID}`);
    await page.waitForURL(new RegExp(`.*/locations/${PASTA_PLACE_ID}`), { timeout: 15_000 });
    await expect(page.getByText("Walk-ins only").first()).toBeVisible({ timeout: 15_000 });

    // The inline booking form must not be rendered at all when walk-in only.
    await expect(page.getByText("Book a table")).toHaveCount(0);
  });

  test("an unknown restaurant id still redirects and renders the Locations list", async ({
    page,
  }) => {
    await page.goto("/restaurant/99999");
    await page.waitForURL(/.*\/locations\/99999/, { timeout: 15_000 });

    // No restaurant matches highlightId=99999, so nothing auto-expands — the
    // full list just renders normally rather than erroring.
    await expect(page.getByText("Our locations").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Pasta Place").first()).toBeVisible({ timeout: 15_000 });
  });
});
