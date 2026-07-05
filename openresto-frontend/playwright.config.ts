import { defineConfig, devices } from "@playwright/test";
import path from "path";

const ADMIN_STATE_FILE = path.join(__dirname, "e2e/.auth/admin.json");

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Single worker — the Docker container has a 5 req/min auth rate-limit and
     a 60 req/min global limit, so parallel workers exhaust both quickly. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",

  /* Login once before ALL tests; saves the cookie for admin test projects. */
  globalSetup: "./e2e/global-setup.ts",

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:5062",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },
  timeout: 60000,
  expect: {
    timeout: 20000,
  },

  /* Configure projects for major browsers */
  projects: [
    // ── Public / unauthenticated tests ─────────────────────────────────────
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [
        "**/admin-pause.spec.ts",
        "**/admin-extend.spec.ts",
        "**/brand-colour.spec.ts",
        "**/lookup.spec.ts",
        "**/keyboard-shortcuts.spec.ts",
        "**/cancel-past-booking.spec.ts",
        "**/admin-change-email.spec.ts",
        "**/admin-reorder-sections.spec.ts",
      ],
    },
    // ── Admin tests — pre-loaded auth cookie ────────────────────────────────
    {
      name: "chromium-admin",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ADMIN_STATE_FILE,
      },
      testMatch: [
        "**/admin-pause.spec.ts",
        "**/admin-extend.spec.ts",
        "**/brand-colour.spec.ts",
        "**/lookup.spec.ts",
        "**/keyboard-shortcuts.spec.ts",
        "**/cancel-past-booking.spec.ts",
        "**/admin-change-email.spec.ts",
        "**/admin-reorder-sections.spec.ts",
      ],
    },
  ],
});
