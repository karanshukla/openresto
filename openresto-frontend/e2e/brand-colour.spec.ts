import { test, expect } from "@playwright/test";
import { gotoAdminDashboard, delay } from "./helpers";
import { ADMIN_STATE_FILE } from "./global-setup";

const TEST_COLOR = "#dc2626"; // Tailwind red-600 — distinct enough to detect reliably

interface BrandDto {
  appName: string;
  primaryColor: string;
  accentColor?: string;
  faviconIcon?: string;
}

/**
 * Brand colour change propagates to the customer-facing UI.
 *
 * We set the colour via the admin API (same auth cookie as the UI would use),
 * then verify the home page Navbar renders with the new colour.  Using the API
 * for the write step avoids the flaky "Save" button selector — we already have
 * a separate smoke test that exercises settings-page navigation.
 *
 * The original colour is restored in afterAll.
 */
test.describe("Brand colour", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  let originalBrand: BrandDto;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ADMIN_STATE_FILE });
    const page = await ctx.newPage();
    await gotoAdminDashboard(page);

    const res = await page.request.get("/api/brand");
    if (!res.ok()) {
      const body = await res.text();
      console.error(`Brand fetch failed: HTTP ${res.status()}`, body);
    }
    expect(res.ok()).toBeTruthy();
    originalBrand = await res.json();

    await ctx.close();

    // Delay to let rate limits reset between test groups
    await delay(3000);
  });

  test.afterAll(async ({ browser }) => {
    if (!originalBrand) return;
    const ctx = await browser.newContext({ storageState: ADMIN_STATE_FILE });
    const page = await ctx.newPage();
    await gotoAdminDashboard(page);

    await page.request.patch("/api/brand", { data: originalBrand });
    await ctx.close();
  });

  test("changing primary colour propagates to the customer-facing navbar", async ({ page }) => {
    await gotoAdminDashboard(page);

    // ── Write the new colour via admin API ────────────────────────────────────
    const saveRes = await page.request.patch("/api/brand", {
      data: { ...originalBrand, primaryColor: TEST_COLOR },
    });
    if (!saveRes.ok()) {
      const body = await saveRes.text();
      console.error(`Brand save failed: HTTP ${saveRes.status()}`, body);
    }
    expect(saveRes.ok()).toBeTruthy();

    // ── Verify the API now returns the new colour ─────────────────────────────
    const brandRes = await page.request.get("/api/brand");
    const brand: BrandDto = await brandRes.json();
    expect(brand.primaryColor.toLowerCase()).toBe(TEST_COLOR);

    // ── Navigate to the home page as a customer would ─────────────────────────
    // BrandContext re-fetches /api/brand on page load so the new colour is applied.
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible({ timeout: 10_000 });

    // The app-name element in the Navbar uses `color: primaryColor` as an inline style.
    const appName = brand.appName || "Open Resto";
    const brandTextEl = page.getByText(appName, { exact: true }).first();
    await expect(brandTextEl).toBeVisible();

    const appliedColor = await brandTextEl.evaluate(
      (el: Element) => window.getComputedStyle(el).color
    );

    const [r, g, b] = [TEST_COLOR.slice(1, 3), TEST_COLOR.slice(3, 5), TEST_COLOR.slice(5, 7)].map(
      (h) => parseInt(h, 16)
    );
    expect(appliedColor).toBe(`rgb(${r}, ${g}, ${b})`);
  });

  test("admin settings page has a working Brand Identity section", async ({ page }) => {
    await gotoAdminDashboard(page);
    await page.goto("/settings");
    await expect(page.getByText("GLOBAL SETTINGS")).toBeVisible({ timeout: 10_000 });

    // The accordion is expanded by default — confirm the colour input is visible
    await expect(page.getByPlaceholder("#0a7ea4")).toBeVisible({ timeout: 5_000 });
    // The input value should reflect the colour we saved in the previous test
    await expect(page.getByPlaceholder("#0a7ea4")).toHaveValue(TEST_COLOR);
  });
});
