import { test, expect, type Browser } from "@playwright/test";
import { buildUpdateRestaurantBody } from "./helpers";
import { ADMIN_STATE_FILE } from "./global-setup";

const PASTA_PLACE_ID = 1;
const ALL_DAY = [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, open: "00:00", close: "00:00" }));

/**
 * A guest joins the walk-in waitlist from the location card, finds the ticket in My Bookings,
 * and leaves through the in-app confirm modal.
 *
 * The server only takes guests while a walk-in-only location is open, so Pasta Place is made
 * walk-in only and open around the clock for the run, which keeps the spec independent of the
 * day and hour CI happens to run at. Restored in afterAll.
 */
test.describe("Walk-in waitlist", () => {
  let original: Record<string, unknown> | undefined;

  async function putRestaurant(browser: Browser, body: Record<string, unknown>) {
    const ctx = await browser.newContext({ storageState: ADMIN_STATE_FILE });
    const page = await ctx.newPage();
    const res = await page.request.put(`/api/restaurants/${PASTA_PLACE_ID}`, { data: body });
    expect(res.ok()).toBeTruthy();
    await ctx.close();
  }

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const res = await page.request.get(`/api/restaurants/${PASTA_PLACE_ID}`);
    original = (await res.json()) as Record<string, unknown>;
    await ctx.close();

    await putRestaurant(
      browser,
      buildUpdateRestaurantBody(original, { walkInOnly: true, openHours: ALL_DAY })
    );
  });

  test.afterAll(async ({ browser }) => {
    if (!original) return;
    await putRestaurant(browser, buildUpdateRestaurantBody(original));
  });

  test("joining puts the ticket in My Bookings, and leaving asks first", async ({ page }) => {
    await page.goto(`/book?restaurantId=${PASTA_PLACE_ID}`);
    await page.getByTestId(`location-join-waitlist-${PASTA_PLACE_ID}`).click();

    const drawer = page.getByTestId("booking-drawer");
    await drawer.getByPlaceholder("Your full name").fill("E2E Waitlist Guest");
    const joined = page.waitForResponse(
      (res) =>
        res.url().endsWith(`/api/restaurants/${PASTA_PLACE_ID}/waitlist`) &&
        res.request().method() === "POST"
    );
    await drawer.getByTestId("waitlist-join-submit").click();
    const { ref, number } = (await (await joined).json()) as { ref: string; number: number };
    await expect(drawer.getByTestId("waitlist-status-waiting")).toBeVisible();

    await page.getByRole("link", { name: "My Bookings" }).click();
    await page.waitForURL(/.*lookup.*/);
    const ticket = page.getByTestId("waitlist-status-waiting");
    await expect(ticket.getByText("Pasta Place")).toBeVisible();
    await expect(ticket.getByText(`#${number}`)).toBeVisible();

    await ticket.getByTestId("waitlist-leave").click();
    const modal = page.getByRole("alertdialog");
    await expect(modal).toBeVisible();
    await modal.getByText("Stay in Line", { exact: true }).click();
    await expect(modal).toHaveCount(0);
    await expect(ticket).toBeVisible();

    await ticket.getByTestId("waitlist-leave").click();
    await modal.getByText("Leave Waitlist", { exact: true }).click();
    await expect(ticket).toHaveCount(0);

    const res = await page.request.get(`/api/waitlist/${ref}`);
    expect(((await res.json()) as { status: string }).status).toBe("left");
  });
});
