import { defineConfig, devices } from "@playwright/test";

/** Dedicated ports so E2E does not collide with local dev on 3000/3001 */
const memberBase = process.env.MEMBER_BASE_URL ?? "http://localhost:3100";
const adminBase = process.env.ADMIN_BASE_URL ?? "http://localhost:3101";

export default defineConfig({
  testDir: "./tests",
  outputDir: "../test-results",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "../playwright-report" }]],
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "member-chromium",
      testMatch: "**/member-*.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: memberBase },
    },
    {
      name: "admin-chromium",
      testMatch: "**/admin-*.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: adminBase },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: "npx pnpm --filter @osaja/member-app dev:e2e",
          url: `${memberBase}/login`,
          reuseExistingServer: false,
          timeout: 180_000,
        },
        {
          command: "npx pnpm --filter @osaja/admin-portal dev:e2e",
          url: `${adminBase}/login`,
          reuseExistingServer: false,
          timeout: 180_000,
        },
      ],
});
