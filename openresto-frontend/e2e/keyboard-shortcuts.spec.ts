import { test, expect, type Browser } from "@playwright/test";
import {
  gotoAdminDashboard,
  postWithRetry,
  futureDateStr,
  pressEscapeUntilClosed,
  expectVisibleWithReload,
} from "./helpers";
import { ADMIN_STATE_FILE } from "./global-setup";

// Seeded restaurant structure (see admin-extend.spec.ts):
//   Pasta Place (id=1) → Patio (sectionId=2): P1 (id=3, 4 seats)
// Patio/P1 avoids booking conflicts with other specs that use the Indoor table.
const RESTAURANT_ID = 1;
const PATIO_SECTION_ID = 2;
const P1_TABLE_ID = 3;

/**
 * Keyboard shortcuts (issue #140). These are admin-scoped shortcuts, so this
 * spec runs under the "chromium-admin" Playwright project (pre-loaded auth
 * cookie via global-setup) — see playwright.config.ts testMatch.
 *
 * Unit/component tests (openresto-frontend/tests/hooks/useKeyboardShortcuts.test.ts
 * and friends) already cover the hook's key-handling logic in isolation; these
 * specs instead verify the real, DOM-level behavior end-to-end in a browser —
 * something Jest cannot do in this repo (see issue #140 investigation,
 * Correction #6: the Jest config renders through react-test-renderer, not
 * jsdom/react-dom, so window-level keydown/Escape wiring is unverifiable there).
 */
test.describe("Admin keyboard shortcuts", () => {
  test.describe.configure({ mode: "serial" });

  /**
   * Purge stale e2e-shortcuts bookings from interrupted/crashed prior runs.
   *
   * Each test creates a booking at a fixed future offset on Patio/P1 and
   * cleans it up in a `finally`. But if a run is killed mid-test (timeout,
   * CI cancel, etc.) the booking is left behind at that exact table+date+time,
   * and the NEXT run's creation 409s on "already booked" — a hard failure
   * postWithRetry can't fix (it only retries 429s). Purging every
   * e2e-shortcuts-* booking on this restaurant before the suite starts keeps
   * the slots virgin regardless of how the previous run ended. Mirrors the
   * purgeTestBookings pattern in booking.spec.ts / cancel-past-booking.spec.ts.
   */
  async function purgeShortcutsBookings(browser: Browser) {
    const ctx = await browser.newContext({ storageState: ADMIN_STATE_FILE });
    const page = await ctx.newPage();
    const res = await page.request.get(
      `/api/admin/bookings?restaurantId=${RESTAURANT_ID}&status=all`
    );
    if (res.ok()) {
      const bookings = (await res.json()) as {
        id: number;
        customerEmail?: string;
      }[];
      for (const b of bookings) {
        if (b.customerEmail?.startsWith("e2e-shortcuts-")) {
          await page.request.delete(`/api/admin/bookings/${b.id}`);
        }
      }
    }
    await ctx.close();
  }

  test.beforeAll(async ({ browser }) => {
    await purgeShortcutsBookings(browser);
  });

  test.afterAll(async ({ browser }) => {
    // Belt-and-suspenders: also purge after, so a clean run leaves nothing
    // behind even if a test's own finally was skipped.
    await purgeShortcutsBookings(browser);
  });

  test("? opens and Esc closes the help overlay", async ({ page }) => {
    await gotoAdminDashboard(page);

    await page.keyboard.press("?");
    const helpText = page.getByText("Keyboard shortcuts");
    await expect(helpText).toBeVisible();

    await pressEscapeUntilClosed(page, helpText);
  });

  test("g b navigates to the bookings list", async ({ page }) => {
    await gotoAdminDashboard(page);

    await page.keyboard.press("g");
    await page.keyboard.press("b");

    await page.waitForURL(/.*\/bookings.*/, { timeout: 10_000 });
    await expect(page.getByText("Bookings", { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("/ focuses the sidebar Lookup Booking input", async ({ page }) => {
    await gotoAdminDashboard(page);

    // .first() = the AdminSidebar's global lookup input (present on every
    // admin route) — the page-local bookings-list search is a separate
    // instance further down the DOM. See issue #140 Correction #7/#8.
    const sidebarLookupInput = page.getByPlaceholder("Email or reference…").first();
    await page.keyboard.press("/");

    await expect(sidebarLookupInput).toBeFocused();
  });

  test("Esc closes an open booking detail popup", async ({ page }) => {
    await gotoAdminDashboard(page);

    const uniqueEmail = `e2e-shortcuts-${Date.now()}@example.com`;
    const bookingRes = await postWithRetry(
      page.request,
      "/api/admin/bookings",
      {
        data: {
          restaurantId: RESTAURANT_ID,
          sectionId: PATIO_SECTION_ID,
          tableId: P1_TABLE_ID,
          date: `${futureDateStr(30)}T15:00:00.000Z`,
          customerEmail: uniqueEmail,
          customerName: "E2E Shortcuts Test",
          seats: 2,
        },
      },
      5
    );
    expect(bookingRes.ok()).toBeTruthy();
    const booking = (await bookingRes.json()) as { id?: number; Id?: number };
    const createdBookingId = booking.id ?? booking.Id;

    try {
      // Page-local search (nth(1)) — a single match auto-opens the detail popup.
      // The search API sits behind the shared rate-limit window; if it 429s the
      // page shows "No booking found." even though the booking exists. Reload +
      // re-search until the detail popup actually opens.
      const detailsHeading = page.getByText("Booking Details");
      let opened = false;
      for (let attempt = 0; attempt < 3 && !opened; attempt++) {
        if (attempt > 0) {
          await page.waitForTimeout(10_000); // let the rate-limit window recover
          await page.reload();
        } else {
          await page.goto("/bookings");
        }
        const searchInput = page.getByPlaceholder("Email or reference…").nth(1);
        await expect(searchInput).toBeVisible({ timeout: 10_000 });
        await searchInput.fill(uniqueEmail);
        await page.getByText("Find", { exact: true }).click();
        try {
          await expect(detailsHeading).toBeVisible({ timeout: 8_000 });
          opened = true;
        } catch {
          // search 429'd or the page didn't hydrate — loop and retry
        }
      }
      await expect(detailsHeading).toBeVisible({ timeout: 10_000 });

      await pressEscapeUntilClosed(page, detailsHeading);
    } finally {
      if (createdBookingId) {
        await page.request.delete(`/api/admin/bookings/${createdBookingId}`);
      }
    }
  });

  test("c opens the New Booking modal from any admin page", async ({ page }) => {
    await gotoAdminDashboard(page);

    await page.keyboard.press("c");

    // "c" always routes to /(admin)/bookings?create=1 (app/(admin)/_layout.tsx),
    // which the bookings page reads on mount to open NewBookingModal. Assert
    // on "Guest email" (a field label unique to the modal) rather than "New
    // Booking" — that text also appears on the page's own toolbar button
    // regardless of modal state, which is a strict-mode ambiguity, not a
    // meaningful distinguisher of "the modal is open".
    await page.waitForURL(/.*\/bookings.*/, { timeout: 10_000 });
    await expect(page.getByText("Guest email")).toBeVisible({ timeout: 10_000 });
  });

  test("j selects a row and Enter opens its detail popup; e reopens it with the extend section visible", async ({
    page,
  }) => {
    await gotoAdminDashboard(page);

    const uniqueEmail = `e2e-shortcuts-row-${Date.now()}@example.com`;
    // ~2 years out: the bookings list sorts soonest-first by default (see
    // app/(admin)/bookings/index.tsx's `sorted`), so this booking is
    // virtually guaranteed to land LAST regardless of how many other
    // bookings this restaurant/DB already has from other specs — letting
    // "j" be driven deterministically without needing to read any
    // intermediate DOM selection state (react-native-web does not expose
    // accessibilityState.selected as aria-selected for role="button" rows,
    // so that can't be inspected directly from Playwright).
    const bookingRes = await postWithRetry(
      page.request,
      "/api/admin/bookings",
      {
        data: {
          restaurantId: RESTAURANT_ID,
          sectionId: PATIO_SECTION_ID,
          tableId: P1_TABLE_ID,
          date: `${futureDateStr(730)}T16:00:00.000Z`,
          customerEmail: uniqueEmail,
          customerName: "E2E Row Nav Test",
          seats: 2,
        },
      },
      5
    );
    expect(bookingRes.ok()).toBeTruthy();
    const booking = (await bookingRes.json()) as { id?: number; Id?: number };
    const createdBookingId = booking.id ?? booking.Id;
    expect(createdBookingId).toBeTruthy();

    try {
      await page.goto("/bookings");
      await page.getByText("List", { exact: true }).click();

      const targetRow = page.getByTestId(`booking-row-${createdBookingId}`);
      // The bookings list hydrates from a rate-limited admin fetch; reload
      // (cool-down first) if the row hasn't appeared within the window.
      await expectVisibleWithReload(page, targetRow, { timeout: 10_000 });

      // Clicking the "List" toggle leaves the browser's DOM focus on that
      // <button>. Pressing Enter while it's still focused re-triggers the
      // *button's own* native Enter-activates-focused-button behavior
      // instead of/alongside our row-open handler — verified live: with
      // focus left on the toggle, j+Enter silently does nothing; blurring
      // first makes it reliable. Not our shortcut hook's bug (it's how any
      // focused HTML button responds to Enter), but real if a user clicks
      // the toggle then immediately uses j/k/Enter.
      //
      // Blur via the DOM directly rather than clicking another element: the
      // table column headers (TIME/GUEST/...) are now sortable <button>s, so
      // clicking one would both steal focus and flip the sort out from under
      // the "j clamps onto the last row" assumption below.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

      // "j" advances the selection one row at a time and clamps at the last
      // row rather than wrapping (app/(admin)/bookings/index.tsx's
      // moveRowFocus). Press it more times than there could possibly be
      // rows so the selection deterministically lands on the last (= our)
      // row regardless of how many other bookings exist.
      const totalRows = await page.locator('[data-testid^="booking-row-"]').count();
      for (let i = 0; i < totalRows; i++) {
        await page.keyboard.press("j");
      }

      await page.keyboard.press("Enter");
      const detailsHeading = page.getByText("Booking Details");
      await expect(detailsHeading).toBeVisible({ timeout: 10_000 });
      // Scope to the dialog (react-native-web's Modal renders role="dialog")
      // and take .first() — the underlying list row (still mounted behind
      // the overlay) and the popup's own "Email"/"To:" fields all contain
      // the address, which is a strict-mode ambiguity for a bare getByText.
      await expect(page.getByRole("dialog").getByText(uniqueEmail).first()).toBeVisible();

      await pressEscapeUntilClosed(page, detailsHeading);

      // Row selection survives closing the popup (only the popup's own
      // bookingId/initialFocus state resets — see app/(admin)/bookings/index.tsx),
      // so "e" re-opens the same booking directly. This time it should
      // reveal the extend section (BookingDetailPopup's initialFocus="extend"
      // scroll effect is already unit-tested in isolation; this confirms the
      // real, live-browser click-through wiring is distinct from plain Enter).
      await page.keyboard.press("e");
      await expect(detailsHeading).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("extend-section")).toBeVisible({ timeout: 10_000 });
    } finally {
      if (createdBookingId) {
        await page.request.delete(`/api/admin/bookings/${createdBookingId}`);
      }
    }
  });

  test("admin session on a (user) route does not leak admin shortcuts; user shortcuts activate instead (scope isolation regression)", async ({
    page,
  }) => {
    await gotoAdminDashboard(page);

    // Same tab, same authenticated session — navigate into the (user) route
    // group without logging out (e.g. an admin previewing the public site).
    // React Navigation keeps the admin stack screen mounted in the
    // background rather than unmounting it (see issue #140 investigation's
    // scope-leak root cause and the two post-implement fixes it took to get
    // this right: useIsFocused -> useSegments). This asserts the admin
    // window keydown listener stays silent here, and the user layout's
    // listener is the one that responds instead.
    await page.goto("/lookup");
    await expect(page.getByText("Find My Booking")).toBeVisible({ timeout: 10_000 });

    // Admin-only shortcuts must be silent on this (user)-scoped route.
    await page.keyboard.press("c");
    await expect(page.getByText("New Booking")).not.toBeVisible({ timeout: 1_500 });

    await page.keyboard.press("g");
    await page.keyboard.press("b");
    await expect(page).toHaveURL(/\/lookup/, { timeout: 1_500 });

    // User-scope shortcuts must be the ones that respond: "?" should show
    // the end-user help table (only "l"/"Esc"/"?"), not the admin one.
    await page.keyboard.press("?");
    const helpText = page.getByText("Keyboard shortcuts");
    await expect(helpText).toBeVisible();
    await expect(page.getByText("Jump to the Find My Booking lookup")).toBeVisible();
    await expect(page.getByText("Go to Dashboard")).not.toBeVisible();

    await pressEscapeUntilClosed(page, helpText);
  });
});
