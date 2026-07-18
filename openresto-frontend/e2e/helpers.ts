import { expect, type Page, type APIRequestContext, type Locator } from "@playwright/test";

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@openresto.com";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "change-me-before-use";

/** Delay helper */
export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Make a POST request with rate limit retry logic.
 * Retries up to 3 times with exponential backoff when hitting 429 (Too Many Requests).
 */
export async function postWithRetry(
  request: APIRequestContext,
  url: string,
  options: { data?: unknown; headers?: Record<string, string> },
  maxRetries = 3
): Promise<{
  ok: () => boolean;
  status: () => number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
}> {
  let lastResponse: {
    ok: () => boolean;
    status: () => number;
    text: () => Promise<string>;
    json: () => Promise<unknown>;
  } | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await request.post(url, options);
    lastResponse = response;

    if (response.ok()) {
      return response;
    }

    const status = response.status();
    if (status === 429 && attempt < maxRetries) {
      const waitMs = Math.min(1000 * Math.pow(2, attempt), 20000); // Exponential backoff, max 20s
      console.log(
        `Rate limited (429) on ${url}, retrying in ${waitMs}ms... (attempt ${attempt + 1}/${maxRetries})`
      );
      await delay(waitMs);
      continue;
    }

    // Not a rate limit or no more retries
    return response;
  }

  return lastResponse!;
}

/**
 * Make a GET request with rate limit retry logic.
 * Retries up to 3 times with exponential backoff when hitting 429 (Too Many Requests).
 */
export async function getWithRetry(
  request: APIRequestContext,
  url: string,
  maxRetries = 3
): Promise<{
  ok: () => boolean;
  status: () => number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
}> {
  let lastResponse: {
    ok: () => boolean;
    status: () => number;
    text: () => Promise<string>;
    json: () => Promise<unknown>;
  } | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await request.get(url);
    lastResponse = response;

    if (response.ok()) {
      return response;
    }

    const status = response.status();
    if (status === 429 && attempt < maxRetries) {
      const waitMs = Math.min(1000 * Math.pow(2, attempt), 20000); // Exponential backoff, max 20s
      console.log(
        `Rate limited (429) on ${url}, retrying in ${waitMs}ms... (attempt ${attempt + 1}/${maxRetries})`
      );
      await delay(waitMs);
      continue;
    }

    return response;
  }

  return lastResponse!;
}

/** Returns a YYYY-MM-DD string N days in the future (UTC). */
export function futureDateStr(daysAhead = 7): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString().split("T")[0];
}

/**
 * Selects a date on the custom calendar-grid DatePicker (web), which replaced
 * the native <input type="date"> — the OS/browser date picker couldn't grey
 * out individual closed weekdays, so it's now a component we render and
 * control ourselves (see components/common/DatePicker.web.tsx).
 *
 * Opens the picker, clicks "next month" until the target day's cell is in the
 * DOM (cells for other months aren't rendered at all), then clicks it.
 */
export async function selectBookingDate(page: Page, dateStr: string): Promise<void> {
  await page.getByTestId("date-picker-trigger").click();
  await expect(page.getByTestId("date-picker-calendar")).toBeVisible({ timeout: 10_000 });

  const dayCell = page.getByTestId(`date-picker-day-${dateStr}`);
  for (let attempt = 0; attempt < 6 && !(await dayCell.isVisible()); attempt++) {
    await page.getByTestId("date-picker-next-month").click();
  }
  await expect(dayCell).toBeVisible({ timeout: 5_000 });
  await dayCell.click();
}

/** Returns a UTC ISO timestamp for N minutes ago. */
export function pastUtcISO(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

/**
 * Navigate to the admin dashboard.
 *
 * In tests that use the "chromium-admin" project the auth cookie is pre-loaded
 * via global-setup.ts — no login form needed.  In rare cases where you need a
 * fresh session (e.g. beforeAll hooks that create new browser contexts) call
 * this with `loginFirst = true` to hit the API once.
 *
 * `waitForURL` resolves as soon as the client-side route changes, which is
 * before the admin layout's async `checkSession()` call resolves and renders
 * the authenticated UI (AdminSidebar, and the keyboard-shortcut listeners
 * that only attach once authState === "authenticated"). Waiting for the
 * sidebar's lookup input — present on every admin route — closes that race
 * so callers can interact with the page (including keyboard shortcuts)
 * immediately after this resolves.
 */
export async function gotoAdminDashboard(page: Page, loginFirst = false): Promise<void> {
  if (loginFirst) {
    const res = await page.request.post("/api/admin/auth/login", {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    if (!res.ok()) {
      throw new Error(`Admin login failed (HTTP ${res.status()})`);
    }
  }
  await page.goto("/admin/dashboard");
  await page.waitForURL(/.*dashboard.*/, { timeout: 20_000 });
  await page.waitForSelector('input[placeholder="Email or reference…"]', { timeout: 10_000 });
}

/** @deprecated Use gotoAdminDashboard instead. */
export const adminLoginViaUI = (page: Page) => gotoAdminDashboard(page);

/**
 * react-native-web's Modal renders its content (making it visible) before its
 * internal escape-keyup listener effect finishes subscribing — a brief real
 * race in the library itself, not a fixed delay we can size once and trust.
 * Retry the actual keypress against the real close condition instead of
 * guessing a magic sleep, so this doesn't flake under CI load. Shared by any
 * spec that presses Escape against a real RN Modal (see issue #140
 * investigation, "Post-implement fix #3").
 */
export async function pressEscapeUntilClosed(page: Page, closedIndicator: Locator): Promise<void> {
  await expect(async () => {
    await page.keyboard.press("Escape");
    await expect(closedIndicator).not.toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 10_000 });
}

/**
 * Wait for `locator` to become visible, reloading the page on timeout.
 *
 * Several admin pages (settings, locations, the booking form) hydrate by
 * fetching from rate-limited API endpoints. Under the Docker stack's shared
 * per-IP windows (10 req/min auth, 300 req/min global) a fetch can land a 429
 * mid-suite and the page never renders the awaited text within the normal
 * timeout — even though the page itself is fine, as a reload proves (the
 * client's own 429 retry then succeeds on a fresh window).
 *
 * This mirrors the inline reload-fallback already used in booking.spec.ts and
 * home.spec.ts, factored out so every rate-limit-susceptible wait can share
 * it. `attempts` reloads are tried, each preceded by a `waitMs` cool-down to
 * give the window time to recover.
 */
export async function expectVisibleWithReload(
  page: Page,
  locator: Locator,
  {
    timeout = 15_000,
    attempts = 2,
    waitMs = 15_000,
  }: { timeout?: number; attempts?: number; waitMs?: number } = {}
): Promise<void> {
  for (let i = 0; i <= attempts; i++) {
    try {
      await expect(locator).toBeVisible({ timeout });
      return;
    } catch (e) {
      if (i === attempts) throw e;
      // Window hasn't cleared yet — cool down, then reload so the client's
      // own 429 retry runs against a fresh rate-limit window.
      await delay(waitMs);
      await page.reload();
    }
  }
}

/**
 * Build a PUT /api/restaurants/:id body shaped for `UpdateRestaurantRequest`.
 *
 * The GET response DTO and the request type diverge on `tags` (string[] on the
 * DTO vs a comma-separated string on the request), and the handler assigns
 * every field unconditionally (`r.Address = req.Address`), so a partial body
 * wipes whatever is omitted. Echo the full state back, applying `overrides`
 * last so callers can flip walkInOnly / walkInDays / etc. without clobbering
 * anything else. Pass the GET response body as `restaurant`.
 */
export function buildUpdateRestaurantBody(
  restaurant: Record<string, unknown>,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    name: restaurant.name,
    address: restaurant.address,
    openTime: restaurant.openTime,
    closeTime: restaurant.closeTime,
    openDays: restaurant.openDays,
    openHours: restaurant.openHours,
    timezone: restaurant.timezone,
    tags: Array.isArray(restaurant.tags) ? (restaurant.tags as string[]).join(",") : "",
    defaultBookingDurationMinutes: restaurant.defaultBookingDurationMinutes,
    walkInOnly: restaurant.walkInOnly,
    walkInDays: restaurant.walkInDays,
    ...overrides,
  };
}
