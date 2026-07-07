import { test, expect } from "@playwright/test";

/**
 * Guards the home-page highlights section.
 *
 * Two invariants:
 *   1. With real seeded data the "Restaurant highlights" heading, the
 *      "Curated by the owner" tag, and at least one highlight card render.
 *   2. When the highlights API returns an empty list, the *entire* section —
 *      heading included — must disappear (regression guard for the fix that
 *      wrapped the block in `highlights.length > 0`).
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
