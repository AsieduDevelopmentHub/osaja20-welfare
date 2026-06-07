import { test, expect } from "@playwright/test";

test.describe("Member auth pages", () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test("login page has accessible form", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();
    await expect(page.getByLabel(/email, username, or member id/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /forgot password/i })).toBeVisible();
  });

  test("register page has labeled fields", async ({ page }) => {
    await page.goto("/register", { waitUntil: "networkidle" });
    await expect(page.getByLabel(/^full name$/i)).toBeVisible();
    await expect(page.getByLabel(/^email$/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    await expect(page.getByLabel(/^phone number$/i)).toBeVisible();
    await expect(page.getByLabel(/date of birth/i)).toBeVisible();
  });

  test("forgot password page loads", async ({ page }) => {
    await page.goto("/forgot-password", { waitUntil: "networkidle" });
    await expect(page.getByText("Reset password", { exact: true })).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
  });

  test("unauthenticated dashboard redirects to login", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
  });

  test("skip link targets main content", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    const skip = page.getByRole("link", { name: /skip to main content/i });
    await expect(skip).toBeAttached();
    await skip.focus();
    await expect(skip).toBeFocused();
    await expect(page.locator("#main-content")).toBeVisible();
  });
});
