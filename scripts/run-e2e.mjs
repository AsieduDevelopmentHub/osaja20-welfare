#!/usr/bin/env node
/**
 * Build shared packages, start E2E dev servers, run Playwright.
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const memberUrl = process.env.MEMBER_BASE_URL ?? "http://localhost:3100";
const adminUrl = process.env.ADMIN_BASE_URL ?? "http://localhost:3101";

const children = [];

function runSync(cmd, argv) {
  const result = spawnSync(cmd, argv, {
    cwd: root,
    stdio: "inherit",
    shell: isWin,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function rmDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function startServer(label, filter, readyUrl) {
  console.log(`Starting ${label} at ${readyUrl}…`);
  const child = spawn("npx", ["pnpm", "--filter", filter, "dev:e2e"], {
    cwd: root,
    stdio: "pipe",
    shell: isWin,
    env: process.env,
  });
  children.push(child);
  child.stdout?.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  return { child, readyUrl };
}

async function waitForServer(url, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (res.status < 500) return;
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function stopServers() {
  for (const child of children) {
    if (!child.killed) {
      if (isWin) {
        spawnSync("taskkill", ["/pid", String(child.pid), "/f", "/t"], { stdio: "ignore", shell: true });
      } else {
        child.kill("SIGTERM");
      }
    }
  }
}

process.on("exit", stopServers);
process.on("SIGINT", () => {
  stopServers();
  process.exit(130);
});

if (process.env.PLAYWRIGHT_SKIP_BUILD !== "1") {
  console.log("\n▶  Building shared packages…\n");
  runSync("npx", ["pnpm", "--filter", "@osaja/types", "build"]);
  runSync("npx", ["pnpm", "--filter", "@osaja/config", "build"]);
  runSync("npx", ["pnpm", "--filter", "@osaja/ui", "build"]);
  runSync("npx", ["pnpm", "--filter", "@osaja/utils", "build"]);

  console.log("\n▶  Cleaning stale Next.js caches…\n");
  rmDir(path.join(root, "apps/web/member-app/.next"));
  rmDir(path.join(root, "apps/web/admin-portal/.next"));
}

if (process.env.PLAYWRIGHT_SKIP_WEBSERVER !== "1") {
  startServer("member", "@osaja/member-app", `${memberUrl}/login`);
  startServer("admin", "@osaja/admin-portal", `${adminUrl}/login`);
  console.log("\n▶  Waiting for dev servers…\n");
  await waitForServer(`${memberUrl}/login`);
  await waitForServer(`${adminUrl}/login`);
  console.log("Servers ready.\n");
}

console.log("\n▶  Running Playwright E2E…\n");
const testEnv = {
  ...process.env,
  CI: process.env.CI ?? "true",
  MEMBER_BASE_URL: memberUrl,
  ADMIN_BASE_URL: adminUrl,
  PLAYWRIGHT_SKIP_WEBSERVER: "1",
};

const result = spawnSync(
  "npx",
  ["pnpm", "exec", "playwright", "test", "--config", "e2e/playwright.config.ts"],
  { cwd: root, stdio: "inherit", shell: isWin, env: testEnv },
);

stopServers();
process.exit(result.status ?? 1);
