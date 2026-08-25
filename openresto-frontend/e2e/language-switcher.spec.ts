import { test, expect } from "@playwright/test";
import { expectVisibleWithReload } from "./helpers";

const PASTA_PLACE_ID = 1;

/**
 * Guards the i18n guest surface end to end (issue #373, moved into the navbar overflow menu by
 * issue #387): a viewer whose locale resolves to French sees translated chrome on both the home
 * page and inside the booking form, and the language picker — the overflow menu's Language row,
 * which opens a modal rather than an inline submenu (see `OverflowMenu.tsx` for why: nesting a
 * `Select`/`AnchoredPanel` inside a `menuitem` would put two anchored panels live at once) —
 * changes the language live, no reload needed, and the pick survives a reload afterwards.
 *
 * Untagged on purpose (lands in the extensive suite, not @smoke): the golden paths stay on
 * `en`, this is the one spec that exercises the translated surface.
 */
test.describe("Language switcher", () => {
  test("renders the guest surface in French, then switches back to English live via the overflow menu's language modal, and the choice survives a reload", async ({
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

    // Switch back to English via the navbar overflow menu's Language row, which opens the
    // modal chooser. LOCALE_LABELS are always written in their own language, so "English" is
    // a stable target regardless of the currently active locale.
    await page.goto("/");
    await page.getByLabel("Ouvrir le menu").click();
    await page.getByText("Langue", { exact: true }).click();
    await expect(page.getByRole("radiogroup")).toBeVisible();
    await page.getByRole("radio", { name: "English" }).click();

    // The modal dismisses on pick.
    await expect(page.getByRole("radiogroup")).toBeHidden();

    // Live: no reload between the switch and this assertion.
    await expect(page.getByRole("link", { name: "Locations" })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("link", { name: "My Bookings" })).toBeVisible();

    // Persisted: the pick survives a reload.
    await page.reload();
    await expect(page.getByRole("link", { name: "Locations" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: "My Bookings" })).toBeVisible();
  });

  test("the overflow menu trigger is reachable and opens the language modal at a mobile web width", async ({
    page,
  }) => {
    // isMobileWidth's breakpoint (constants/breakpoints.ts) is 768 — below it Navbar switches
    // to its compact layout, but OverflowMenu itself does not conditionally render, which is
    // exactly what this test pins now the footer's language fallback is gone: there must be no
    // width at which the picker is unreachable.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const trigger = page.getByLabel("Open menu");
    await expect(trigger).toBeVisible({ timeout: 15_000 });
    await trigger.click();
    await page.getByRole("menuitem", { name: "Language" }).click();

    await expect(page.getByRole("radiogroup")).toBeVisible();
    await expect(page.getByRole("radio", { name: "English" })).toBeVisible();
  });
});
