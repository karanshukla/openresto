import { test, expect, type Browser } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, futureDateStr, postWithRetry } from "./helpers";
import { ADMIN_STATE_FILE } from "./global-setup";

// Seeded restaurant structure (see admin-extend.spec.ts):
//   Pasta Place (id=1)
//     Indoor (sectionId=1): T1 (id=1, 4 seats), T2 (id=2, 2 seats)
//     Patio  (sectionId=2): P1 (id=3, 4 seats)
const RESTAURANT_ID = 1;
const PATIO_SECTION_ID = 2;
const P1_TABLE_ID = 3;
const AUTH_TEST_EMAIL = "e2e-auth-lookup@example.com";

/**
 * The auth perimeter that every other spec implicitly relies on.
 *
 * Three guarantees are checked purely at the API layer (no UI, so no
 * rate-limit-heavy navigation):
 *   1. Wrong credentials → 401.
 *   2. Admin endpoints reject unauthenticated requests → 401, but accept the
 *      same call once the storageState cookie (set by global-setup) is present.
 *   3. The public booking-ref lookup is email-gated: a correct ref paired with
 *      the wrong email returns 404 with the documented message, and the correct
 *      email returns 200.
 *
 * Runs under the "chromium-admin" project (see playwright.config.ts) so the
 * authenticated cases inherit the global-setup cookie via storageState, while
 * the unauthenticated cases spawn a fresh, cookie-less context explicitly.
 */
test.describe("Auth security perimeter", () => {
  test.describe.configure({ mode: "serial" });

  let bookingRef = "";

  async function purgeAuthTestBookings(browser: Browser) {
    const ctx = await browser.newContext({ storageState: ADMIN_STATE_FILE });
    const page = await ctx.newPage();
    const res = await page.request.get(
      `/api/admin/bookings?restaurantId=${RESTAURANT_ID}&email=${encodeURIComponent(AUTH_TEST_EMAIL)}&status=all`
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
    await purgeAuthTestBookings(browser);
  });

  test.afterAll(async ({ browser }) => {
    await purgeAuthTestBookings(browser);
  });

  // ── 1. Credentials ─────────────────────────────────────────────────────────
  test("wrong password is rejected with 401", async ({ request }) => {
    const res = await request.post("/api/admin/auth/login", {
      data: { email: ADMIN_EMAIL, password: "definitely-not-the-real-password" },
    });
    expect(res.status()).toBe(401);
  });

  test("correct credentials succeed and set the auth cookie", async ({ request }) => {
    const res = await request.post("/api/admin/auth/login", {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(res.ok()).toBeTruthy();
    // The auth cookie is what storageState persists for every other admin spec.
    const cookies = (await request.storageState()).cookies;
    expect(cookies.some((c) => c.name.includes("auth"))).toBeTruthy();
  });

  // ── 2. Admin endpoints require auth ────────────────────────────────────────
  test("admin endpoints reject an unauthenticated request with 401", async ({ browser }) => {
    // Under the chromium-admin project the inherited storageState seeds every
    // new context with the auth cookie. Passing an explicit empty storageState
    // is the documented way to opt out — proving the cookie is what authorizes.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();

    const cases = [
      ["GET", "/api/admin/overview"],
      ["GET", "/api/admin/bookings"],
      ["GET", "/api/admin/bookings/1"],
      ["POST", "/api/admin/bookings"],
      ["POST", `/api/admin/restaurants/${RESTAURANT_ID}/pause`],
    ] as const;

    for (const [method, url] of cases) {
      const res = await page.request.fetch(url, {
        method,
        data: method === "POST" ? {} : undefined,
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status(), `${method} ${url} should be 401`).toBe(401);
    }

    await ctx.close();
  });

  test("the same admin endpoints succeed once authenticated", async ({ page }) => {
    // page already carries the storageState cookie under chromium-admin.
    const overview = await page.request.get("/api/admin/overview");
    expect(overview.ok()).toBeTruthy();

    const bookingsList = await page.request.get("/api/admin/bookings");
    expect(bookingsList.ok()).toBeTruthy();
  });

  // ── 3. Public lookup is email-gated ────────────────────────────────────────
  test("create a booking via admin API to obtain a reference", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ADMIN_STATE_FILE });
    const page = await ctx.newPage();

    // postWithRetry backs off on 429 — the admin rate-limit window is shared
    // across the whole single-worker suite, so a bare post flakes under load.
    const res = await postWithRetry(
      page.request,
      "/api/admin/bookings",
      {
        data: {
          restaurantId: RESTAURANT_ID,
          sectionId: PATIO_SECTION_ID,
          tableId: P1_TABLE_ID,
          date: `${futureDateStr(28)}T17:00:00.000Z`,
          customerEmail: AUTH_TEST_EMAIL,
          customerName: "E2E Auth Lookup Test",
          seats: 2,
        },
      },
      5
    );
    expect(res.ok()).toBeTruthy();
    const booking = (await res.json()) as { bookingRef: string };
    bookingRef = booking.bookingRef;
    expect(bookingRef.length).toBeGreaterThan(0);

    await ctx.close();
  });

  test("booking-ref lookup with the wrong email returns 404", async ({ request }) => {
    expect(bookingRef).toBeTruthy();
    const res = await request.get(`/api/bookings/ref/${bookingRef}?email=wrong@example.com`);
    expect(res.status()).toBe(404);
    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/No booking found matching that reference and email/i);
  });

  test("booking-ref lookup with the correct email returns 200", async ({ request }) => {
    expect(bookingRef).toBeTruthy();
    const res = await request.get(
      `/api/bookings/ref/${bookingRef}?email=${encodeURIComponent(AUTH_TEST_EMAIL)}`
    );
    expect(res.ok()).toBeTruthy();
    const booking = (await res.json()) as { bookingRef: string; customerEmail: string };
    expect(booking.customerEmail).toBe(AUTH_TEST_EMAIL);
  });
});
