import { test, expect } from "@playwright/test";

/**
 * Guards the i18n admin surface end to end (issue #374, F5 — the last piece of the
 * per-area admin translation split): with the viewer's locale resolved to French, the
 * admin dashboard — sidebar chrome, page heading, metric labels, and quick actions —
 * renders translated copy rather than silently falling back to English.
 *
 * F1 translated `app/admin/dashboard.tsx` but scoped itself to `components/admin/bookings`
 * plus two screens, so `components/admin/dashboard/ScheduleConflictsBanner.tsx` (rendered
 * by the dashboard, not under `components/admin/bookings`) fell through the cracks and
 * shipped with no `useTranslation` at all — one feature half-translated across two files
 * (its sibling `ScheduleConflictsPanel.tsx` on `/admin/locations` was translated by F2).
 * This spec exercises the same dashboard shell the banner mounts into, so a future regression
 * that reintroduces hardcoded English anywhere on this screen shows up as an English string
 * sitting among French ones rather than silently passing.
 *
 * Untagged on purpose (extensive suite, not @smoke): the golden admin-dashboard path
 * (admin-dashboard.spec.ts) stays on English; this is the one spec that exercises the
 * translated admin surface, mirroring language-switcher.spec.ts's guest-side coverage.
 *
 * Runs under chromium-admin (storageState cookie pre-loaded by global-setup.ts) — no
 * separate login flow.
 */
test.describe("Admin locale (French)", () => {
  test("renders the admin dashboard and sidebar in French", async ({ page }) => {
    // LocaleContext resolves localStorage above brand.defaultLocale (see LocaleContext /
    // language-switcher.spec.ts), so seeding it before the first paint is enough to force
    // French without touching the backend or a second login flow.
    await page.goto("/admin/dashboard");
    await page.evaluate(() => window.localStorage.setItem("openresto.locale", "fr"));
    await page.reload();

    // Wait on the authenticated shell via a testID rather than the sidebar's lookup
    // placeholder — that placeholder is itself translated copy now, so it can't double as
    // a locale-agnostic "the page loaded" signal the way gotoAdminDashboard's English-only
    // wait does.
    await expect(page.getByTestId("sidebar-identity")).toBeVisible({ timeout: 20_000 });

    // Sidebar nav renders in French (components/layout/AdminSidebar.tsx). exact: true
    // throughout — getByRole's default name match is a case-insensitive substring, and
    // "Réservations" also matches the dashboard's "Voir toutes les réservations" quick
    // action (both the link's own accessible name and its accessibilityLabel-holding
    // sibling), which is a strict-mode violation without it.
    await expect(page.getByRole("link", { name: "Aperçu", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Réservations", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Établissements", exact: true })).toBeVisible();
    // Section headings render uppercased (AdminSidebar.tsx: heading.toUpperCase()).
    await expect(page.getByText("GÉRER", { exact: true })).toBeVisible();
    await expect(page.getByText("CONFIGURER", { exact: true })).toBeVisible();
    await expect(page.getByText("Se déconnecter", { exact: true })).toBeVisible();

    // Dashboard heading, metric cards and chart section render in French
    // (app/admin/dashboard.tsx).
    await expect(page.getByText("Tableau de bord", { exact: true })).toBeVisible();
    // .first(): the metric card and the "today's bookings" list below it deliberately
    // reuse the same admin.dashboard.metrics.todayBookings.label key (dashboard.tsx),
    // so this text legitimately renders twice — asserting either instance is enough to
    // prove the key translated.
    await expect(page.getByText("Réservations du jour", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Réservations temporaires actives", { exact: true })).toBeVisible();
    await expect(page.getByText("Statut de l'établissement", { exact: true })).toBeVisible();
    await expect(page.getByText("Total des couverts", { exact: true })).toBeVisible();
    await expect(page.getByText("Aperçu de l'occupation")).toBeVisible();
    await expect(page.getByText("7 derniers jours", { exact: true })).toBeVisible();
    await expect(page.getByText("Aujourd'hui", { exact: true })).toBeVisible();

    // Quick actions render and navigate in French.
    await expect(page.getByText("Voir toutes les réservations")).toBeVisible();
    await page.getByText("Gérer les paramètres").click();
    await page.waitForURL(/.*\/settings/, { timeout: 15_000 });
  });
});
