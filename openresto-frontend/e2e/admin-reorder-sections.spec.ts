import { test, expect } from "@playwright/test";
import { gotoAdminDashboard } from "./helpers";

// Seeded restaurant structure (see admin-extend.spec.ts for the same reference table):
//   Pasta Place (id=1)
//     Indoor (sectionId=1)
//     Patio  (sectionId=2)
const RESTAURANT_ID = 1;
const INDOOR_SECTION_ID = 1;
const PATIO_SECTION_ID = 2;

/**
 * #178 — Reorderable sections per location.
 *
 * True end-to-end coverage through the real UI: navigates to the admin
 * "Locations" settings screen, clicks the move-down button on the first
 * section block (Indoor), and verifies the on-screen order flips and that
 * the new order survives a full page reload (i.e. it was actually persisted
 * through the real HTTP pipeline + database, not just local component state).
 *
 * Mirrors the existing admin-pause.spec.ts pattern of combining real UI
 * interaction with `page.request` for setup/teardown against the seeded
 * "Pasta Place" restaurant shared by other admin specs.
 */
test.describe("Admin reorder sections", () => {
  test.describe.configure({ mode: "serial" });

  test.afterEach(async ({ page }) => {
    // Always restore the seeded order (Indoor, Patio) so other specs relying
    // on Pasta Place's section/table layout aren't affected by this spec.
    await page.request.patch(`/api/admin/restaurants/${RESTAURANT_ID}/sections/reorder`, {
      data: { sectionIds: [INDOOR_SECTION_ID, PATIO_SECTION_ID] },
    });
  });

  test("moving a section down via the settings UI persists across reload", async ({ page }) => {
    await gotoAdminDashboard(page);
    await page.goto("/locations");
    await expect(page.getByText("Sections & tables")).toBeVisible({ timeout: 20_000 });

    // Sanity check the seeded starting order: Indoor above Patio.
    const indoorBefore = await page.getByText("Indoor", { exact: true }).boundingBox();
    const patioBefore = await page.getByText("Patio", { exact: true }).boundingBox();
    expect(indoorBefore).not.toBeNull();
    expect(patioBefore).not.toBeNull();
    expect(indoorBefore!.y).toBeLessThan(patioBefore!.y);

    // Click "move down" on the first section block (Indoor) — swaps it with Patio.
    await page.getByTestId("section-move-down-btn").first().click();

    // The on-screen order should flip immediately (optimistic UI update after the
    // PATCH resolves): Patio now above Indoor.
    await expect(async () => {
      const indoorAfter = await page.getByText("Indoor", { exact: true }).boundingBox();
      const patioAfter = await page.getByText("Patio", { exact: true }).boundingBox();
      expect(patioAfter!.y).toBeLessThan(indoorAfter!.y);
    }).toPass({ timeout: 10_000 });

    // Reload the page — this refetches from the API, proving the new order was
    // actually persisted server-side rather than only held in client state.
    await page.reload();
    await expect(page.getByText("Sections & tables")).toBeVisible({ timeout: 20_000 });
    const indoorAfterReload = await page.getByText("Indoor", { exact: true }).boundingBox();
    const patioAfterReload = await page.getByText("Patio", { exact: true }).boundingBox();
    expect(patioAfterReload!.y).toBeLessThan(indoorAfterReload!.y);

    // Cross-check via the public, unauthenticated restaurant endpoint too — the
    // same one the customer booking flow reads from.
    const publicRes = await page.request.get(`/api/restaurants/${RESTAURANT_ID}`);
    expect(publicRes.ok()).toBeTruthy();
    const body = await publicRes.json();
    const names = (body.sections as Array<{ name: string }>).map((s) => s.name);
    expect(names).toEqual(["Patio", "Indoor"]);
  });

  test("move-up button is disabled for the first section, move-down disabled for the last", async ({
    page,
  }) => {
    await gotoAdminDashboard(page);
    await page.goto("/locations");
    await expect(page.getByText("Sections & tables")).toBeVisible({ timeout: 20_000 });

    const moveUpButtons = page.getByTestId("section-move-up-btn");
    const moveDownButtons = page.getByTestId("section-move-down-btn");

    // react-native-web renders Pressable's `disabled` prop as `aria-disabled="true"`
    // on a plain <div> (not a native form control), so Playwright's toBeDisabled()
    // matcher (which only recognizes native disableable elements) doesn't apply —
    // assert on the aria-disabled attribute directly instead.
    // Indoor is first → its move-up button must be disabled.
    await expect(moveUpButtons.first()).toHaveAttribute("aria-disabled", "true");
    // Patio is last → its move-down button must be disabled.
    await expect(moveDownButtons.last()).toHaveAttribute("aria-disabled", "true");
  });
});
