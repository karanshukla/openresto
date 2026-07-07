import { test, expect, type Browser } from "@playwright/test";
import { postWithRetry, futureDateStr } from "./helpers";
import { ADMIN_STATE_FILE } from "./global-setup";

// Seeded restaurant structure (see admin-extend.spec.ts):
//   Pasta Place (id=1)
//     Indoor (sectionId=1): T1 (id=1, 4 seats), T2 (id=2, 2 seats)
//     Patio  (sectionId=2): P1 (id=3, 4 seats)  ← used to avoid booking conflicts
const RESTAURANT_ID = 1;
const PATIO_SECTION_ID = 2;
const P1_TABLE_ID = 3;
const CANCEL_TEST_EMAIL = "e2e-customer-cancel@example.com";
// +40 days is far enough out to dodge every other spec's fixed offsets
// (booking-flow=14, booking=21, lookup=21, shortcuts-user=50 → pick 40).
const SLOT_UTC = `${futureDateStr(40)}T18:30:00.000Z`;

async function purgeCancelTestBookings(browser: Browser) {
  const ctx = await browser.newContext({ storageState: ADMIN_STATE_FILE });
  const page = await ctx.newPage();
  const res = await page.request.get(
    `/api/admin/bookings?restaurantId=${RESTAURANT_ID}&email=${encodeURIComponent(CANCEL_TEST_EMAIL)}&status=all`
  );
  if (res.ok()) {
    const bookings = (await res.json()) as Array<{ id: number }>;
    for (const b of bookings) {
      await page.request.delete(`/api/admin/bookings/${b.id}`);
    }
  }
  await ctx.close();
}

/**
 * The customer-side cancellation *happy path*.
 *
 * cancel-past-booking.spec.ts covers the guard (past bookings can't be
 * cancelled) and keyboard-shortcuts-user.spec.ts covers Esc-dismissing the
 * confirm dialog, but no spec actually walks through the real "I changed my
 * mind, cancel my upcoming booking" journey end-to-end through the /lookup UI.
 * This does: look up → confirm → booking flips to Cancelled in the UI and in
 * the DB, and a second lookup shows the now-disabled "Already Cancelled" state.
 *
 * Runs under the public "chromium" project (no admin auth) — the booking is
 * seeded via the public hold+booking APIs the same way a real customer would.
 */
test.describe("Customer cancels an upcoming booking", () => {
  test.describe.configure({ mode: "serial" });

  let bookingRef = "";

  test.beforeAll(async ({ browser, request }) => {
    await purgeCancelTestBookings(browser);

    // Acquire a hold + create the booking exactly as the booking flow does.
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
    const { holdId } = (await holdRes.json()) as { holdId: string };

    const bookingRes = await postWithRetry(
      request,
      "/api/bookings",
      {
        data: {
          restaurantId: RESTAURANT_ID,
          tableId: P1_TABLE_ID,
          sectionId: PATIO_SECTION_ID,
          customerEmail: CANCEL_TEST_EMAIL,
          customerName: "E2E Customer Cancel Test",
          seats: 2,
          date: SLOT_UTC,
          holdId,
        },
      },
      5
    );
    expect(bookingRes.ok()).toBeTruthy();
    const booking = (await bookingRes.json()) as { bookingRef: string };
    bookingRef = booking.bookingRef;
    expect(bookingRef.length).toBeGreaterThan(0);
  });

  test.afterAll(async ({ browser }) => {
    await purgeCancelTestBookings(browser);
  });

  test("cancelling via /lookup flips the booking to Cancelled and persists", async ({ page }) => {
    expect(bookingRef).toBeTruthy();

    await page.goto("/lookup");
    await expect(page.getByText("Find My Booking")).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder("e.g. crispy-basil-thyme").fill(bookingRef);
    await page.getByPlaceholder("The email used when booking").fill(CANCEL_TEST_EMAIL);
    await page.getByText("Look Up", { exact: true }).click();

    await expect(page.getByText("Booking Found")).toBeVisible({ timeout: 10_000 });

    // Open the confirm dialog, then actually confirm it (the path the Esc spec
    // deliberately avoids). ConfirmModal renders its confirm button as a
    // Pressable (text), so target the label text rather than role="button".
    await page.getByText("Cancel This Booking", { exact: true }).click();
    await expect(page.getByText("Cancel Reservation")).toBeVisible({ timeout: 10_000 });
    await page.getByText("Cancel Booking", { exact: true }).click();

    // The card re-renders in its cancelled state.
    await expect(page.getByText("Booking Cancelled")).toBeVisible({ timeout: 10_000 });

    // Functional check, not just copy: the booking's isCancelled flag is now
    // true in the DB too (re-read through the public API the UI itself uses).
    const res = await page.request.get(
      `/api/bookings/ref/${bookingRef}?email=${encodeURIComponent(CANCEL_TEST_EMAIL)}`
    );
    expect(res.ok()).toBeTruthy();
    const booking = (await res.json()) as { isCancelled: boolean };
    expect(booking.isCancelled).toBe(true);
  });

  test("a cancelled booking shows 'Already Cancelled' and cannot be cancelled again", async ({
    page,
  }) => {
    expect(bookingRef).toBeTruthy();

    await page.goto("/lookup");
    await page.getByPlaceholder("e.g. crispy-basil-thyme").fill(bookingRef);
    await page.getByPlaceholder("The email used when booking").fill(CANCEL_TEST_EMAIL);
    await page.getByText("Look Up", { exact: true }).click();

    await expect(page.getByText("Booking Cancelled")).toBeVisible({ timeout: 10_000 });

    // The button label switched to the disabled-state copy.
    const alreadyCancelled = page.getByText("Already Cancelled", { exact: true });
    await expect(alreadyCancelled).toBeVisible({ timeout: 10_000 });

    // Functional check (mirrors cancel-past-booking.spec.ts): the Pressable is
    // `disabled` in lookup.tsx, so clicking it must NOT re-open the confirm
    // dialog — proving a re-cancel is impossible, not just that the label
    // changed.
    await alreadyCancelled.click({ force: true });
    await expect(page.getByText("Cancel Reservation")).toHaveCount(0);
  });
});
