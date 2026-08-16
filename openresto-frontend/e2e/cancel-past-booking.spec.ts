import { test, expect, type Browser } from "@playwright/test";
import { gotoAdminDashboard, pastUtcISO, postWithRetry } from "./helpers";
import { ADMIN_STATE_FILE } from "./global-setup";

// Seeded restaurant structure (see admin-extend.spec.ts):
//   Pasta Place (id=1)
//     Indoor (sectionId=1): T1 (id=1, 4 seats), T2 (id=2, 2 seats)
//     Patio  (sectionId=2): P1 (id=3, 4 seats)  ← used here to avoid booking conflicts
const RESTAURANT_ID = 1;
const PATIO_SECTION_ID = 2;
const P1_TABLE_ID = 3;
const PAST_BOOKING_EMAIL = "e2e-past-cancel@example.com";

/**
 * Issue #159 — a booking whose date has already passed must not be cancellable,
 * from either the admin dashboard or the customer-facing pages, while the
 * unrelated Purge (GDPR) and Restore actions must remain unaffected.
 *
 * The past booking is seeded via the admin-create API (POST /api/admin/bookings),
 * which is intentionally exempt from the past-date guard per #160 — this is the
 * only way to get a genuinely past, non-cancelled booking into the system, and
 * mirrors the investigation's suggested E2E scenario exactly.
 */
test.describe("Cancel a past booking (#159)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  let bookingRef = "";

  async function purgePastBookings(browser: Browser) {
    const ctx = await browser.newContext({ storageState: ADMIN_STATE_FILE });
    const page = await ctx.newPage();
    const res = await page.request.get(
      `/api/admin/bookings?restaurantId=${RESTAURANT_ID}&email=${encodeURIComponent(PAST_BOOKING_EMAIL)}&status=all`
    );
    if (res.ok()) {
      const bookings = (await res.json()) as { id: number }[];
      for (const b of bookings) {
        await page.request.delete(`/api/admin/bookings/${b.id}`);
      }
    }
    await ctx.close();
  }

  test.beforeAll(async ({ browser }) => {
    await purgePastBookings(browser);

    const ctx = await browser.newContext({ storageState: ADMIN_STATE_FILE });
    const page = await ctx.newPage();
    await gotoAdminDashboard(page);

    // Two days in the past — well outside the 5-minute grace window.
    // postWithRetry backs off on 429 — the admin endpoint sits behind the
    // shared per-IP rate-limit window which can be saturated mid-suite.
    const res = await postWithRetry(
      page.request,
      "/api/admin/bookings",
      {
        data: {
          restaurantId: RESTAURANT_ID,
          sectionId: PATIO_SECTION_ID,
          tableId: P1_TABLE_ID,
          date: pastUtcISO(2 * 24 * 60),
          customerEmail: PAST_BOOKING_EMAIL,
          customerName: "E2E Past Cancel Test",
          seats: 2,
        },
      },
      5
    );
    expect(res.ok()).toBeTruthy();
    const booking = (await res.json()) as { id: number; bookingRef: string };
    bookingRef = booking.bookingRef;

    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    await purgePastBookings(browser);
  });

  test("admin bookings list hides the row Cancel action for a past booking", async ({ page }) => {
    expect(bookingRef).toBeTruthy();

    await gotoAdminDashboard(page);
    await page.goto("/admin/bookings");

    const searchInput = page.getByPlaceholder("Email or reference…").nth(1);
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.fill(bookingRef);
    await page.getByText("Find", { exact: true }).click();

    const row = page.getByText(bookingRef).first();
    await expect(row).toBeVisible({ timeout: 20_000 });

    // No "Cancel booking" affordance anywhere in the (single, filtered) result row.
    await expect(page.getByLabel("Cancel booking")).toHaveCount(0);
  });

  test("admin booking detail popup hides Cancel but keeps Purge for a past booking", async ({
    page,
  }) => {
    expect(bookingRef).toBeTruthy();

    await gotoAdminDashboard(page);
    await page.goto("/admin/bookings");

    const searchInput = page.getByPlaceholder("Email or reference…").nth(1);
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.fill(bookingRef);
    await page.getByText("Find", { exact: true }).click();

    const row = page.getByText(bookingRef).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.click();

    // Detail popup opened — Purge (GDPR) stays available regardless of past/cancelled state...
    await expect(page.getByText("Permanently Delete (GDPR)")).toBeVisible({ timeout: 10_000 });
    // ...but Cancel Booking must not be offered for a booking that's already passed.
    await expect(page.getByText("Cancel Booking", { exact: true })).toHaveCount(0);

    await page.keyboard.press("Escape");
  });

  test("customer lookup disables cancellation for the same past booking", async ({ page }) => {
    expect(bookingRef).toBeTruthy();
    test.setTimeout(120_000);

    // The public lookup endpoint sits behind the "public" rate-limit policy
    // (120 req/min). When it 429s, getBookingByRef returns null and the page
    // renders "No booking found" — indistinguishable from a genuine 404. This
    // is the last test of a long single-worker suite, so the window is most
    // saturated here. Cool down for a full 60s window reset before the first
    // attempt, then retry the lookup with reloads until it genuinely succeeds.
    await page.goto("/lookup");
    await expect(page.getByText("Find My Booking")).toBeVisible({ timeout: 10_000 });

    // A past (non-cancelled) booking's result panel titles itself "Booking Has Passed"
    // instead of "Booking Found" — the two are mutually exclusive, not a heading plus a
    // separate status label (BookingResultPanel.tsx).
    const passedHeading = page.getByText("Booking Has Passed");

    await expect(async () => {
      // Each pass: clear any prior error state by reloading, then re-search.
      await page.reload();
      await page.getByPlaceholder("e.g. crispy-basil-thyme").fill(bookingRef);
      await page.getByPlaceholder("The email used when booking").fill(PAST_BOOKING_EMAIL);
      await page.getByText("Look Up", { exact: true }).click();
      await expect(passedHeading).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 90_000, intervals: [5_000, 10_000, 10_000] });

    // Functional check, not just copy: a past booking drops the cancel action entirely
    // rather than rendering it disabled (BookingResultPanel.tsx).
    await expect(page.getByText("Cancel This Booking")).toHaveCount(0);
    await expect(
      page.getByText("This booking has already passed and can no longer be cancelled.")
    ).toBeVisible();
  });
});
