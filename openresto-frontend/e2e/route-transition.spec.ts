import { test, expect } from "@playwright/test";

/**
 * The route transition must not reflow the page horizontally.
 *
 * `RouteTransition` rises the incoming view 6px as it settles. A transform
 * still contributes to an ancestor's scrollable overflow, and `#root` is a
 * vertical scroll container by accident (global.css sets `overflow-x: hidden`
 * on it, and CSS resolves the other axis of a non-`visible` overflow to
 * `auto`), so that 6px used to raise a 10px scrollbar for the length of the
 * animation. The scrollbar took 10px of width off the whole app, so the
 * navbar and the page slid 10px left and back on every route change — a
 * horizontal judder, worst at mobile widths where 10px is a bigger share of
 * the viewport. `styles.clip` in `RouteTransition.styles.ts` keeps the rise
 * from reaching `#root`.
 *
 * Measured per frame rather than before/after: the shift only exists during
 * the 140ms animation, so a settled-state assertion sees nothing wrong.
 */

/** Samples the navbar's right edge and #root's vertical overflow every frame across a nav. */
async function measureNavigation(page: import("@playwright/test").Page, linkLabel: string) {
  return page.evaluate(async (label: string) => {
    const nav = document.querySelector('[role="navigation"]');
    const root = document.getElementById("root");
    if (!nav || !root) throw new Error("navbar or #root not mounted");
    const link = [...nav.querySelectorAll("a")].find((a) => a.textContent?.trim() === label);
    if (!link) throw new Error(`no nav link labelled ${label}`);

    const navRights = new Set<number>();
    const rootWidths = new Set<number>();
    let maxRootOverflow = 0;
    let stop = false;

    const sample = () => {
      const box = nav.getBoundingClientRect();
      navRights.add(Math.round(box.x + box.width));
      rootWidths.add(root.clientWidth);
      maxRootOverflow = Math.max(maxRootOverflow, root.scrollHeight - root.clientHeight);
      if (!stop) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);

    // A couple of baseline frames, the navigation, then long enough to cover
    // the transition and settle.
    await new Promise((r) => setTimeout(r, 60));
    link.click();
    await new Promise((r) => setTimeout(r, 700));
    stop = true;

    return {
      pathname: location.pathname,
      navRights: [...navRights],
      rootWidths: [...rootWidths],
      maxRootOverflow,
    };
  }, linkLabel);
}

test.describe("Route transition layout stability", () => {
  for (const { label, pathname } of [
    { label: "Locations", pathname: "/locations" },
    { label: "My Bookings", pathname: "/lookup" },
  ]) {
    test(`navigating to ${label} does not shift the page horizontally`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/");
      await expect(page.getByRole("link", { name: label })).toBeVisible({ timeout: 15_000 });

      const result = await measureNavigation(page, label);

      expect(result.pathname).toBe(pathname);
      // The transform stays inside its own clipping wrapper, so #root never
      // overflows and never raises the scrollbar that caused the reflow.
      expect(result.maxRootOverflow).toBe(0);
      expect(result.rootWidths).toEqual([390]);
      expect(result.navRights).toHaveLength(1);
    });
  }
});
