#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(root, "apps", "api");
const isWindows = process.platform === "win32";
const venvPython = path.join(
  apiDir,
  ".venv",
  isWindows ? "Scripts/python.exe" : "bin/python",
);
const webApps = [
  { name: "Member", port: 3000, dir: "member-app" },
  { name: "Admin", port: 3001, dir: "admin-portal" },
  { name: "Landing", port: 3002, dir: "landing" },
  { name: "SMS", port: 3003, dir: "sms-portal" },
];
const apps = [{ name: "API", port: 8000 }, ...webApps];
const children = new Set();
let stopping = false;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function canBind(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
  });
}

function runBuild() {
  const result = spawnSync(
    process.execPath,
    [path.join(root, "scripts", "ensure-packages-built.mjs")],
    { cwd: root, stdio: "inherit" },
  );
  if (result.error || result.status !== 0) {
    fail(`Could not build shared workspace packages${result.error ? `: ${result.error.message}` : "."}`);
  }
}

function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) child.kill();

  const forceStop = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
  }, 5000);
  forceStop.unref();
}

function startApp(app) {
  const isApi = app.name === "API";
  const appDir = isApi ? apiDir : path.join(root, "apps", "web", app.dir);
  const command = isApi ? venvPython : process.execPath;
  const args = isApi
    ? ["-m", "uvicorn", "v1.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000"]
    : [
        createRequire(path.join(appDir, "package.json")).resolve("next/dist/bin/next"),
        "dev",
        "--port",
        String(app.port),
      ];
  const child = spawn(command, args, {
    cwd: appDir,
    stdio: "inherit",
    env: isApi ? { ...process.env, PYTHONPATH: "." } : process.env,
  });

  children.add(child);
  child.once("error", (error) => {
    console.error(`${app.name} failed to start: ${error.message}`);
    stop(1);
  });
  child.once("exit", (code) => {
    children.delete(child);
    if (!stopping) {
      console.error(`${app.name} exited${code === 0 ? "" : ` with code ${code}`}. Stopping remaining apps.`);
      stop(code ?? 1);
    }
  });
}

if (!fs.existsSync(path.join(root, "node_modules"))) {
  fail("Workspace dependencies are missing. Run pnpm install, then pnpm setup:local.");
}
if (!fs.existsSync(venvPython)) {
  fail("API virtual environment is missing. Run pnpm setup:local first.");
}
for (const [source, target] of [
  ["apps/api/.env.example", "apps/api/.env"],
  ["apps/web/member-app/.env.local.example", "apps/web/member-app/.env.local"],
  ["apps/web/admin-portal/.env.local.example", "apps/web/admin-portal/.env.local"],
  ["apps/web/landing/.env.local.example", "apps/web/landing/.env.local"],
  ["apps/web/sms-portal/.env.local.example", "apps/web/sms-portal/.env.local"],
]) {
  if (!fs.existsSync(path.join(root, target))) {
    fail(`Local configuration is missing (${target}). Run pnpm setup:local first.`);
  }
  if (!fs.existsSync(path.join(root, source))) {
    fail(`Expected environment template is missing: ${source}`);
  }
}

const busyApps = [];
for (const app of apps) {
  if (!(await canBind(app.port))) busyApps.push(`${app.name} (${app.port})`);
}
if (busyApps.length) {
  fail(`These app ports are already in use: ${busyApps.join(", ")}. Stop those processes and retry.`);
}

runBuild();
console.log("\nStarting local apps (Ctrl+C stops all):");
for (const app of apps) {
  console.log(`  ${app.name.padEnd(7)} http://localhost:${app.port}`);
  startApp(app);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
