import { test, expect } from "@playwright/test";

test.describe("Admin auth pages", () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test("login page has accessible form", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await expect(page.getByText("Admin Portal", { exact: true })).toBeVisible();
    await expect(page.getByLabel(/email, username, or member id/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
  });

  test("unauthenticated dashboard redirects to login", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
  });
});
