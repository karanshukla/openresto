import { test, expect, type Browser } from "@playwright/test";
import { postWithRetry, futureDateStr, pressEscapeUntilClosed } from "./helpers";
import { ADMIN_STATE_FILE } from "./global-setup";

// Seeded restaurant structure (see admin-extend.spec.ts / keyboard-shortcuts.spec.ts):
//   Pasta Place (id=1) → Patio (sectionId=2): P1 (id=3, 4 seats)
// Patio/P1 avoids booking conflicts with other specs that use the Indoor table;
// the +50-day offset here avoids colliding with the admin keyboard-shortcuts
// spec's own Patio/P1 bookings at +30/+45 days.
const RESTAURANT_ID = 1;
const PATIO_SECTION_ID = 2;
const P1_TABLE_ID = 3;
const CANCEL_TEST_EMAIL = "e2e-shortcuts-user-cancel@example.com";

async function purgeCancelTestBookings(browser: Browser) {
  const ctx = await browser.newContext({ storageState: ADMIN_STATE_FILE });
  const page = await ctx.newPage();
  const res = await page.request.get(
    `/api/admin/bookings?restaurantId=${RESTAURANT_ID}&email=${encodeURIComponent(CANCEL_TEST_EMAIL)}&status=all`
  );
  if (res.ok()) {
    const bookings = (await res.json()) as { id: number }[];
    for (const b of bookings) {
      await page.request.delete(`/api/admin/bookings/${b.id}`);
    }
  }
  await ctx.close();
}

/**
 * End-user-scoped keyboard shortcuts (issue #140). Unlike keyboard-shortcuts.spec.ts
 * (admin-scoped, runs under "chromium-admin" with a pre-loaded auth cookie),
 * these run under the default public "chromium" project — no login, matching
 * how a real anonymous customer would hit these pages.
 *
 * Note: the true home page (app/index.tsx, route "/") is a *sibling* Stack
 * screen outside the "(user)" route group (see issue #140 investigation,
 * Correction #2, and app/_layout.tsx's <Stack.Screen name="index" /> vs
 * <Stack.Screen name="(user)" />), so app/(user)/_layout.tsx — and therefore
 * its keyboard shortcuts — is never mounted there. These tests exercise
 * shortcuts from pages that genuinely are inside the "(user)" group
 * (/lookup, /book) instead of the unrelated "/" route.
 */
test.describe("End-user keyboard shortcuts", () => {
  test.beforeAll(async ({ browser }) => {
    await purgeCancelTestBookings(browser);
  });

  test.afterAll(async ({ browser }) => {
    await purgeCancelTestBookings(browser);
  });

  test("l navigates to /lookup from another end-user page and focuses the reference input", async ({
    page,
  }) => {
    await page.goto(`/book?restaurantId=${RESTAURANT_ID}`);
    await expect(page.getByTestId("locations-filter-bar")).toBeVisible({ timeout: 20_000 });

    await page.keyboard.press("l");

    await page.waitForURL(/.*\/lookup.*/, { timeout: 10_000 });
    await expect(page.getByText("Find My Booking")).toBeVisible({ timeout: 10_000 });
    // focusTarget("user-lookup") races the navigating-to screen's own mount —
    // utils/focusRegistry.ts resolves this with a pending-request handoff
    // rather than a fixed delay, so this should already be focused by now.
    await expect(page.getByPlaceholder("e.g. crispy-basil-thyme")).toBeFocused();
  });

  test("? opens the user-scope help overlay (not admin shortcuts) and Esc closes it", async ({
    page,
  }) => {
    await page.goto("/lookup");
    await expect(page.getByText("Find My Booking")).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press("?");
    const helpText = page.getByText("Keyboard shortcuts");
    await expect(helpText).toBeVisible();

    // Proves the *user*-scope table rendered, not the admin one.
    await expect(page.getByText("Jump to the Find My Booking lookup")).toBeVisible();
    await expect(page.getByText("Go to Dashboard")).not.toBeVisible();

    await pressEscapeUntilClosed(page, helpText);
  });

  test("Esc closes the cancel-reservation confirmation dialog without cancelling the booking", async ({
    page,
    request,
  }) => {
    const slotUtc = `${futureDateStr(50)}T17:00:00.000Z`;

    const holdRes = await postWithRetry(
      request,
      "/api/holds",
      {
        data: {
          restaurantId: RESTAURANT_ID,
          tableId: P1_TABLE_ID,
          sectionId: PATIO_SECTION_ID,
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
          tableId: P1_TABLE_ID,
          sectionId: PATIO_SECTION_ID,
          customerEmail: CANCEL_TEST_EMAIL,
          customerName: "E2E Shortcuts Cancel Test",
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

    await page.goto("/lookup");
    await page.getByPlaceholder("e.g. crispy-basil-thyme").fill(bookingRef);
    await page.getByPlaceholder("The email used when booking").fill(CANCEL_TEST_EMAIL);
    await page.getByText("Look Up", { exact: true }).click();
    await expect(page.getByText("Booking Found")).toBeVisible({ timeout: 10_000 });

    await page.getByText("Cancel This Booking", { exact: true }).click();
    const confirmTitle = page.getByText("Cancel Reservation");
    await expect(confirmTitle).toBeVisible({ timeout: 10_000 });

    await pressEscapeUntilClosed(page, confirmTitle);

    // The booking must still be active — Esc dismissed the dialog rather
    // than confirming the cancellation (this is the spec's own example of
    // "Esc closes cancel-confirmation dialog" for the end-user UI).
    await expect(page.getByText("Cancel This Booking", { exact: true })).toBeVisible();
    await expect(page.getByText("Booking Cancelled")).not.toBeVisible();
  });
});
