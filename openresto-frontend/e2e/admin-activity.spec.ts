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

  /**
   * The whole product in one test: take an action, then find that action — not merely some
   * activity — on the screen, and open it to see the request behind it.
   *
   * Matched on the location's own unique name rather than on the summary's phrasing, so an
   * edit to the wording of a summary doesn't fail a test that is about the trail working.
   */
  test("an action appears on the Activity screen, and expands to show the request", async ({
    page,
  }) => {
    const name = `E2E Visible ${Date.now()}`;
    const id = await createLocation(page, name);

    await gotoAdminDashboard(page);
    await page.goto("/admin/activity");

    // The screen hydrates from rate-limited admin fetches; reload after a cool-down if the
    // list hasn't rendered, the same way the other admin specs do.
    await expectVisibleWithReload(page, page.getByTestId("activity-list"), { timeout: 15_000 });

    const row = page.getByTestId("activity-row").filter({ hasText: name });
    await expect(row).toHaveCount(1, { timeout: 15_000 });
    await expect(row).toContainText(ADMIN_EMAIL);
    await expect(row).toContainText("201");

    await row.click();
    const detail = page.getByTestId(/^activity-detail-/);
    await expect(detail).toContainText("POST /api/admin/restaurants → 201");

    await page.request.patch(`/api/admin/restaurants/${id}`, { data: { isArchived: true } });
    await page.request.delete(`/api/admin/restaurants/${id}`);
  });

  /**
   * The same loop driven entirely through the UI, on the one path where the actor is resolved
   * by the service rather than read off a token: signing in has no session yet, so the entry's
   * actor comes from an explicit `AttributeTo` and nothing else would catch it being wrong.
   */
  test("a sign-in performed through the login form shows up attributed to that person", async ({
    page,
    browser,
  }) => {
    // The display name has to be as unique as the email: it is what the actor pill is labelled
    // with, and the API has no delete endpoint, so a fixed one would leave two identically
    // named pills behind on the second local run against the same container.
    const stamp = Date.now();
    const email = `e2e-activity-signin-${stamp}@example.com`;
    const password = "TempPass123";
    const displayName = `Robin Signin ${stamp}`;

    const created = await page.request.post("/api/admin/users", {
      data: { email, password, displayName, role: "Manager" },
    });
    expect(created.ok()).toBeTruthy();
    const userId = (await created.json()).id as number;

    // The control. Without it this test would still pass against a build that recorded a
    // sign-in for everyone, or one that recorded the account's creation as a sign-in — it is
    // the before/after pair, not the sighting, that shows the entry came from the act below.
    const before = await readTrail(page, `?actorUserId=${userId}&action=auth&pageSize=100`);
    expect(before.items.filter((e) => e.action === "auth.login")).toHaveLength(0);

    // A context of its own, with no stored cookie: this signs in the way a person does.
    const ctx = await browser.newContext({ baseURL: "http://localhost:5062" });
    const theirPage = await ctx.newPage();
    await theirPage.goto("/admin/login");
    await theirPage.locator("input[type=email]").fill(email);
    await theirPage.locator("input[type=password]").fill(password);
    await theirPage.getByRole("button", { name: /sign in/i }).click();
    await theirPage.waitForURL(/\/admin\/dashboard/, { timeout: 20_000 });
    await ctx.close();

    // Back as the Owner, narrowed to that person: the filter is how a reviewer would actually
    // arrive at this, and it proves the entry carries a resolved user id rather than an email alone.
    await gotoAdminDashboard(page);
    await page.goto("/admin/activity");
    await expectVisibleWithReload(page, page.getByTestId("activity-list"), { timeout: 15_000 });

    // The person filter is a Select: open the trigger, then pick the option. Matched on the
    // trigger's prefix rather than its whole name, which carries the current selection.
    const personFilter = page.getByRole("combobox", { name: /^Filter by person, / });
    await personFilter.click();

    // The options hang off the trigger rather than floating in the middle of the screen. Only a
    // browser can tell the difference — a React ref is a DOM node with a real box here and a
    // component instance under Jest — so this is the assertion that holds the anchoring up.
    //
    // Measured on the panel, not on an option: an option sits partway down the list, so its own
    // box says nothing about where the list is. Tolerances are tight enough to fail a centred
    // sheet, which would sit halfway down the viewport and nowhere near the trigger's left edge.
    const panel = page.getByRole("listbox");
    await expect(panel).toBeVisible();
    const trigger = await personFilter.boundingBox();
    const menu = await panel.boundingBox();
    expect(menu!.y).toBeGreaterThanOrEqual(trigger!.y + trigger!.height);
    expect(menu!.y).toBeLessThan(trigger!.y + trigger!.height + 40);
    expect(Math.abs(menu!.x - trigger!.x)).toBeLessThan(24);

    await page.getByRole("option", { name: displayName, exact: true }).click();

    const rows = page.getByTestId("activity-row");
    await expect(rows.first()).toContainText(displayName, { timeout: 15_000 });
    await expect(rows.first()).toContainText("Manager");

    const after = await readTrail(page, `?actorUserId=${userId}&action=auth&pageSize=100`);
    const signIns = after.items.filter((e) => e.action === "auth.login");
    expect(signIns).toHaveLength(1);
    expect(signIns[0].actorDisplayName).toBe(displayName);
    expect(signIns[0].actorRole).toBe("Manager");
    expect(signIns[0].statusCode).toBe(200);
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

  /**
   * The `Select` is the app's one dropdown, and until #348 it could be reached by keyboard and
   * then not used with one: nothing opened it, nothing moved through it, nothing picked from it,
   * and Escape did not close it. Only a browser can show this — under Jest the list never takes
   * DOM focus and no key ever reaches it — so the whole path is exercised here in one go.
   */
  test("the activity filter is operable with the keyboard alone", async ({ page }) => {
    await gotoAdminDashboard(page);
    await page.goto("/admin/activity");
    await expectVisibleWithReload(page, page.getByTestId("activity-list"), { timeout: 15_000 });

    const filter = page.getByRole("combobox", { name: /^Filter by activity, / });
    await filter.focus();
    await page.keyboard.press("ArrowDown");

    // Opening moves focus onto the list itself, which is what makes one keydown handler enough
    // however many rows it holds.
    const list = page.getByRole("listbox");
    await expect(list).toBeVisible();
    await expect(list).toBeFocused();

    // Type-ahead: "s" reaches "Sign-ins" without arrowing past everything before it.
    await page.keyboard.press("s");
    const signIns = page.getByRole("option", { name: "Sign-ins", exact: true });
    const signInsId = await signIns.getAttribute("id");
    expect(signInsId).toBeTruthy();
    await expect(list).toHaveAttribute("aria-activedescendant", signInsId!);

    await page.keyboard.press("Enter");
    await expect(list).toBeHidden();
    await expect(
      page.getByRole("combobox", { name: "Filter by activity, Sign-ins" })
    ).toBeVisible();

    // Escape backs out without changing the value, and hands focus back to the trigger it came
    // from — without which a keyboard user lands at the top of the document instead.
    const reopened = page.getByRole("combobox", { name: /^Filter by activity, / });
    await reopened.focus();
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(page.getByRole("listbox")).toBeHidden();
    await expect(reopened).toBeFocused();
    await expect(
      page.getByRole("combobox", { name: "Filter by activity, Sign-ins" })
    ).toBeVisible();
  });
});
