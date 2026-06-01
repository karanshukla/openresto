import type { Page, APIRequestContext } from "@playwright/test";

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
      const waitMs = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
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
      const waitMs = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
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
  await page.goto("/dashboard");
  await page.waitForURL(/.*dashboard.*/, { timeout: 20_000 });
}

/** @deprecated Use gotoAdminDashboard instead. */
export const adminLoginViaUI = (page: Page) => gotoAdminDashboard(page);
