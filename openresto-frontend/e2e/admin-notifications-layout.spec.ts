import { test, expect, type Page } from "@playwright/test";

/**
 * The notifications filter bar, at the widths a real admin uses it at.
 *
 * The bar puts a horizontally-scrolling row of type filters beside a fixed "Filter Unread"
 * toggle. Nothing in the type system, the linter or a render test can see how those two
 * divide the line — the row claiming the whole width and shoving its neighbour past the
 * page's content column is a valid component tree that only fails against a layout engine.
 * So the rule is pinned here: whatever the viewport, the toggle stays on the page and the
 * page does not scroll sideways to reach it.
 */

const WIDTHS = [
  { name: "narrow laptop", width: 1024 },
  { name: "wide desktop", width: 1600 },
];

async function openNotifications(page: Page) {
  await page.goto("/admin/notifications");
  await expect(page.getByLabel("Show unread only")).toBeVisible();
}

test.describe("admin notifications filter bar", () => {
  for (const { name, width } of WIDTHS) {
    test(`keeps the unread toggle on the page at ${name} width`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openNotifications(page);

      const toggle = page.getByLabel("Show unread only");
      const box = await toggle.boundingBox();
      expect(box).not.toBeNull();

      // Fully inside the viewport, not merely present in the DOM off to the right.
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);

      // And it is not reachable-by-scrolling instead of visible: the page itself has no
      // horizontal overflow.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow).toBeLessThanOrEqual(1);

      // Still a working control where it landed, not just a well-placed rectangle.
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "true");
    });
  }
});
