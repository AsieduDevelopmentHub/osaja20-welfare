#!/usr/bin/env node
/**
 * Run API pytest using apps/api/.venv (creates venv + installs deps if needed).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(root, "apps", "api");
const isWin = process.platform === "win32";
const venvPython = path.join(apiDir, ".venv", isWin ? "Scripts/python.exe" : "bin/python");
const requirements = path.join(apiDir, "requirements.txt");

const testEnv = {
  DATABASE_URL: "sqlite+aiosqlite:///:memory:",
  JWT_SECRET: "test-jwt-secret-key-minimum-32-characters-long",
  USE_LOCAL_AUTH: "true",
  DEBUG: "true",
  REGISTRATION_AUTO_APPROVE: "true",
  JOB_WORKER_ENABLED: "false",
};

function run(cmd, argv, { cwd = apiDir, env = {} } = {}) {
  const result = spawnSync(cmd, argv, {
    cwd,
    stdio: "inherit",
    shell: isWin,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function canImport(python, moduleName) {
  const result = spawnSync(python, ["-c", `import ${moduleName}`], {
    cwd: apiDir,
    shell: isWin,
    stdio: "pipe",
  });
  return result.status === 0;
}

function systemPython() {
  for (const candidate of isWin ? ["python", "py"] : ["python3", "python"]) {
    const probe = spawnSync(candidate, ["--version"], { shell: isWin, stdio: "pipe" });
    if (probe.status === 0) return candidate;
  }
  console.error("Python not found. Install Python 3.11+ and retry, or run scripts/setup-api-venv.ps1");
  process.exit(1);
}

function ensureVenv() {
  if (fs.existsSync(venvPython)) return venvPython;

  const py = systemPython();
  console.log("Creating API virtualenv at apps/api/.venv …");
  run(py, ["-m", "venv", ".venv"]);
  return venvPython;
}

function ensureDeps(python) {
  if (canImport(python, "pywebpush") && canImport(python, "pytest")) {
    return;
  }
  console.log("Installing API test dependencies …");
  run(python, ["-m", "pip", "install", "--upgrade", "pip"]);
  run(python, ["-m", "pip", "install", "-r", requirements]);
}

const setupOnly = process.argv.includes("--setup-only");

const python = ensureVenv();
ensureDeps(python);

if (setupOnly) {
  console.log("API venv and dependencies are ready.");
  process.exit(0);
}

run(python, ["-m", "pytest", "tests/", "-q"], { env: testEnv });
