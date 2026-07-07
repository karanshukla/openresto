import { test, expect, type Browser } from "@playwright/test";
import { postWithRetry, futureDateStr } from "./helpers";
import { ADMIN_STATE_FILE } from "./global-setup";

/**
 * Booking confirmation page (`/booking-confirmation/[bookingRef]`). Covers:
 *   - invalid ref → "Booking not found." fallback + Back to Home button
 *   - valid ref (created via API, email used as query param) → header, booking
 *     reference, detail rows (Email / Name / Date / Guests) all render
 *
 * Public "chromium" project — the page only reads by ref+email, no auth.
 * Self-cleaning: beforeAll purges any leftover bookings targeted at
 * CONFIRM_EMAIL (a previous crashed run can leave a booking at the +60-day
 * slot and cause the next run's hold to 409).
 */

const RESTAURANT_ID = 1;
const SECTION_ID = 2; // Patio
const TABLE_ID = 3; // P1 (4 seats) — avoids Indoor table used elsewhere
const CONFIRM_EMAIL = "e2e-confirmation@example.com";

async function purgeConfirmBookings(browser: Browser) {
  // /api/admin/bookings is admin-gated — needs the auth cookie even though
  // the spec itself runs unauthenticated.
  const ctx = await browser.newContext({ storageState: ADMIN_STATE_FILE });
  const page = await ctx.newPage();
  const res = await page.request.get(
    `/api/admin/bookings?restaurantId=${RESTAURANT_ID}&email=${encodeURIComponent(CONFIRM_EMAIL)}&status=all`
  );
  if (res.ok()) {
    const bookings = (await res.json()) as Array<{ id: number }>;
    for (const b of bookings) {
      await page.request.delete(`/api/admin/bookings/${b.id}`);
    }
  }
  await ctx.close();
}

test.describe("Booking confirmation page", () => {
  test.beforeAll(async ({ browser }) => {
    await purgeConfirmBookings(browser);
  });

  test.afterAll(async ({ browser }) => {
    await purgeConfirmBookings(browser);
  });

  test("invalid reference shows the not-found fallback and a Back to Home link", async ({
    page,
  }) => {
    // No email param means getBookingByRef will 404; the page renders its
    // !booking branch.
    await page.goto("/booking-confirmation/definitely-not-a-real-ref");

    await expect(page.getByText("Booking not found.")).toBeVisible({ timeout: 15_000 });

    const backHome = page.getByText("Back to Home");
    await expect(backHome).toBeVisible();
    await backHome.click();
    await page.waitForURL("**/", { timeout: 10_000 });
  });

  test("valid booking reference renders confirmation header, ref, and detail rows", async ({
    request,
    page,
  }) => {
    // 1. Hold + book via the API.
    const slotUtc = `${futureDateStr(60)}T17:00:00.000Z`;

    const holdRes = await postWithRetry(
      request,
      "/api/holds",
      {
        data: {
          restaurantId: RESTAURANT_ID,
          tableId: TABLE_ID,
          sectionId: SECTION_ID,
          date: slotUtc,
        },
      },
      5
    );
    expect(holdRes.ok()).toBeTruthy();
    const { holdId } = (await holdRes.json()) as { holdId: string };

    const bookingRes = await postWithRetry(
      request,
      "/api/bookings",
      {
        data: {
          restaurantId: RESTAURANT_ID,
          tableId: TABLE_ID,
          sectionId: SECTION_ID,
          customerEmail: CONFIRM_EMAIL,
          customerName: "E2E Confirmation",
          seats: 2,
          date: slotUtc,
          holdId,
        },
      },
      5
    );
    expect(bookingRes.ok()).toBeTruthy();
    const booking = (await bookingRes.json()) as { bookingRef?: string; BookingRef?: string };
    const bookingRef = booking.bookingRef ?? booking.BookingRef ?? "";
    expect(bookingRef.length).toBeGreaterThan(0);

    // 2. Visit the confirmation page with the email query param the screen reads.
    await page.goto(
      `/booking-confirmation/${bookingRef}?email=${encodeURIComponent(CONFIRM_EMAIL)}`
    );

    // The header uses "{guests} guests at {restaurant name}".
    await expect(page.getByText(/2 guests at/)).toBeVisible({ timeout: 15_000 });

    // Booking reference echoes back somewhere on the page.
    await expect(page.getByText(bookingRef, { exact: true })).toBeVisible();

    // Detail rows built by BookingDetailRows.tsx — assert a representative subset.
    await expect(page.getByText("Email").first()).toBeVisible();
    await expect(page.getByText(CONFIRM_EMAIL).first()).toBeVisible();
    await expect(page.getByText("Name").first()).toBeVisible();
    await expect(page.getByText("E2E Confirmation").first()).toBeVisible();
    await expect(page.getByText("Guests").first()).toBeVisible();
  });
});
