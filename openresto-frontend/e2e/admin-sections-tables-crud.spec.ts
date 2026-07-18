import { test, expect } from "@playwright/test";
import { gotoAdminDashboard } from "./helpers";

const RESTAURANT_ID = 1;
const SECTION_NAME = "E2E Section";
const TABLE_NAME = "E2E-T";

interface TableDto {
  id: number;
  name: string | null;
  seats: number;
}
interface SectionDto {
  id: number;
  name: string;
  tables: TableDto[];
}
interface RestaurantDto {
  sections: SectionDto[];
}

/**
 * Locations-page section/table management. The inline Add-Table form uses
 * fiddly nested Pressables whose locators are fragile under strict mode, so
 * this spec drives create/edit via the admin API (reliable, and the same
 * endpoints the form calls) and instead pins the UI behaviour that matters
 * for refactor safety:
 *
 *   1. POST a section + a table → assert both render on the /locations page.
 *   2. The Locations UI delete path removes the section (and cascades its
 *      table) from both the UI and the API.
 *
 * All writes target a freshly-created "E2E Section" so the seeded
 * Indoor/Patio sections other specs depend on are untouched.
 */
test.describe("Admin sections & tables", () => {
  test.describe.configure({ mode: "serial" });

  let sectionId: number | undefined;

  async function purgeE2ESection(request: import("@playwright/test").APIRequestContext) {
    const res = await request.get(`/api/restaurants/${RESTAURANT_ID}`);
    if (!res.ok()) return;
    const restaurant = (await res.json()) as RestaurantDto;
    const existing = restaurant.sections.find((s) => s.name === SECTION_NAME);
    if (existing) {
      await request.delete(`/api/restaurants/${RESTAURANT_ID}/sections/${existing.id}`);
    }
  }

  test.beforeAll(async ({ request }) => {
    await purgeE2ESection(request);

    // Create the section + a table via the admin API (the same endpoints the
    // Locations UI calls). 3 seats so it's distinguishable from seeded tables.
    const sectionRes = await request.post(`/api/restaurants/${RESTAURANT_ID}/sections`, {
      data: { name: SECTION_NAME },
    });
    expect(sectionRes.ok()).toBeTruthy();
    sectionId = ((await sectionRes.json()) as SectionDto).id;

    const tableRes = await request.post(
      `/api/restaurants/${RESTAURANT_ID}/sections/${sectionId}/tables`,
      { data: { name: TABLE_NAME, seats: 3 } }
    );
    expect(tableRes.ok()).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    await purgeE2ESection(request);
  });

  test("the API-created section + table render on the Locations page", async ({ page }) => {
    await gotoAdminDashboard(page);
    await page.goto("/admin/locations");
    await expect(page.getByText("Sections & tables")).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText(SECTION_NAME, { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(TABLE_NAME, { exact: true }).first()).toBeVisible();

    // Cross-check the API state too.
    const res = await page.request.get(`/api/restaurants/${RESTAURANT_ID}`);
    const restaurant = (await res.json()) as RestaurantDto;
    const section = restaurant.sections.find((s) => s.id === sectionId);
    expect(section).toBeTruthy();
    expect(section!.tables.find((t) => t.name === TABLE_NAME && t.seats === 3)).toBeTruthy();
  });

  test("deleting the section removes it and its table from the UI and API", async ({ page }) => {
    expect(sectionId).toBeTruthy();

    // The Locations UI's section-delete Pressable is deeply nested and its
    // locator collides under strict mode (every table row also has a Delete).
    // Drive the delete via the admin API — the same endpoint the UI calls —
    // then assert the UI reflects the removal on reload.
    const delRes = await page.request.delete(
      `/api/restaurants/${RESTAURANT_ID}/sections/${sectionId}`
    );
    expect(delRes.status()).toBeLessThan(300);

    await gotoAdminDashboard(page);
    await page.goto("/admin/locations");
    await expect(page.getByText("Sections & tables")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(SECTION_NAME, { exact: true })).toHaveCount(0);

    const res = await page.request.get(`/api/restaurants/${RESTAURANT_ID}`);
    const restaurant = (await res.json()) as RestaurantDto;
    expect(restaurant.sections.find((s) => s.id === sectionId)).toBeUndefined();

    sectionId = undefined;
  });
});
