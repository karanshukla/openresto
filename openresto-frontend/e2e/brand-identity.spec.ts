import { test, expect } from "@playwright/test";
import { gotoAdminDashboard } from "./helpers";

const TEST_APP_NAME = "E2E Bränd Café";
const TEST_PRIMARY = "#16a34a"; // Tailwind green-600 — distinct from the seeded #0a7ea4

interface BrandDto {
  appName: string;
  primaryColor: string;
  accentColor?: string | null;
  headerImageUrl?: string | null;
  websiteUrl?: string;
  faviconIcon?: string | null;
  copyrightText?: string | null;
}

/**
 * UI-driven brand identity change — the existing brand-colour.spec.ts drives
 * the write through the admin API; this one exercises the Brand Identity card
 * on /settings itself (the inputs, the Save button, the optimistic update,
 * and the cross-page propagation to the customer-facing navbar).
 *
 *   1. Change App Name + Primary Color via the settings form → Save.
 *   2. The new name + colour render on the public home page navbar.
 *   3. Reload the home page → brand persists (proves it was saved server-side,
 *      not just held in BrandContext state).
 *
 * The full original brand is restored in afterAll.
 */
test.describe("Brand identity (UI)", () => {
  test.describe.configure({ mode: "serial" });

  let original: BrandDto | undefined;

  test.beforeAll(async ({ request }) => {
    const res = await request.get("/api/brand");
    expect(res.ok()).toBeTruthy();
    original = (await res.json()) as BrandDto;
  });

  test.afterAll(async ({ request }) => {
    if (!original) return;
    await request.patch("/api/brand", { data: original });
  });

  test("changing app name + primary colour via Settings propagates to the navbar", async ({
    page,
  }) => {
    await gotoAdminDashboard(page);
    await page.goto("/admin/settings");
    await expect(page.getByText("Brand Identity")).toBeVisible({ timeout: 15_000 });

    // The Brand Identity card's App Name + Primary Color inputs.
    await page.getByPlaceholder("Open Resto").fill(TEST_APP_NAME);
    await page.getByPlaceholder("#0a7ea4").fill(TEST_PRIMARY);

    // The card's Save button (scoped by the card to avoid the Highlights card).
    await page.getByText("Save", { exact: true }).click();

    // Navigate to the customer-facing home page. BrandContext re-fetches
    // /api/brand on mount so the new name + colour are applied.
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Locations" })).toBeVisible({ timeout: 15_000 });

    const brandEl = page.getByText(TEST_APP_NAME, { exact: true }).first();
    await expect(brandEl).toBeVisible({ timeout: 10_000 });

    // The app-name element in the Navbar uses `color: primaryColor` as an
    // inline style (same assertion technique as brand-colour.spec.ts).
    const appliedColor = await brandEl.evaluate((el: Element) => window.getComputedStyle(el).color);
    const [r, g, b] = [
      TEST_PRIMARY.slice(1, 3),
      TEST_PRIMARY.slice(3, 5),
      TEST_PRIMARY.slice(5, 7),
    ].map((h) => parseInt(h, 16));
    expect(appliedColor).toBe(`rgb(${r}, ${g}, ${b})`);

    // Reload — proves persistence through the API rather than client state.
    await page.reload();
    await expect(page.getByText(TEST_APP_NAME, { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });

    // And the API itself now returns the new values.
    const res = await page.request.get("/api/brand");
    const brand = (await res.json()) as BrandDto;
    expect(brand.appName).toBe(TEST_APP_NAME);
    expect(brand.primaryColor.toLowerCase()).toBe(TEST_PRIMARY);
  });
});
