import { test, expect } from "@playwright/test";

/**
 * Guards the home-page highlights section.
 *
 * Three invariants:
 *   1. With real seeded data the "Restaurant highlights" heading, the
 *      "Curated by the owner" tag, and at least one highlight card render.
 *   2. When the highlights API returns an empty list, the *entire* section —
 *      heading included — must disappear (regression guard for the fix that
 *      wrapped the block in `highlights.length > 0`).
 *   3. More highlights than columns become a scrolling rail rather than a second
 *      row, and its forward button retires once the rail reaches its end. That
 *      last part only exists in real layout: the rail cancels the section's
 *      padding with a negative margin, so the scrollport is wider than the
 *      wrapper around it, and a component test has no geometry to tell them apart.
 *
 * Both tests mock /api/restaurants** to a single fake restaurant so the page
 * renders predictably without depending on the broader seeded dataset.
 */
test.describe("Home highlights section", () => {
  // Shape mirrors the working mock in customer-nav.spec.ts (openHours as array,
  // openDays as comma string, sections with nested tables) so the card renders
  // without throwing on a field-shape mismatch.
  const fakeRestaurants = [
    {
      id: 1,
      name: "Highlights E2E Resto",
      address: "1 Highlight Way",
      openTime: "09:00",
      closeTime: "22:00",
      openHours: [],
      openDays: "1,2,3,4,5,6,7",
      timezone: "UTC",
      tags: [],
      walkInOnly: false,
      walkInDays: "",
      defaultBookingDurationMinutes: 60,
      sections: [
        {
          id: 1,
          name: "Main",
          sortOrder: 0,
          tables: [{ id: 2, name: "T1", seats: 2 }],
        },
      ],
    },
  ];

  test("renders the heading, curated-by tag, and a highlight card when highlights exist", async ({
    page,
  }) => {
    await page.route("**/api/restaurants**", (route) => route.fulfill({ json: fakeRestaurants }));
    await page.route("**/api/highlights**", (route) =>
      route.fulfill({
        json: [
          {
            id: 1,
            title: "E2E Highlight Title",
            body: "E2E highlight body copy.",
            iconKey: "flame-outline",
            sortOrder: 0,
          },
        ],
      })
    );

    await page.goto("/");
    await expect(page.getByText("Highlights E2E Resto", { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByText("Restaurant highlights")).toBeVisible();
    await expect(page.getByText("Curated by the owner")).toBeVisible();
    await expect(page.getByText("E2E Highlight Title", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E highlight body copy.", { exact: true })).toBeVisible();
  });

  test("turns an overflowing highlights row into a rail that retires its forward button", async ({
    page,
  }) => {
    await page.route("**/api/restaurants**", (route) => route.fulfill({ json: fakeRestaurants }));
    await page.route("**/api/highlights**", (route) =>
      route.fulfill({
        json: Array.from({ length: 6 }, (_, i) => ({
          id: i + 1,
          title: `Rail Highlight ${i + 1}`,
          body: "Rail body copy.",
          iconKey: "flame-outline",
          sortOrder: i,
        })),
      })
    );

    await page.goto("/");
    await expect(page.getByText("Rail Highlight 1", { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    const rail = page.getByRole("group", { name: "Restaurant highlights" });
    const forward = page.getByRole("button", { name: "Scroll Restaurant highlights right" });
    const back = page.getByRole("button", { name: "Scroll Restaurant highlights left" });

    // Six highlights across at most four columns: one row that scrolls, not two rows.
    await expect(rail).toBeVisible();
    await expect(forward).toBeVisible();
    await expect(back).toBeHidden();

    // The button drives the row.
    await forward.click();
    await expect.poll(() => rail.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);

    // And retires once nothing is left to its right. The offset is set to the end rather
    // than scrolled past it: `scroll-snap-type: x mandatory` bounces an out-of-range
    // scrollTo back to the first snap point, so scrollTo(scrollWidth) lands at 0.
    await rail.evaluate((el) => {
      el.scrollLeft = el.scrollWidth - el.clientWidth;
    });

    await expect(forward).toBeHidden();
    await expect(back).toBeVisible();
  });

  test("hides the entire highlights section (heading included) when there are none", async ({
    page,
  }) => {
    await page.route("**/api/restaurants**", (route) => route.fulfill({ json: fakeRestaurants }));
    await page.route("**/api/highlights**", (route) => route.fulfill({ json: [] }));

    await page.goto("/");
    await expect(page.getByText("Highlights E2E Resto", { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Give the (empty) highlights resolve a beat, then assert the whole
    // section is gone — not just the card body.
    await expect(page.getByText("Restaurant highlights")).toHaveCount(0);
    await expect(page.getByText("Curated by the owner")).toHaveCount(0);
  });
});
