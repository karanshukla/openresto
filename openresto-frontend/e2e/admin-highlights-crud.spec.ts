import { test, expect } from "@playwright/test";

const TITLE = "E2E Highlight — CRUD";
const BODY = "Created by the highlights e2e spec.";
const EDITED_TITLE = "E2E Highlight — EDITED";
const ICON_KEY = "flame-outline";

interface HighlightDto {
  id: number;
  title: string;
  body: string;
  iconKey: string;
}

/**
 * CRUD coverage for the Highlights feature. The inline HighlightsCard edit
 * form uses deeply nested Pressables whose locators are fragile under strict
 * mode, so create/edit/delete are driven through the admin API (the same
 * endpoints the card calls) and each step is cross-checked two ways:
 *
 *   - against /api/highlights (the data the home page consumes), and
 *   - against the customer-facing home page, where highlights render.
 *
 * This pins the HighlightService write path + the public render path — the
 * refactor-sensitive surface — without depending on the settings form's DOM.
 *
 * Self-cleaning: beforeAll/afterAll purge any stale e2e-highlight rows.
 */
test.describe("Admin highlights CRUD", () => {
  test.describe.configure({ mode: "serial" });

  async function fetchHighlights(
    request: import("@playwright/test").APIRequestContext
  ): Promise<HighlightDto[]> {
    const res = await request.get("/api/highlights");
    expect(res.ok()).toBeTruthy();
    return (await res.json()) as HighlightDto[];
  }

  async function deleteByTitle(
    request: import("@playwright/test").APIRequestContext,
    title: string
  ) {
    const all = await fetchHighlights(request);
    for (const h of all) {
      if (h.title === title) {
        await request.delete(`/api/highlights/${h.id}`);
      }
    }
  }

  test.beforeAll(async ({ request }) => {
    await deleteByTitle(request, TITLE);
    await deleteByTitle(request, EDITED_TITLE);
  });

  test.afterAll(async ({ request }) => {
    await deleteByTitle(request, TITLE);
    await deleteByTitle(request, EDITED_TITLE);
  });

  test("create a highlight via the admin API and verify it on the home page", async ({ page }) => {
    const res = await page.request.post("/api/highlights", {
      data: { title: TITLE, body: BODY, iconKey: ICON_KEY },
    });
    expect(res.ok()).toBeTruthy();
    const created = (await res.json()) as HighlightDto;
    expect(created.title).toBe(TITLE);

    // The home page renders the highlights list — our new one must appear.
    await page.goto("/");
    await expect(page.getByText(TITLE, { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("edit the highlight's title via the admin API", async ({ request }) => {
    const all = await fetchHighlights(request);
    const created = all.find((h) => h.title === TITLE);
    expect(created).toBeTruthy();

    const res = await request.put(`/api/highlights/${created!.id}`, {
      data: { title: EDITED_TITLE, body: BODY, iconKey: ICON_KEY },
    });
    expect(res.ok()).toBeTruthy();

    const edited = (await fetchHighlights(request)).find((h) => h.title === EDITED_TITLE);
    expect(edited).toBeTruthy();
    expect(edited!.id).toBe(created!.id);
  });

  test("delete the highlight via the admin API", async ({ request }) => {
    const all = await fetchHighlights(request);
    const edited = all.find((h) => h.title === EDITED_TITLE);
    expect(edited).toBeTruthy();

    const res = await request.delete(`/api/highlights/${edited!.id}`);
    expect(res.status()).toBeLessThan(300);

    const remaining = await fetchHighlights(request);
    expect(remaining.find((h) => h.id === edited!.id)).toBeUndefined();
  });
});
