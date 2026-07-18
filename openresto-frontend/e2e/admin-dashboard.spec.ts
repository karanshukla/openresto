import { test, expect } from "@playwright/test";
import { gotoAdminDashboard } from "./helpers";

interface OverviewDto {
  todayBookings: number;
  activeHoldsCount: number;
  pausedRestaurantsCount: number;
  totalSeats: number;
  occupancyData: number[];
}

/**
 * The admin dashboard — the landing screen every admin hits first. No other
 * spec exercises its render path, so a refactor that breaks stats fetching,
 * the metric cards, or the quick-action navigation would slip through.
 *
 *   1. The four metric cards render with values that match /api/admin/overview.
 *   2. The 7-day Occupancy Overview axis is present (T-6 … Today).
 *   3. The "View All Bookings" and "Manage Settings" quick actions navigate
 *      to their routes.
 *
 * Runs under chromium-admin (storageState cookie pre-loaded).
 */
test.describe("Admin dashboard", () => {
  test("renders all metric cards with values matching the overview API", async ({ page }) => {
    await gotoAdminDashboard(page);

    // Pull the authoritative numbers from the same endpoint the page uses.
    const res = await page.request.get("/api/admin/overview");
    expect(res.ok()).toBeTruthy();
    const overview = (await res.json()) as OverviewDto;

    // Metric card labels are stable copy in dashboard.tsx. Use exact matches
    // — "Total Covers" otherwise substring-matches "Total covers for today".
    // "Today's Bookings" renders on both the metric card and the list header
    // further down — .first() targets the metric card.
    await expect(page.getByText("Today's Bookings", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Active Holds", { exact: true })).toBeVisible();
    await expect(page.getByText("Restaurant Status", { exact: true })).toBeVisible();
    await expect(page.getByText("Total Covers", { exact: true })).toBeVisible();

    // The Today's Bookings and Active Holds card values render as the raw
    // number (see dashboard.tsx metricCards — value: stats.todayCount / .activeHoldsCount).
    await expect(page.locator("text=" + overview.todayBookings).first()).toBeVisible();
    await expect(page.locator("text=" + overview.activeHoldsCount).first()).toBeVisible();

    // Restaurant Status reads "Active" when no restaurant is paused, "Paused" otherwise.
    const expectedStatus = overview.pausedRestaurantsCount > 0 ? "Paused" : "Active";
    await expect(page.getByText(expectedStatus, { exact: true })).toBeVisible();
  });

  test("the occupancy overview renders the 7-day axis", async ({ page }) => {
    await gotoAdminDashboard(page);

    await expect(page.getByText("Occupancy Overview")).toBeVisible();
    // { exact: true } because the occupancy summary line also contains
    // the words "last 7 days" (see OccupancyChart in dashboard.tsx).
    await expect(page.getByText("Last 7 days", { exact: true })).toBeVisible();
    // The chart axis labels (OccupancyChart.tsx) — T-6 through Today.
    for (const label of ["T-6", "T-5", "T-4", "T-3", "T-2", "T-1", "Today"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test("quick actions navigate to their destinations", async ({ page }) => {
    await gotoAdminDashboard(page);

    // "View All Bookings" is a route-style quick action (router.push).
    await page.getByText("View All Bookings").click();
    await page.waitForURL(/.*\/bookings/, { timeout: 15_000 });

    // Navigate back to the dashboard, then test "Manage Settings".
    await page.goto("/admin/dashboard");
    await page.waitForURL(/.*dashboard.*/, { timeout: 15_000 });
    await page.getByText("Manage Settings").click();
    await page.waitForURL(/.*\/settings/, { timeout: 15_000 });
  });
});
