#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(root, "apps", "api");
const isWindows = process.platform === "win32";
const envFiles = [
  ["apps/api/.env.example", "apps/api/.env"],
  ["apps/web/member-app/.env.local.example", "apps/web/member-app/.env.local"],
  ["apps/web/admin-portal/.env.local.example", "apps/web/admin-portal/.env.local"],
  ["apps/web/landing/.env.local.example", "apps/web/landing/.env.local"],
  ["apps/web/sms-portal/.env.local.example", "apps/web/sms-portal/.env.local"],
];

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: isWindows,
  });
  if (result.error) {
    console.error(`Could not run ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const [source, target] of envFiles) {
  const sourcePath = path.join(root, source);
  const targetPath = path.join(root, target);
  if (!fs.existsSync(targetPath)) {
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`Created ${target}`);
  } else {
    console.log(`Preserved existing ${target}`);
  }
}

if (!fs.existsSync(path.join(root, "node_modules"))) {
  console.log("Installing workspace dependencies...");
  run("pnpm", ["install"]);
}

const pythonCandidates = isWindows ? ["python", "py"] : ["python3", "python"];
const python = pythonCandidates.find((candidate) => {
  const result = spawnSync(candidate, ["--version"], {
    cwd: root,
    stdio: "ignore",
    shell: isWindows,
  });
  return result.status === 0;
});

if (!python) {
  console.error("Python 3.11+ is required. Install Python and rerun pnpm setup:local.");
  process.exit(1);
}

const venvPython = path.join(
  apiDir,
  ".venv",
  isWindows ? "Scripts/python.exe" : "bin/python",
);
if (!fs.existsSync(venvPython)) {
  console.log("Creating apps/api/.venv...");
  run(python, ["-m", "venv", ".venv"], apiDir);
}

const version = spawnSync(
  venvPython,
  ["-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"],
  { cwd: apiDir, encoding: "utf8" },
);
const [major, minor] = (version.stdout ?? "").trim().split(".").map(Number);
if (
  version.status !== 0 ||
  !Number.isInteger(major) ||
  !Number.isInteger(minor) ||
  major < 3 ||
  (major === 3 && minor < 11)
) {
  const foundVersion = version.stdout?.trim() || "unknown";
  console.error(`Python 3.11+ is required for the API virtual environment; found ${foundVersion}.`);
  process.exit(1);
}

console.log("Installing API requirements into apps/api/.venv...");
run(venvPython, ["-m", "pip", "install", "-r", "requirements.txt"], apiDir);

console.log("\nLocal runtime is ready. Start all apps with: pnpm dev:all");
