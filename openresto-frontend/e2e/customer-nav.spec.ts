import { test, expect } from "@playwright/test";

/**
 * Customer-facing navigation polish (issue #140 follow-ups). Covers paths the
 * booking/auth CRUD specs don't exercise:
 *   - 404 fallback screen renders and links home
 *   - Navbar "My Bookings" link routes to /lookup
 *   - Brand wordmark on a non-home route navigates home
 *   - ScrollToTopFab appears on small viewports after scrolling, then hides
 *     again at the top.
 *
 * These run under the default public "chromium" project — no auth needed.
 * All interactions are against static, already-mounted UI so they're fast
 * and rate-limit-immune (only one fetch chain on the home route).
 */

test.describe("Customer navigation", () => {
  test("unknown route renders the 404 fallback with a Go to home link", async ({ page }) => {
    // Intercept the API call so a slow / failing restaurant list doesn't bleed
    // into the assertion — we only care that the 404 screen mounts.
    await page.route("**/api/restaurants**", (route) => route.fulfill({ json: [] }));

    await page.goto("/this-route-does-not-exist");

    await expect(page.getByText("404")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Page not found")).toBeVisible();
    await expect(page.getByText("/this-route-does-not-exist")).toBeVisible();

    const homeLink = page.getByText("Go to home");
    await expect(homeLink).toBeVisible();
    await homeLink.click();

    // expo-router renders "/" as the home screen.
    await page.waitForURL("**/", { timeout: 10_000 });
  });

  test("navbar My Bookings link navigates to /lookup", async ({ page }) => {
    await page.goto("/");
    // Home route renders both brand + nav links; wait for the nav to mount.
    await expect(page.getByRole("link", { name: "My Bookings" })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("link", { name: "My Bookings" }).click();

    await page.waitForURL(/.*\/lookup$/, { timeout: 10_000 });
    await expect(page.getByText("Find My Booking")).toBeVisible({ timeout: 15_000 });
  });

  test("brand wordmark on a non-home route links back home", async ({ page }) => {
    // /lookup is a non-home route: Navbar renders the wordmark as a <Link href="/">
    // (showBack is true; onScrollToTop is only passed on the home route).
    await page.goto("/lookup");
    await expect(page.getByText("Find My Booking")).toBeVisible({ timeout: 15_000 });

    // The brand wordmark in the navbar — click it to go home.
    await page.getByRole("link", { name: "Open Resto" }).first().click();
    await page.waitForURL("**/", { timeout: 10_000 });
  });

  test("ScrollToTopFab appears after scrolling on small viewports and disappears at top", async ({
    page,
  }) => {
    // ScrollToTopFab only renders when width < 700 AND height > width (mobile portrait).
    // Default desktop viewport would never show it.
    await page.setViewportSize({ width: 390, height: 844 });

    // Fill the home page with content so scrolling has somewhere to go.
    await page.route("**/api/restaurants**", async (route) => {
      const fake = Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        name: `E2E Padding Restaurant ${i + 1}`,
        address: "1 Test St",
        openTime: "09:00",
        closeTime: "22:00",
        openHours: [],
        openDays: "1,2,3,4,5,6,7",
        timezone: "UTC",
        tags: [],
        walkInOnly: false,
        walkInDays: "",
        defaultBookingDurationMinutes: 60,
        sections: [
          {
            id: i * 10 + 1,
            name: "Main",
            sortOrder: 0,
            tables: [{ id: i * 10 + 2, name: "T1", seats: 2 }],
          },
        ],
      }));
      await route.fulfill({ json: fake });
    });
    await page.route("**/api/highlights**", (route) => route.fulfill({ json: [] }));

    await page.goto("/");
    // Wait for restaurant cards to render so the page is tall enough to scroll.
    // { exact: true } — otherwise "Restaurant 1" substring-matches 10/11/12.
    await expect(page.getByText("E2E Padding Restaurant 1", { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // FAB is hidden at the top.
    const fab = page.getByLabel("Scroll to top");
    await expect(fab).toHaveCount(0);

    // The home screen uses a react-native-web ScrollView, not window scroll —
    // mouse.wheel over the content fires the real onScroll that updates scrollY
    // state the FAB reads. Scroll past the 300px threshold (ScrollToTopFab.tsx).
    await page.mouse.move(200, 300);
    await page.mouse.wheel(0, 800);
    await expect(fab).toBeVisible({ timeout: 5_000 });

    // Tap FAB → the RN ScrollView scrolls back up → scrollY drops ≤ 300 → FAB
    // unmounts. The FAB disappearing IS the proof the press fired the scroll
    // callback; we can't easily read RN's internal scroll offset from DOM.
    await fab.click();
    await expect(fab).toHaveCount(0);
  });
});
