import { test, expect, type Locator, type Page } from "@playwright/test";
import { expectVisibleWithReload } from "./helpers";

const PASTA_PLACE_ID = 1;

/**
 * The diner's time picker, which is `Select` over the quarter-hours (issue #348 folded four
 * hand-rolled popups into one). Three things about an open dropdown only exist in a browser —
 * where it is on screen, what it does between frames, and what has focus — so they are pinned
 * here rather than in a component test, where a ref never reports a box and nothing animates.
 */

/** Opens the Locations page and the booking panel, and hands back the panel's Time trigger. */
async function openTimePicker(page: Page): Promise<{ trigger: Locator; list: Locator }> {
  await page.goto("/locations");
  await expectVisibleWithReload(page, page.getByTestId("locations-filter-bar"), {
    timeout: 20_000,
  });
  await page.getByTestId(`location-book-now-${PASTA_PLACE_ID}`).click();
  await expect(page.getByTestId("booking-drawer")).toBeVisible({ timeout: 10_000 });

  return { trigger: page.getByLabel(/^Time, /), list: page.getByTestId("select-list") };
}

/** Counts scroll events from now on, anywhere in the document. */
async function watchScrolling(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __scrolls: number };
    w.__scrolls = 0;
    document.addEventListener("scroll", () => (w.__scrolls += 1), true);
  });
}

const scrollCount = (page: Page) =>
  page.evaluate(() => (window as unknown as { __scrolls: number }).__scrolls);

/**
 * Whether the row is inside the open list's box. `toBeInViewport` can't answer this: the rows
 * below the fold are clipped by the panel, not moved off screen, and it reports them visible.
 */
const rowHasLanded = (page: Page, label: string) =>
  page.evaluate((wanted) => {
    const panel = document.querySelector('[data-testid="select-list"]');
    const row = [...document.querySelectorAll('[role="option"]')].find(
      (option) => option.getAttribute("aria-label") === wanted
    );
    if (!panel || !row) return false;
    const box = panel.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    return rowBox.top >= box.top - 1 && rowBox.bottom <= box.bottom + 1;
  }, label);

test.describe("Time picker", () => {
  /**
   * The list positions itself at the current value on open. Doing that with a smooth scroll
   * animates through every row in between, so picking a late sitting and reopening sent the
   * list flying down fifty rows while the diner watched. One scroll, not eighty.
   */
  test("opens at the selected time instead of scrolling down to it", async ({ page }) => {
    const { trigger, list } = await openTimePicker(page);

    await trigger.click();
    await expect(list).toBeVisible({ timeout: 10_000 });
    const options = list.getByRole("option");
    const last = options.nth((await options.count()) - 1);
    const lastTime = await last.getAttribute("aria-label");
    await last.click();
    await expect(trigger).toHaveAttribute("aria-label", `Time, ${lastTime}`);

    await watchScrolling(page);
    await trigger.click();
    await expect(list).toBeVisible({ timeout: 10_000 });

    // The row has to be there either way — the guard is how it got there. Animating fires a
    // scroll event per frame the whole way down; landing on it fires one.
    console.log(
      "DEBUG",
      JSON.stringify(
        await page.evaluate((wanted) => {
          const panels = [...document.querySelectorAll('[data-testid="select-list"]')];
          return panels.map((panel) => {
            const rows = [...panel.querySelectorAll('[role="option"]')];
            const row = rows.find((o) => o.getAttribute("aria-label") === wanted);
            const b = panel.getBoundingClientRect();
            const r = row && row.getBoundingClientRect();
            const scroller = panel.querySelector("div");
            return {
              rows: rows.length,
              panel: [Math.round(b.top), Math.round(b.bottom), Math.round(b.width)],
              row: r && [Math.round(r.top), Math.round(r.bottom)],
              scrollTop: scroller && scroller.scrollTop,
              hidden: getComputedStyle(panel).display,
            };
          });
        }, lastTime!)
      )
    );
    await expect.poll(() => rowHasLanded(page, lastTime!), { timeout: 10_000 }).toBe(true);
    console.log("DEBUG after", await scrollCount(page));
    expect(await scrollCount(page)).toBeLessThanOrEqual(3);
  });

  /**
   * The Modal keeps the panel mounted for its fade-out. Releasing the trigger's measurement in
   * the handler that closes it left the panel with no anchor mid-fade, so it tore off the
   * control and faded out from the middle of the screen as the centred sheet — which reads as
   * a second, older picker popping up behind the one you just used.
   */
  test("stays on its trigger while it fades away", async ({ page }) => {
    const { trigger, list } = await openTimePicker(page);

    await trigger.click();
    await expect(list).toBeVisible({ timeout: 10_000 });
    const anchor = (await trigger.boundingBox())!;

    // Sampled per frame from the press that commits: the tear only shows between frames, and
    // by the time an assertion could look the panel is gone.
    await page.evaluate(() => {
      const w = window as unknown as { __frames: { position: string; left: number }[] };
      w.__frames = [];
      const sample = (frame: number) => {
        const panel = document.querySelector('[data-testid="select-list"]');
        if (panel) {
          w.__frames.push({
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
    // absolutely against its trigger. Position and left both, so neither shape can pass alone.
    expect(frames.every((f) => f.position === "absolute")).toBe(true);
    expect(frames.every((f) => Math.abs(f.left - anchor.x) <= 2)).toBe(true);
  });
});

/**
 * The booking panel is a bottom sheet on a phone, which puts the picker's Modal inside another
 * Modal. react-native-web gives each one a focus trap, and the two hand focus back and forth
 * until it lands on the picker's backdrop — leaving every key the list listens for landing on
 * something else.
 */
test.describe("Time picker on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("hands the open list the keyboard, not the backdrop behind it", async ({ page }) => {
    const { trigger, list } = await openTimePicker(page);

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
