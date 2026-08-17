import { test, expect } from "@playwright/test";
import { expectVisibleWithReload } from "./helpers";

const PASTA_PLACE_ID = 1;

/**
 * The two ways into a location beyond its time chips (#328/#329): a standing "Book now"
 * CTA on every bookable card, and the card body itself as the Details toggle. Once the
 * panel is open it carries its own location picker, so a diner who opened the wrong
 * branch switches in place rather than closing it and finding the other card.
 */
test.describe("Locations card actions", () => {
  test("Book now opens the booking panel without going through a time chip", async ({ page }) => {
    await page.goto("/locations");
    await expectVisibleWithReload(page, page.getByTestId("locations-filter-bar"), {
      timeout: 20_000,
    });

    await page.getByTestId(`location-book-now-${PASTA_PLACE_ID}`).click();

    await expect(page.getByTestId("booking-drawer")).toBeVisible({ timeout: 10_000 });
  });

  test("pressing the card body expands and collapses its details", async ({ page }) => {
    await page.goto("/locations");
    await expectVisibleWithReload(page, page.getByTestId("locations-filter-bar"), {
      timeout: 20_000,
    });

    const body = page.getByTestId(`location-body-${PASTA_PLACE_ID}`);
    const openingHours = page
      .getByTestId(`location-item-${PASTA_PLACE_ID}`)
      .getByText("Opening hours");

    await expect(openingHours).toBeHidden();
    await body.click();
    await expect(openingHours).toBeVisible({ timeout: 10_000 });
    await body.click();
    await expect(openingHours).toBeHidden({ timeout: 10_000 });
  });

  test("the booking panel switches location from its own header", async ({ page }) => {
    // Read the names from the API rather than pinning the seed: the picker only appears
    // when the page lists more than one location, and this asserts on the second one.
    const listed = await (await page.request.get("/api/restaurants")).json();
    test.skip(listed.length < 2, "needs a second location to switch to");
    const first = listed.find((r: { id: number }) => r.id === PASTA_PLACE_ID) ?? listed[0];
    const second = listed.find((r: { id: number }) => r.id !== first.id);

    await page.goto("/locations");
    await expectVisibleWithReload(page, page.getByTestId("locations-filter-bar"), {
      timeout: 20_000,
    });

    await page.getByTestId(`location-book-now-${first.id}`).click();
    const drawer = page.getByTestId("booking-drawer");
    await expect(drawer).toBeVisible({ timeout: 10_000 });
    await expect(drawer).toHaveAttribute("aria-label", `Book ${first.name}`);

    await drawer.getByLabel(/^Location, /).click();
    await page.getByRole("option", { name: second.name, exact: true }).click();

    await expect(page.getByTestId("booking-drawer")).toHaveAttribute(
      "aria-label",
      `Book ${second.name}`
    );
  });
});
