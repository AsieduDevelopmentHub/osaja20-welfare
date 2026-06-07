#!/usr/bin/env node
/** Mirrors the pip-audit step in .github/workflows/ci.yml */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requirements = path.join(root, "apps", "api", "requirements.txt");
const isWin = process.platform === "win32";

const IGNORE = [
  "PYSEC-2026-161",
  "CVE-2025-54121",
  "CVE-2025-62727",
  "CVE-2025-71176",
  "PYSEC-2025-185",
  // python-jose 3.4.0 pins pyasn1<0.5; fixed pyasn1 needs a jose release
  "CVE-2026-30922",
];

function run(cmd, argv) {
  const result = spawnSync(cmd, argv, { cwd: root, stdio: "inherit", shell: isWin });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const py = isWin ? "python" : "python3";
run(py, ["-m", "pip", "install", "pip-audit"]);
run(py, ["-m", "pip_audit", "-r", requirements, ...IGNORE.flatMap((id) => ["--ignore-vuln", id])]);
