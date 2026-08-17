import { test, expect, type Locator, type Page } from "@playwright/test";
import { expectVisibleWithReload } from "./helpers";

const PASTA_PLACE_ID = 1;

/**
 * The diner's time picker, which is `Select` over the quarter-hours (issue #348 folded four
 * hand-rolled popups into one). Three things about an open dropdown only exist in a browser —
 * where it sits on screen, what it does between frames, and what holds the keyboard — so they
 * are pinned here rather than in a component test, where a ref never reports a box and nothing
 * animates.
 */

/** Opens the Locations page and the booking panel, and hands back the panel's time picker. */
async function openBookingPanel(page: Page): Promise<{ trigger: Locator; list: Locator }> {
  await page.goto("/locations");
  await expectVisibleWithReload(page, page.getByTestId("locations-filter-bar"), {
    timeout: 20_000,
  });
  await page.getByTestId(`location-book-now-${PASTA_PLACE_ID}`).click();
  await expect(page.getByTestId("booking-drawer")).toBeVisible({ timeout: 10_000 });

  return { trigger: page.getByLabel(/^Time, /), list: page.getByTestId("select-list") };
}

/** Counts scroll events, anywhere in the document, from now on. */
async function watchScrolling(page: Page): Promise<void> {
  await page.evaluate(() => {
    const counter = window as unknown as { __scrolls: number };
    counter.__scrolls = 0;
    document.addEventListener("scroll", () => (counter.__scrolls += 1), true);
  });
}

const scrollCount = (page: Page) =>
  page.evaluate(() => (window as unknown as { __scrolls: number }).__scrolls);

/**
 * Whether the row sits inside the open list's box. `toBeInViewport` cannot answer this: the rows
 * past the fold are clipped by the panel rather than moved off screen, and it calls them visible.
 */
const rowHasLanded = (list: Locator, label: string) =>
  list.evaluate((panel, wanted) => {
    const row = [...panel.querySelectorAll('[role="option"]')].find(
      (option) => option.getAttribute("aria-label") === wanted
    );
    if (!row) return false;
    const box = panel.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    return rowBox.top >= box.top - 1 && rowBox.bottom <= box.bottom + 1;
  }, label);

test.describe("Time picker", () => {
  /**
   * The list positions itself at the current value as it opens. Doing that with a smooth scroll
   * animates through every row in between, so a diner on a late sitting pressed the field and
   * watched it race fifty rows down. One scroll, not fifty.
   */
  test("opens at the selected time instead of scrolling down to it", async ({ page }) => {
    const { trigger, list } = await openBookingPanel(page);

    await trigger.click();
    await expect(list).toBeVisible({ timeout: 10_000 });
    const options = list.getByRole("option");
    const last = options.nth((await options.count()) - 1);
    const lastTime = await last.getAttribute("aria-label");
    await last.click();
    await expect(trigger).toHaveAttribute("aria-label", `Time, ${lastTime}`);

    // The panel has to be gone rather than merely hidden: a reopen that reuses the same list
    // inherits its scroll position, so it would have nowhere to travel and nothing to prove.
    await expect(list).toHaveCount(0, { timeout: 10_000 });

    await watchScrolling(page);
    await trigger.click();
    await expect(list).toBeVisible({ timeout: 10_000 });

    // The row lands either way — the guard is how it got there. Animating fires a scroll event
    // per frame the whole way down; landing on it fires one.
    await expect.poll(() => rowHasLanded(list, lastTime!), { timeout: 10_000 }).toBe(true);
    expect(await scrollCount(page)).toBeLessThanOrEqual(3);
  });

  /**
   * The Modal keeps the panel mounted for its fade-out. Releasing the trigger's measurement in
   * the handler that closes it therefore left the panel with no anchor mid-fade, so it tore off
   * its control and faded out from the middle of the screen as the centred sheet — which reads
   * as a second, older picker popping up over the one just used.
   */
  test("stays on its trigger while it fades away", async ({ page }) => {
    const { trigger, list } = await openBookingPanel(page);

    await trigger.click();
    await expect(list).toBeVisible({ timeout: 10_000 });
    const anchor = (await trigger.boundingBox())!;

    // Sampled per frame from the press that commits: the tear only shows between frames, and by
    // the time an assertion could look, the panel is gone.
    await page.evaluate(() => {
      const recorder = window as unknown as { __frames: { position: string; left: number }[] };
      recorder.__frames = [];
      const sample = (frame: number) => {
        const panel = document.querySelector('[data-testid="select-list"]');
        if (panel) {
          recorder.__frames.push({
            position: getComputedStyle(panel).position,
            left: Math.round(panel.getBoundingClientRect().left),
          });
        }
        if (frame < 40) requestAnimationFrame(() => sample(frame + 1));
      };
      sample(0);
    });
    await list.getByRole("option").first().click();
    await page.waitForTimeout(800);

    const frames = await page.evaluate(
      () => (window as unknown as { __frames: { position: string; left: number }[] }).__frames
    );
    expect(frames.length).toBeGreaterThan(5);
    // The centred sheet is laid out by the backdrop's flex centring; the dropdown is placed
    // absolutely against its trigger. Both assertions, so neither shape can pass on its own.
    expect(frames.every((frame) => frame.position === "absolute")).toBe(true);
    expect(frames.every((frame) => Math.abs(frame.left - anchor.x) <= 2)).toBe(true);
  });
});

/**
 * The booking panel is a bottom sheet on a phone, which puts the picker's Modal inside another
 * Modal. react-native-web gives each one a focus trap, and the two hand focus back and forth
 * until it settles on the picker's backdrop — leaving every key the list listens for landing
 * somewhere else.
 */
test.describe("Time picker on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("hands the open list the keyboard, not the backdrop behind it", async ({ page }) => {
    const { trigger, list } = await openBookingPanel(page);

    await trigger.click();
    await expect(list).toBeVisible({ timeout: 10_000 });

    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute("role")), {
        timeout: 10_000,
      })
      .toBe("listbox");

    const highlighted = await list.getAttribute("aria-activedescendant");
    await page.keyboard.press("ArrowDown");
    await expect(list).not.toHaveAttribute("aria-activedescendant", highlighted!);
  });
});
