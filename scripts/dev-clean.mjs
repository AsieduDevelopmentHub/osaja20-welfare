#!/usr/bin/env node
/**
 * Stop dev port, wipe .next, rebuild packages, start Next dev.
 * Usage: node scripts/dev-clean.mjs member|admin
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const target = process.argv[2] ?? "member";

const apps = {
  member: { port: 3000, dir: "apps/web/member-app", script: "dev:member" },
  admin: { port: 3001, dir: "apps/web/admin-portal", script: "dev:admin" },
};

const app = apps[target];
if (!app) {
  console.error("Usage: node scripts/dev-clean.mjs member|admin");
  process.exit(1);
}

function run(cmd, argv, opts = {}) {
  return spawnSync(cmd, argv, { cwd: root, stdio: "inherit", shell: isWin, ...opts });
}

if (isWin) {
  run("powershell", [
    "-NoProfile",
    "-Command",
    `Get-NetTCPConnection -LocalPort ${app.port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`,
  ]);
}

const nextDir = path.join(root, app.dir, ".next");
if (fs.existsSync(nextDir)) {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log(`Removed ${app.dir}/.next`);
}

run("node", ["scripts/ensure-packages-built.mjs"]);
const dev = isWin ? { cmd: "npx", argv: ["pnpm", app.script] } : { cmd: "pnpm", argv: [app.script] };
run(dev.cmd, dev.argv);
