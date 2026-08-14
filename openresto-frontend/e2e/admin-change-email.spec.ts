import { test, expect } from "@playwright/test";
import {
  gotoAdminDashboard,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  expectVisibleWithReload,
} from "./helpers";

const NEW_EMAIL = "e2e-change-email@example.com";

/**
 * Admin changes the login email from Settings → Account Security.
 *
 * This rewrites the email of the bootstrap Owner — the account every other admin
 * spec signs in as — so it mutates global auth state. It runs serially and always
 * restores the original email in afterEach, even on failure, so later tests (and
 * the global-setup storageState, which is keyed to ADMIN_EMAIL) keep working.
 */
test.describe("Admin change email", () => {
  test.describe.configure({ mode: "serial" });

  test.afterEach(async ({ page }) => {
    await page.request.post("/api/admin/auth/change-email", {
      data: { currentPassword: ADMIN_PASSWORD, newEmail: ADMIN_EMAIL },
    });
  });

  test("changing email via Settings updates login credentials", async ({ page }) => {
    await gotoAdminDashboard(page);
    await page.goto("/admin/settings");
    // The Account Security card hydrates from rate-limited admin fetches;
    // reload (cool-down first) if it hasn't rendered within the window. Once
    // the heading is up the rest of the card (incl. ADMIN_EMAIL) has hydrated.
    await expectVisibleWithReload(page, page.getByText("ACCOUNT SECURITY", { exact: true }), {
      timeout: 10_000,
    });
    // The card renders in stages — the heading appears before the email row
    // finishes hydrating from the rate-limited admin fetch, so gate the email
    // on the same reload fallback rather than a bare expect. Scoped to the card:
    // the sidebar's identity block shows the same address.
    const securityCard = page.getByTestId("security-card");
    await expectVisibleWithReload(page, securityCard.getByText(ADMIN_EMAIL), { timeout: 10_000 });

    // Scoped by testID rather than DOM position — the Brand Identity card
    // also renders a "Change" button (shown when a header image is already
    // configured), so a text-based locator would need to know which one
    // comes first on the page.
    await page.getByTestId("email-change-button").click();

    await page.getByPlaceholder("new@email.com").fill(NEW_EMAIL);
    await page.getByPlaceholder("••••••••").fill(ADMIN_PASSWORD);
    await page.getByText("Update Email").click();

    await expect(page.getByText("Email changed successfully.")).toBeVisible({ timeout: 10_000 });
    await expect(securityCard.getByText(NEW_EMAIL)).toBeVisible({ timeout: 10_000 });
    // The change is pushed into the auth context, so the sidebar re-renders with it too.
    await expect(page.getByTestId("sidebar-identity").getByText(NEW_EMAIL)).toBeVisible({
      timeout: 10_000,
    });

    // The old email can no longer log in ...
    const oldLoginRes = await page.request.post("/api/admin/auth/login", {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(oldLoginRes.status()).toBe(401);

    // ... while the new email logs in successfully.
    const newLoginRes = await page.request.post("/api/admin/auth/login", {
      data: { email: NEW_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(newLoginRes.ok()).toBeTruthy();
  });
});
