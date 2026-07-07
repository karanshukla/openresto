import { test, expect } from "@playwright/test";

/**
 * `/search` is a tiny redirect shim (app/(user)/search.tsx → <Redirect href="/" />).
 * Verifies the redirect actually lands on the home route. Trivial but free
 * coverage for a route that's easy to silently break during refactoring.
 *
 * Public "chromium" project — no auth.
 */
test.describe("/search redirect", () => {
  test("navigating to /search redirects to /", async ({ page }) => {
    await page.goto("/search");
    await page.waitForURL("**/", { timeout: 10_000 });
    // Sanity: the home page mounted (navbar present).
    await expect(page.getByRole("link", { name: "My Bookings" })).toBeVisible({
      timeout: 15_000,
    });
  });
});
