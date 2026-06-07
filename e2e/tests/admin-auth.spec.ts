import { test, expect } from "@playwright/test";

test.describe("Admin auth pages", () => {
  test("login page has accessible form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /admin portal/i })).toBeVisible();
    await expect(page.getByLabel(/email, username, or member id/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
  });

  test("unauthenticated dashboard redirects to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });
});
