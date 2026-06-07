import { defineConfig, devices } from "@playwright/test";

const memberBase = process.env.MEMBER_BASE_URL ?? "http://localhost:3000";
const adminBase = process.env.ADMIN_BASE_URL ?? "http://localhost:3001";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
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
          command: "npx pnpm dev:member",
          url: memberBase,
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: "npx pnpm dev:admin",
          url: adminBase,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ],
});
