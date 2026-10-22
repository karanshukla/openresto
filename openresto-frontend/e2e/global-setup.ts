import { chromium, type BrowserContext } from "@playwright/test";
import fs from "fs";
import path from "path";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./helpers";

export const ADMIN_STATE_FILE = path.join(__dirname, ".auth/admin.json");

/**
 * Persist the context's admin cookie to ADMIN_STATE_FILE for the admin projects.
 * Outside Development the cookie is Secure, and the E2E stack is plain http://localhost:
 * Chromium sends a Secure cookie to localhost anyway, WebKit doesn't, so the flag is cleared.
 */
export async function saveAdminState(ctx: BrowserContext) {
  const state = await ctx.storageState();
  const cookies = state.cookies.map((c) => ({ ...c, secure: false }));
  fs.mkdirSync(path.dirname(ADMIN_STATE_FILE), { recursive: true });
  fs.writeFileSync(ADMIN_STATE_FILE, JSON.stringify({ ...state, cookies }, null, 2));
}

/**
 * Login once before all tests run and save the auth cookie to disk.
 * Admin tests load this state instead of navigating through the login form,
 * which would otherwise exhaust the 5-per-minute auth rate limit.
 */
export default async function globalSetup() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL: "http://localhost:5062" });
  const page = await ctx.newPage();

  // Hit the login API once — sets the openresto_auth cookie in the context
  const res = await page.request.post("/api/admin/auth/login", {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!res.ok()) {
    throw new Error(`Admin login failed during global setup (HTTP ${res.status()})`);
  }

  // Persist cookies so every admin test can load this state
  await saveAdminState(ctx);
  await browser.close();
}
