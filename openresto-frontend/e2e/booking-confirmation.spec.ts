import { test, expect, type Browser } from "@playwright/test";
import { postWithRetry, futureDateStr } from "./helpers";
import { ADMIN_STATE_FILE } from "./global-setup";

/**
 * Booking confirmation page (`/booking-confirmation/[bookingRef]`) — a door into the
 * /lookup screen rather than a page of its own: it mounts the same LookupScreen with the
 * ref/email prefilled and `justBooked` set, so it shows the "Find my booking" form beside
 * a result panel instead of a dedicated confirmation hero. Covers:
 *   - invalid ref (and no email) → the same not-found card /lookup shows
 *   - valid ref (created via API, email used as query param) → "Booking Confirmed"
 *     header, booking reference, detail rows (Email / Name / Date / Guests) all render
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
    const bookings = (await res.json()) as { id: number }[];
    for (const b of bookings) {
      await page.request.delete(`/api/admin/bookings/${b.id}`);
    }
  }
  await ctx.close();
}

test.describe("Booking confirmation page", { tag: "@smoke" }, () => {
  test.beforeAll(async ({ browser }) => {
    await purgeConfirmBookings(browser);
  });

  test.afterAll(async ({ browser }) => {
    await purgeConfirmBookings(browser);
  });

  test("invalid reference shows the same not-found card /lookup shows", async ({ page }) => {
    // No email param and a non-numeric ref means there's no ref+email lookup to run and
    // no legacy id to fall back to — LookupScreen resolves straight to notFound.
    await page.goto("/booking-confirmation/definitely-not-a-real-ref");

    await expect(page.getByText("Find my booking")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("No booking found matching that reference and email.")).toBeVisible(
      { timeout: 15_000 }
    );
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

    // The result panel titles itself "Booking Confirmed" for a justBooked link (as opposed
    // to "Booking Found" for a plain /lookup search of the same booking).
    await expect(page.getByText("Booking Confirmed")).toBeVisible({ timeout: 15_000 });

    // Booking reference echoes back somewhere on the page.
    await expect(page.getByText(bookingRef, { exact: true })).toBeVisible();

    // The card's four zones, one assertion each: the facts band (BookingFactsBand.tsx) and
    // the guest line (BookingGuestDetails.tsx), which together replaced the flat list of
    // label/value rows this used to walk.
    await expect(page.getByText("Guests").first()).toBeVisible();
    await expect(page.getByText("Booked under E2E Confirmation")).toBeVisible();
    await expect(page.getByText(CONFIRM_EMAIL).first()).toBeVisible();
  });
});
