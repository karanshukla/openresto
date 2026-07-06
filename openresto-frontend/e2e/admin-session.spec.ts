import { test, expect } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./helpers";

/**
 * The admin auth-session lifecycle. Every admin spec implicitly depends on the
 * cookie set in global-setup; this spec pins the three guarantees that cookie
 * is supposed to provide:
 *
 *   1. `GET /api/admin/auth/me` returns the logged-in email while the cookie
 *      is present (the AuthContext.checkSession call the admin layout uses to
 *      decide whether to render or redirect).
 *   2. Without the cookie, `me` is 401 and the admin layout redirects to
 *      /login — the gate that stops unauthenticated admin access at the UI.
 *   3. `POST /api/admin/auth/logout` invalidates the session: a subsequent
 *      `me` is 401 and /dashboard bounces to /login.
 *
 * Runs under the chromium-admin project (page carries the storageState cookie).
 * afterAll re-seeds the cookie by logging in again so the order-independent
 * storageState shared with the rest of the suite is valid for later specs.
 */
test.describe("Admin session lifecycle", () => {
  test.describe.configure({ mode: "serial" });

  test.afterAll(async ({ request }) => {
    // Other admin specs reuse the storageState cookie written by global-setup;
    // logout (test 3) clears it for this context only, but re-login here keeps
    // the shared cookie file's session alive regardless of run order.
    await request.post("/api/admin/auth/login", {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
  });

  test("me returns the authenticated admin's email", async ({ request }) => {
    const res = await request.get("/api/admin/auth/me");
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { email: string };
    expect(body.email).toBe(ADMIN_EMAIL);
  });

  test("me is 401 without the auth cookie", async ({ browser }) => {
    // A fresh context with empty storageState carries no cookie — mirroring
    // auth-security.spec.ts's pattern for proving the cookie is what authorizes.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.request.get("/api/admin/auth/me");
    expect(res.status()).toBe(401);
    await ctx.close();
  });

  test("an unauthenticated visit to /dashboard redirects to /login", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/dashboard");
    // The admin layout's checkSession flips authState to "unauthenticated" on
    // a 401 and router.replace's to /(admin)/login.
    await page.waitForURL(/.*\/login/, { timeout: 15_000 });
    await expect(page.getByText("Sign in", { exact: true })).toBeVisible({ timeout: 10_000 });
    await ctx.close();
  });

  test("logout clears the session and bounces /dashboard to /login", async ({ page }) => {
    // page carries the auth cookie under chromium-admin.
    const logoutRes = await page.request.post("/api/admin/auth/logout");
    expect(logoutRes.ok()).toBeTruthy();

    // The cookie is deleted server-side; a follow-up me call is now 401.
    const meRes = await page.request.get("/api/admin/auth/me");
    expect(meRes.status()).toBe(401);

    // And navigating to the dashboard now redirects to /login.
    await page.goto("/dashboard");
    await page.waitForURL(/.*\/login/, { timeout: 15_000 });
    await expect(page.getByText("Sign in", { exact: true })).toBeVisible({ timeout: 10_000 });
  });
});
