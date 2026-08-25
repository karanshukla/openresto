import { test, expect } from "@playwright/test";
import { expectVisibleWithReload } from "./helpers";

const PASTA_PLACE_ID = 1;

/**
 * Guards the i18n guest surface end to end (issue #373): a viewer whose locale resolves to
 * French sees translated chrome on both the home page and inside the booking form, and the
 * language switcher (in the guest footer) changes the language live — no reload needed — and
 * the pick survives a reload afterwards.
 *
 * Untagged on purpose (lands in the extensive suite, not @smoke): the golden paths stay on
 * `en`, this is the one spec that exercises the translated surface.
 */
test.describe("Language switcher", () => {
  test("renders the guest surface in French, then switches back to English live and the choice survives a reload", async ({
    page,
  }) => {
    // Resolution order (LocaleContext) puts a localStorage pick above brand.defaultLocale, so
    // seeding it is enough to force French without touching the backend. A one-off
    // evaluate + reload rather than addInitScript: addInitScript re-runs on every navigation
    // in this page, including the reload at the end of this test, which would silently force
    // French back on right before the persistence assertion.
    await page.goto("/");
    await page.evaluate(() => window.localStorage.setItem("openresto.locale", "fr"));
    await page.reload();

    // Home page: nav chrome and the locations section heading render in French.
    await expect(page.getByRole("link", { name: "Établissements" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("link", { name: "Mes réservations" })).toBeVisible();
    await expect(page.getByText("Nos établissements", { exact: true })).toBeVisible();

    // Booking form: opening the drawer on a seeded location renders its own copy in French.
    await page.goto("/locations");
    await expectVisibleWithReload(page, page.getByTestId("locations-filter-bar"), {
      timeout: 20_000,
    });
    await page.getByTestId(`location-book-now-${PASTA_PLACE_ID}`).click();
    const drawer = page.getByTestId("booking-drawer");
    await expect(drawer).toBeVisible({ timeout: 10_000 });
    await expect(drawer.getByText("Convives et date", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Confirmer la réservation", { exact: true })).toBeVisible();

    // Switch back to English via the footer's language switcher. LOCALE_LABELS are always
    // written in their own language, so "English" is a stable target regardless of the
    // currently active locale.
    await page.goto("/");
    await page.getByLabel("Langue", { exact: false }).click();
    await page.getByText("English", { exact: true }).click();

    // Live: no reload between the switch and this assertion.
    await expect(page.getByRole("link", { name: "Locations" })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("link", { name: "My Bookings" })).toBeVisible();

    // Persisted: the pick survives a reload.
    await page.reload();
    await expect(page.getByRole("link", { name: "Locations" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: "My Bookings" })).toBeVisible();
  });
});
