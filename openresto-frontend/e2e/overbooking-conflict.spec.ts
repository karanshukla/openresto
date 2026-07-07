import { test, expect, type Browser } from "@playwright/test";
import { postWithRetry, getWithRetry, futureDateStr } from "./helpers";
import { ADMIN_STATE_FILE } from "./global-setup";

// Seeded restaurant structure (see admin-extend.spec.ts):
//   Pasta Place (id=1)
//     Indoor (sectionId=1): T1 (id=1, 4 seats), T2 (id=2, 2 seats)
//     Patio  (sectionId=2): P1 (id=3, 4 seats)  ← used to avoid booking conflicts
const RESTAURANT_ID = 1;
const PATIO_SECTION_ID = 2;
const P1_TABLE_ID = 3;
const OVERBOOK_EMAIL = "e2e-overbook@example.com";
// +35 days is a unique offset (booking-flow=14, booking=21, lookup=21,
// customer-cancel=40, shortcuts-user=50) so this table/date pair is virgin.
const SLOT_UTC = `${futureDateStr(35)}T19:00:00.000Z`;

interface ConflictBody {
  message?: string;
}

/**
 * Booking-integrity guards — the two `InvalidOperationException` → 409 paths
 * in BookingService.CreateBookingAsync that prevent double-booking. Neither is
 * covered by any existing spec; both are core correctness guarantees.
 *
 *   1. "currently being held by another user" — booking a held table *without*
 *      that hold's id is rejected (the excludeHoldId branch).
 *   2. "already booked for that time" — once a booking is confirmed, a second
 *      booking for the same table+date is rejected.
 *
 * Pure API, serial (the second test depends on the first's confirmed booking),
 * isolated to a unique Patio/P1 slot so it can't collide with other specs.
 */
test.describe("Overbooking is prevented (409 conflicts)", () => {
  test.describe.configure({ mode: "serial" });

  let holdId = "";
  let createdBookingId: number | undefined;

  async function purgeOverbookBookings(browser: Browser) {
    const ctx = await browser.newContext({ storageState: ADMIN_STATE_FILE });
    const page = await ctx.newPage();
    const res = await page.request.get(
      `/api/admin/bookings?restaurantId=${RESTAURANT_ID}&email=${encodeURIComponent(OVERBOOK_EMAIL)}&status=all`
    );
    if (res.ok()) {
      const bookings = (await res.json()) as Array<{ id: number }>;
      for (const b of bookings) {
        await page.request.delete(`/api/admin/bookings/${b.id}`);
      }
    }
    await ctx.close();
  }

  test.beforeAll(async ({ browser }) => {
    await purgeOverbookBookings(browser);
  });

  test.afterAll(async ({ browser, request }) => {
    // Release any lingering hold from a failed/aborted run (holds otherwise
    // linger for the full 5-minute TTL and would keep blocking the table).
    if (holdId) {
      await request.delete(`/api/holds/${holdId}`);
    }
    if (createdBookingId) {
      const ctx = await browser.newContext({ storageState: ADMIN_STATE_FILE });
      const page = await ctx.newPage();
      await page.request.delete(`/api/admin/bookings/${createdBookingId}`);
      await ctx.close();
    }
    await purgeOverbookBookings(browser);
  });

  test("booking a held table without the hold id is rejected (409)", async ({ request }) => {
    // Place a hold on the slot.
    const holdRes = await postWithRetry(
      request,
      "/api/holds",
      {
        data: {
          restaurantId: RESTAURANT_ID,
          tableId: P1_TABLE_ID,
          sectionId: PATIO_SECTION_ID,
          date: SLOT_UTC,
        },
      },
      5
    );
    expect(holdRes.ok()).toBeTruthy();
    holdId = ((await holdRes.json()) as { holdId: string }).holdId;

    // Attempt to book the same table/date WITHOUT the holdId — the excludeHoldId
    // branch in IsTableHeld keeps our hold in play, so this must conflict.
    const res = await postWithRetry(
      request,
      "/api/bookings",
      {
        data: {
          restaurantId: RESTAURANT_ID,
          tableId: P1_TABLE_ID,
          sectionId: PATIO_SECTION_ID,
          customerEmail: OVERBOOK_EMAIL,
          customerName: "E2E Overbook Held Test",
          seats: 2,
          date: SLOT_UTC,
          // deliberately omitting holdId
        },
      },
      5
    );
    expect(res.status()).toBe(409);
    const body = (await res.json()) as ConflictBody;
    expect(body.message).toMatch(/currently being held by another user/i);
  });

  test("booking the held table with the correct hold id succeeds", async ({ request }) => {
    expect(holdId).toBeTruthy();

    const res = await postWithRetry(
      request,
      "/api/bookings",
      {
        data: {
          restaurantId: RESTAURANT_ID,
          tableId: P1_TABLE_ID,
          sectionId: PATIO_SECTION_ID,
          customerEmail: OVERBOOK_EMAIL,
          customerName: "E2E Overbook Confirmed",
          seats: 2,
          date: SLOT_UTC,
          holdId, // unlocks the held table
        },
      },
      5
    );
    expect(res.ok()).toBeTruthy();
    const booking = (await res.json()) as { id: number; bookingRef: string };
    createdBookingId = booking.id;
    expect(booking.bookingRef.length).toBeGreaterThan(0);

    // The hold is released server-side once the booking is confirmed, so a
    // follow-up DELETE is a no-op (still < 300).
    const releaseRes = await request.delete(`/api/holds/${holdId}`);
    expect(releaseRes.status()).toBeLessThan(300);
  });

  test("a second booking for the same table+date is rejected (409)", async ({ request }) => {
    expect(createdBookingId).toBeTruthy();

    // No hold is active now (the previous test released it), so the held-by-other
    // guard is bypassed and the already-booked guard must fire instead.
    const res = await postWithRetry(
      request,
      "/api/bookings",
      {
        data: {
          restaurantId: RESTAURANT_ID,
          tableId: P1_TABLE_ID,
          sectionId: PATIO_SECTION_ID,
          customerEmail: OVERBOOK_EMAIL,
          customerName: "E2E Overbook Duplicate",
          seats: 2,
          date: SLOT_UTC,
        },
      },
      5
    );
    expect(res.status()).toBe(409);
    const body = (await res.json()) as ConflictBody;
    expect(body.message).toMatch(/already booked for that time/i);
  });

  test("the confirmed booking is visible in the availability slot list", async ({ request }) => {
    // Cross-check: the table that's now booked no longer shows as available for
    // this date — the same signal the customer booking UI relies on.
    const dateOnly = SLOT_UTC.split("T")[0];
    const res = await getWithRetry(
      request,
      `/api/restaurants/${RESTAURANT_ID}/availability?date=${dateOnly}&seats=2`,
      5
    );
    expect(res.ok()).toBeTruthy();
    const { slots } = (await res.json()) as {
      slots: Array<{ time: string; availableTableIds: number[] }>;
    };
    const slot = slots.find((s) => s.time === "19:00");
    expect(slot).toBeTruthy();
    expect(slot!.availableTableIds).not.toContain(P1_TABLE_ID);
  });
});
