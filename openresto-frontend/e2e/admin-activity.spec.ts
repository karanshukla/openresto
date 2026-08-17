import { test, expect, type Page } from "@playwright/test";
import { ADMIN_EMAIL, gotoAdminDashboard, expectVisibleWithReload } from "./helpers";

/**
 * The admin activity trail, end to end.
 *
 * What is worth an E2E here is the part no unit test can reach: that a real action taken
 * through the real pipeline lands a row carrying the real actor, that the trail refuses a
 * Manager the same way user management does, and — the one nobody would notice going wrong —
 * that a failed sign-in records the attempt without recording what was typed into the
 * password box.
 *
 * Every location this creates is keyed to a fresh name and deleted again, so the trail it
 * leaves behind is the point and the location itself is not.
 */

interface AuditEntry {
  id: number;
  action: string;
  actorEmail: string;
  actorDisplayName: string | null;
  actorRole: string;
  targetLabel: string | null;
  summary: string | null;
  statusCode: number;
  path: string;
  changes: { field: string; before: string | null; after: string | null }[];
}

interface AuditPage {
  items: AuditEntry[];
  totalCount: number;
}

async function readTrail(page: Page, query = ""): Promise<AuditPage> {
  const res = await page.request.get(`/api/admin/audit${query}`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as AuditPage;
}

/** A throwaway location, created through the API exactly as the admin UI does. */
async function createLocation(page: Page, name: string): Promise<number> {
  const res = await page.request.post("/api/admin/restaurants", { data: { name } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).id as number;
}

test.describe("Admin activity trail", () => {
  test("an action taken through the API lands a row naming who took it", async ({ page }) => {
    const name = `E2E Activity ${Date.now()}`;
    const id = await createLocation(page, name);

    const trail = await readTrail(page, "?action=restaurant&pageSize=100");
    const entry = trail.items.find((e) => e.path === "/api/admin/restaurants");

    expect(entry).toBeDefined();
    expect(entry!.actorEmail).toBe(ADMIN_EMAIL);
    expect(entry!.actorRole).toBe("Owner");
    expect(entry!.statusCode).toBe(201);

    // Archive-then-delete, which is the rule the API enforces anyway.
    await page.request.patch(`/api/admin/restaurants/${id}`, { data: { isArchived: true } });
    await page.request.delete(`/api/admin/restaurants/${id}`);
  });

  test("the Activity screen renders the trail", async ({ page }) => {
    const name = `E2E Visible ${Date.now()}`;
    const id = await createLocation(page, name);

    await gotoAdminDashboard(page);
    await page.goto("/admin/activity");

    // The screen hydrates from rate-limited admin fetches; reload after a cool-down if the
    // list hasn't rendered, the same way the other admin specs do.
    await expectVisibleWithReload(page, page.getByTestId("activity-list"), { timeout: 15_000 });
    await expect(page.getByTestId("activity-row").first()).toBeVisible({ timeout: 15_000 });

    await page.request.patch(`/api/admin/restaurants/${id}`, { data: { isArchived: true } });
    await page.request.delete(`/api/admin/restaurants/${id}`);
  });

  /**
   * The attempted address is recorded — that is the whole value of the entry — and the
   * attempted password is not, anywhere in the payload.
   */
  test("a failed sign-in is recorded without the password that was tried", async ({
    page,
    browser,
  }) => {
    const attempted = `e2e-nobody-${Date.now()}@example.com`;
    const secret = `WrongPassword-${Date.now()}`;

    const ctx = await browser.newContext({ baseURL: "http://localhost:5062" });
    const login = await ctx.request.post("/api/admin/auth/login", {
      data: { email: attempted, password: secret },
    });
    expect(login.status()).toBe(401);
    await ctx.close();

    const res = await page.request.get("/api/admin/audit?action=auth&pageSize=100");
    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    const trail = JSON.parse(body) as AuditPage;

    const failure = trail.items.find(
      (e) => e.action === "auth.login_failed" && e.actorEmail === attempted
    );
    expect(failure).toBeDefined();
    expect(failure!.statusCode).toBe(401);
    expect(body).not.toContain(secret);
  });

  /**
   * "Who did what" is a management function: a Manager holds a perfectly valid session and is
   * still refused, matching the gate on user management.
   */
  test("a Manager is refused the trail", async ({ page, browser }) => {
    const email = `e2e-activity-manager-${Date.now()}@example.com`;
    const password = "TempPass123";

    const created = await page.request.post("/api/admin/users", {
      data: { email, password, displayName: "Trail Reader", role: "Manager" },
    });
    expect(created.ok()).toBeTruthy();

    const ctx = await browser.newContext({ baseURL: "http://localhost:5062" });
    const login = await ctx.request.post("/api/admin/auth/login", { data: { email, password } });
    expect(login.ok()).toBeTruthy();

    const refused = await ctx.request.get("/api/admin/audit");
    expect(refused.status()).toBe(403);
    await ctx.close();
  });

  /** Notifications have DELETE; the audit trail deliberately does not. */
  test("no caller can delete an entry", async ({ page }) => {
    const before = (await readTrail(page, "?pageSize=1")).totalCount;
    expect(before).toBeGreaterThan(0);

    for (const url of ["/api/admin/audit", "/api/admin/audit/1", "/api/admin/audit/all"]) {
      expect((await page.request.delete(url)).ok()).toBeFalsy();
    }

    expect((await readTrail(page, "?pageSize=1")).totalCount).toBeGreaterThanOrEqual(before);
  });
});
