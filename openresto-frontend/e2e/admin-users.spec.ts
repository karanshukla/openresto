import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import { gotoAdminDashboard, expectVisibleWithReload } from "./helpers";

/**
 * Owner-only user management: invite a colleague, change their role, deactivate them.
 *
 * Every account the suite creates is keyed to a fresh email, because the API deliberately
 * has no delete endpoint — deactivate is as far as it goes — and a fixed address would
 * collide with the unique index on the second local run against the same container.
 *
 * The assertions that matter are the ones a unit test can't make: that the role the UI
 * assigns is the role the *server* then enforces on a real second session. So each step
 * checks the API's verdict for the invited user, not just the badge the Owner sees.
 */
const invitedEmail = `e2e-user-${Date.now()}@example.com`;
const INVITED_PASSWORD = "TempPass123";
const INVITED_NAME = "Alex Rivera";

/** A signed-in browser context for the invited user, independent of the Owner's cookie. */
async function signInAs(browser: Browser, email: string, password: string) {
  const ctx = await browser.newContext({ baseURL: "http://localhost:5062" });
  const res = await ctx.request.post("/api/admin/auth/login", { data: { email, password } });
  return { ctx, ok: res.ok(), status: res.status() };
}

/** The invited account's row within the Users card. */
const invitedRow = (card: Locator): Locator =>
  card.locator('[data-testid^="user-row-"]').filter({ hasText: invitedEmail });

async function openUsersCard(page: Page): Promise<Locator> {
  await gotoAdminDashboard(page);
  await page.goto("/admin/settings/users");
  // The settings page hydrates from rate-limited admin fetches; reload (after a cool-down)
  // if the card hasn't rendered, the same way the other settings specs do.
  const card = page.getByTestId("users-card");
  await expectVisibleWithReload(page, card, { timeout: 10_000 });
  // The card renders its header before the account list finishes loading; the "Add user"
  // pill only exists once it has.
  await expectVisibleWithReload(page, card.getByLabel("Add user"), { timeout: 10_000 });
  return card;
}

test.describe("Admin user management", () => {
  // Serial: each test builds on the account the previous one left behind, and they all
  // mutate the shared AdminCredentials table.
  test.describe.configure({ mode: "serial" });

  test("an Owner invites a Manager who can then sign in", async ({ page, browser }) => {
    const card = await openUsersCard(page);
    await card.getByLabel("Add user").click();
    await card.getByPlaceholder("colleague@restaurant.com").fill(invitedEmail);
    await card.getByPlaceholder("Alex Rivera").fill(INVITED_NAME);
    await card.getByPlaceholder("••••••••").fill(INVITED_PASSWORD);
    await card.getByLabel("New user role Manager").click();
    await card.getByText("Create user").click();

    await expect(card.getByText(`${invitedEmail} can now sign in.`)).toBeVisible({
      timeout: 10_000,
    });
    // Scoped to the invited user's own row rather than the whole card: earlier local runs
    // leave their accounts behind (there is no delete endpoint), so a card-wide text match
    // would collide with them.
    await expect(invitedRow(card)).toHaveCount(1);
    await expect(invitedRow(card).getByText(INVITED_NAME, { exact: true })).toBeVisible();

    // The temp password works, and the account it opens is a Manager: admin surfaces are
    // reachable, the Owner-only one is not.
    const { ctx, ok } = await signInAs(browser, invitedEmail, INVITED_PASSWORD);
    expect(ok).toBeTruthy();

    const me = await ctx.request.get("/api/admin/auth/me");
    expect(me.ok()).toBeTruthy();
    expect((await me.json()).role).toBe("Manager");

    const forbidden = await ctx.request.get("/api/admin/users");
    expect(forbidden.status()).toBe(403);

    await ctx.close();
  });

  test("promoting the Manager to Owner grants user management", async ({ page, browser }) => {
    const card = await openUsersCard(page);
    await card.getByLabel(`Make ${invitedEmail} Owner`).click();
    await expect(card.getByText(`${invitedEmail} is now Owner.`)).toBeVisible({ timeout: 10_000 });

    const { ctx } = await signInAs(browser, invitedEmail, INVITED_PASSWORD);
    const allowed = await ctx.request.get("/api/admin/users");
    expect(allowed.ok()).toBeTruthy();
    await ctx.close();
  });

  test("the last active Owner cannot be demoted or deactivated", async ({ page }) => {
    const card = await openUsersCard(page);
    // Two Owners exist at this point, so demoting the invited one back is allowed …
    await card.getByLabel(`Make ${invitedEmail} Manager`).click();
    await expect(card.getByText(`${invitedEmail} is now Manager.`)).toBeVisible({
      timeout: 10_000,
    });

    // … which leaves the signed-in Owner as the only one. Both ways of giving that last Owner
    // up are refused. The UI hides these two controls on your own row, so drive them through
    // the API — the rule is the server's, and that is where it has to hold.
    const users = await page.request.get("/api/admin/users");
    const selfId = (await page.request.get("/api/admin/auth/me").then((r) => r.json())).id;
    expect((await users.json()).filter((u: { role: string }) => u.role === "Owner")).toHaveLength(
      1
    );

    const demote = await page.request.patch(`/api/admin/users/${selfId}/role`, {
      data: { role: "Manager" },
    });
    expect(demote.status()).toBe(400);
    expect((await demote.json()).message).toContain("your own role");

    const deactivate = await page.request.patch(`/api/admin/users/${selfId}/active`, {
      data: { isActive: false },
    });
    expect(deactivate.status()).toBe(400);
    expect((await deactivate.json()).message).toContain("cannot deactivate your own account");
  });

  test("deactivating the invited user blocks their login", async ({ page, browser }) => {
    const card = await openUsersCard(page);
    await card.getByLabel(`Deactivate ${invitedEmail}`).click();
    await expect(card.getByText(`${invitedEmail} deactivated.`)).toBeVisible({ timeout: 10_000 });
    await expect(invitedRow(card).getByText("Deactivated", { exact: true })).toBeVisible();

    const { ok, status } = await signInAs(browser, invitedEmail, INVITED_PASSWORD);
    expect(ok).toBeFalsy();
    expect(status).toBe(401);
  });
});
