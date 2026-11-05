import http from "node:http";
import type { AddressInfo } from "node:net";
import { test, expect, type Browser } from "@playwright/test";
import { futureDateStr, selectBookingDate } from "./helpers";
import { ADMIN_STATE_FILE } from "./global-setup";

const PASTA_PLACE_ID = 1;
const TEST_EMAIL = "e2e-embed-widget@example.com";
const INSTANCE = "http://localhost:5062";

/**
 * A restaurant's own site, served from a second origin. It is a real server on 127.0.0.1
 * rather than a `page.route` fake because Chromium's Private Network Access check refuses to
 * load a loopback script into a page it considers public.
 */
function startSite(): Promise<{ origin: string; close: () => void }> {
  const server = http.createServer((_req, res) => {
    res.setHeader("content-type", "text/html");
    res.end(`<!doctype html><html><body><h1>Partner site</h1>
      <script src="${INSTANCE}/embed.js" data-location="${PASTA_PLACE_ID}"></script>
      </body></html>`);
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ origin: `http://127.0.0.1:${port}`, close: () => server.close() });
    })
  );
}

async function asAdmin<T>(
  browser: Browser,
  fn: (page: import("@playwright/test").Page) => Promise<T>
) {
  const ctx = await browser.newContext({ storageState: ADMIN_STATE_FILE });
  try {
    return await fn(await ctx.newPage());
  } finally {
    await ctx.close();
  }
}

const setAllowedOrigins = (browser: Browser, origins: string[]) =>
  asAdmin(browser, async (page) => {
    const res = await page.request.put("/api/admin/embed-settings", {
      data: { allowedOrigins: origins },
    });
    expect(res.ok()).toBe(true);
  });

const purgeTestBookings = (browser: Browser) =>
  asAdmin(browser, async (page) => {
    const res = await page.request.get(
      `/api/admin/bookings?restaurantId=${PASTA_PLACE_ID}&email=${encodeURIComponent(TEST_EMAIL)}&status=all`
    );
    if (!res.ok()) return;
    for (const b of (await res.json()) as { id: number }[]) {
      await page.request.delete(`/api/admin/bookings/${b.id}`);
    }
  });

test.describe("Embedded booking widget", () => {
  test.describe.configure({ mode: "serial" });

  let allowed: Awaited<ReturnType<typeof startSite>>;
  let other: Awaited<ReturnType<typeof startSite>>;

  test.beforeAll(async ({ browser }) => {
    allowed = await startSite();
    other = await startSite();
    await setAllowedOrigins(browser, [allowed.origin]);
    await purgeTestBookings(browser);
  });

  test.afterAll(async ({ browser }) => {
    await setAllowedOrigins(browser, []);
    await purgeTestBookings(browser);
    allowed.close();
    other.close();
  });

  test(
    "only the allowed origin may frame the widget, and nothing else is framable",
    { tag: "@smoke" },
    async ({ request }) => {
      const embed = await request.get("/embed");
      expect(embed.headers()["content-security-policy"]).toContain(
        `frame-ancestors ${allowed.origin};`
      );
      expect(embed.headers()["x-frame-options"]).toBeUndefined();

      const home = await request.get("/");
      expect(home.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(home.headers()["x-frame-options"]).toBe("DENY");

      const loader = await request.get("/embed.js");
      expect(loader.headers()["cross-origin-resource-policy"]).toBe("cross-origin");
    }
  );

  test("books end to end from the allowed site", async ({ page }) => {
    await page.goto(allowed.origin);
    const frame = page.frameLocator("iframe");

    await selectBookingDate(frame, futureDateStr(14));
    await frame.getByLabel("Lunch").click();
    await frame
      .getByLabel(/^\d{2}:\d{2}$/)
      .first()
      .click();
    await frame.getByPlaceholder("Your full name").fill("E2E Embedded");
    await frame.getByPlaceholder("your@email.com").fill(TEST_EMAIL);

    await expect(frame.locator("text=Table held")).toBeVisible({ timeout: 30_000 });
    await frame.getByText("Confirm Booking").click();

    await expect(frame.getByTestId("embed-booking-ref")).not.toBeEmpty({ timeout: 15_000 });
    expect(page.url()).toContain(allowed.origin);
  });

  test("does not render inside a site that is not allowed", async ({ page }) => {
    await page.goto(other.origin);
    await expect(page.locator("iframe")).toBeAttached();
    // The browser refuses the frame outright, so the form never appears in it.
    await page.waitForTimeout(5_000);
    await expect(page.frameLocator("iframe").getByText("Confirm Booking")).toHaveCount(0);
  });
});
