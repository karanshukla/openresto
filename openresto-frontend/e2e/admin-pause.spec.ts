import { test, expect } from "@playwright/test";
import {
  gotoAdminDashboard,
  futureDateStr,
  expectVisibleWithReload,
  selectBookingDate,
} from "./helpers";

const PASTA_PLACE_ID = 1;

/**
 * Admin pauses bookings for a restaurant.
 * The customer-facing booking form should show no available time slots when paused,
 * and slots should return after unpausing.
 *
 * We pause/unpause via direct API calls (authenticated via storageState) and verify
 * the customer-facing UI effect.  The pause modal UI itself is covered by the fact
 * that admin-extend also uses the same RestaurantActionModal.
 */
test.describe("Admin pause bookings", () => {
  test.describe.configure({ mode: "serial" });

  test.afterEach(async ({ page }) => {
    // Always unpause to leave the DB in a clean state
    await page.request.post(`/api/admin/restaurants/${PASTA_PLACE_ID}/unpause`, { data: {} });
  });

  test("pausing a restaurant hides all time slots on the booking form", async ({ page }) => {
    await gotoAdminDashboard(page);

    // ── Pause via API (authenticated via storageState cookie) ─────────────────
    const pauseRes = await page.request.post(`/api/admin/restaurants/${PASTA_PLACE_ID}/pause`, {
      data: { minutes: 60 },
    });
    expect(pauseRes.ok()).toBeTruthy();

    // ── Customer navigates to the booking form ─────────────────────────────────
    await page.goto(`/book?restaurantId=${PASTA_PLACE_ID}`);
    // The form hydrates from a rate-limited fetch; reload (cool-down first) if
    // it hasn't rendered within the window — see expectVisibleWithReload.
    await expectVisibleWithReload(page, page.getByText("Book a table"), { timeout: 20_000 });

    // Pick tomorrow via the calendar picker so we're not looking at today's
    // half-gone slot list for an unrelated reason
    await selectBookingDate(page, futureDateStr(1));

    // When paused, every slot has isAvailable:false → PopularTimesPicker shows
    // "No slots available for this period." on every category tab
    await expect(page.getByText("No slots available for this period.").first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("unpausing a restaurant restores available slots", async ({ page }) => {
    await gotoAdminDashboard(page);

    // Pause, then immediately unpause
    await page.request.post(`/api/admin/restaurants/${PASTA_PLACE_ID}/pause`, {
      data: { minutes: 60 },
    });
    await page.request.post(`/api/admin/restaurants/${PASTA_PLACE_ID}/unpause`, { data: {} });

    // Verify availability via the API — at least one slot must be available
    const tomorrow = futureDateStr(1);
    const res = await page.request.get(
      `/api/restaurants/${PASTA_PLACE_ID}/availability?date=${tomorrow}&seats=2`
    );
    expect(res.ok()).toBeTruthy();
    const { slots } = await res.json();
    const hasAvailable = (slots as Array<{ isAvailable: boolean }>).some((s) => s.isAvailable);
    expect(hasAvailable).toBeTruthy();
  });

  /**
   * Smoke-test that the dashboard "Pause Bookings" quick-action does open
   * the RestaurantActionModal (same component used by "Extend Bookings" which
   * is fully exercised in admin-extend.spec.ts).
   */
  test("dashboard Pause Bookings action opens the modal", async ({ page }) => {
    await gotoAdminDashboard(page);
    await page.getByText("Pause Bookings", { exact: true }).click();
    // The dialog should appear within 10 s
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10_000 });
    // Close it without doing anything
    await page.keyboard.press("Escape");
  });
});
