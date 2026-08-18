import { test, expect, type Page } from "@playwright/test";
import { expectVisibleWithReload } from "./helpers";

/**
 * The date picker's month grid, driven by the keyboard (issue #350). Three things about it only
 * exist in a browser: the ARIA a screen reader actually receives, how many Tab presses the month
 * costs, and whether focus follows the highlight. A component test sees none of them — React
 * Native's own renderer folds `aria-selected` back into `accessibilityState`, and nothing there
 * has a tab order.
 */

const DAY_CELLS = '[data-testid^="date-picker-day-"]';

/**
 * The day the calendar opened on, read off the grid rather than computed. The filter bar's
 * "today" is the restaurant's, not the browser's, so the two disagree for most of the evening
 * in a westward timezone.
 */
async function openDay(page: Page): Promise<string> {
  const testId = await page
    .locator(`${DAY_CELLS}[aria-selected="true"]`)
    .getAttribute("data-testid");
  return testId!.replace("date-picker-day-", "");
}

/** A local YYYY-MM-DD `offset` days from `from`. */
const dayFrom = (page: Page, from: string, offset: number) =>
  page.evaluate(
    ({ iso, days }) => {
      const [y, m, d] = iso.split("-").map(Number);
      const date = new Date(y, m - 1, d + days);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    },
    { iso: from, days: offset }
  );

/** Opens the Locations filter bar's date picker and waits for the keyboard to be inside it. */
async function openCalendar(page: Page): Promise<void> {
  await page.goto("/locations");
  await expectVisibleWithReload(page, page.getByTestId("locations-filter-bar"), {
    timeout: 20_000,
  });
  await page.getByTestId("date-picker-trigger").click();
  await expect(page.getByTestId("date-picker-calendar")).toBeVisible({ timeout: 10_000 });
  // react-native-web's modal trap grabs focus a frame after the open animation and the dialog
  // takes it back; pressing a key before that settles would send it to the page behind.
  await page.waitForFunction(() => {
    const card = document.querySelector('[data-testid="date-picker-calendar"]');
    return !!card && !!document.activeElement && card.contains(document.activeElement);
  });
}

/** What currently holds the keyboard, as the calendar sees it. */
const focusedCell = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el && { role: el.getAttribute("role"), testId: el.getAttribute("data-testid") };
  });

test.describe("Date picker keyboard grid", () => {
  test("costs one tab stop for the whole month, not one per day", async ({ page }) => {
    await openCalendar(page);

    // A month, so the count below is a real one and not an empty grid.
    expect(await page.locator(DAY_CELLS).count()).toBeGreaterThan(27);

    const stops = page.locator(`${DAY_CELLS}[tabindex="0"]`);
    await expect(stops).toHaveCount(1);
    await expect(stops).toHaveAttribute("data-testid", `date-picker-day-${await openDay(page)}`);
  });

  test("is a grid of days rather than a pile of buttons", async ({ page }) => {
    await openCalendar(page);
    const day = await openDay(page);

    await expect(page.getByTestId("date-picker-grid")).toHaveAttribute("role", "grid");
    await expect(page.getByTestId(`date-picker-day-${day}`)).toHaveAttribute("role", "gridcell");
    await expect(
      page.getByTestId(`date-picker-day-${await dayFrom(page, day, 1)}`)
    ).toHaveAttribute("aria-selected", "false");
  });

  test("moves the highlight, and the keyboard with it, on the arrow keys", async ({ page }) => {
    await openCalendar(page);
    const day = await openDay(page);
    const nextDay = `date-picker-day-${await dayFrom(page, day, 1)}`;
    const weekOn = `date-picker-day-${await dayFrom(page, day, 8)}`;

    await page.keyboard.press("ArrowRight");
    expect(await focusedCell(page)).toEqual({ role: "gridcell", testId: nextDay });

    await page.keyboard.press("ArrowDown");
    expect(await focusedCell(page)).toEqual({ role: "gridcell", testId: weekOn });

    // Still one tab stop, now on the day the arrows walked to.
    await expect(page.locator(`${DAY_CELLS}[tabindex="0"]`)).toHaveCount(1);
  });

  /**
   * The regression a browser is the only place to see: a day cell is a `gridcell`, so it is a
   * `div`, so Enter's default action falls through to the nearest ancestor that has one — the
   * backdrop `button` wrapping the dialog. Unconsumed, Enter dismissed the calendar and took
   * nothing.
   */
  test("takes the highlighted day on Enter", async ({ page }) => {
    await openCalendar(page);
    const nextDay = await dayFrom(page, await openDay(page), 1);

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("date-picker-calendar")).toBeHidden();

    await page.getByTestId("date-picker-trigger").click();
    await expect(page.getByTestId(`date-picker-day-${nextDay}`)).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("closes on Escape without taking a day", async ({ page }) => {
    await openCalendar(page);
    const day = await openDay(page);

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("date-picker-calendar")).toBeHidden();

    await page.getByTestId("date-picker-trigger").click();
    await expect(page.getByTestId(`date-picker-day-${day}`)).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});
