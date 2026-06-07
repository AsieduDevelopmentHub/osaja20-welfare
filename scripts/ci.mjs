#!/usr/bin/env node
/**
 * Local CI replicate — runs the same checks as .github/workflows/ci.yml
 *
 * Usage:
 *   pnpm ci:local              # full pipeline
 *   pnpm ci:local -- --fast    # skip build + e2e
 *   pnpm ci:local -- --skip-e2e
 *   pnpm ci:local -- --only lint,typecheck,test
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const fast = args.includes("--fast");
const skipE2e = fast || args.includes("--skip-e2e");
const skipBuild = fast || args.includes("--skip-build");
const onlyArg = args.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.replace("--only=", "").split(",").map((s) => s.trim()) : null;

const steps = [
  { id: "lint", label: "Lint", cmd: "pnpm", argv: ["lint"], cwd: root },
  { id: "typecheck", label: "Typecheck", cmd: "pnpm", argv: ["typecheck"], cwd: root },
  { id: "build", label: "Build", cmd: "pnpm", argv: ["build"], cwd: root, skip: skipBuild },
  {
    id: "test",
    label: "Unit & API tests",
    cmd: "pnpm",
    argv: ["test"],
    cwd: root,
  },
  {
    id: "e2e",
    label: "Playwright E2E",
    cmd: "node",
    argv: ["scripts/run-e2e.mjs"],
    cwd: root,
    skip: skipE2e,
    env: { PLAYWRIGHT_SKIP_BUILD: skipBuild ? "1" : "" },
  },
];

function runStep(step) {
  if (step.skip) {
    console.log(`\n⏭  ${step.label} (skipped)\n`);
    return true;
  }
  if (only && !only.includes(step.id)) {
    console.log(`\n⏭  ${step.label} (not in --only)\n`);
    return true;
  }

  console.log(`\n▶  ${step.label}`);
  console.log(`   ${step.cmd} ${step.argv.join(" ")}\n`);

  const result = spawnSync(step.cmd, step.argv, {
    cwd: step.cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...step.env },
  });

  if (result.status !== 0) {
    console.error(`\n✗  ${step.label} failed (exit ${result.status ?? 1})\n`);
    return false;
  }
  console.log(`\n✓  ${step.label} passed\n`);
  return true;
}

function main() {
  console.log("═".repeat(60));
  console.log("  OSAJA'20 Welfare — local CI (mirrors GitHub Actions)");
  console.log("═".repeat(60));

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Options:
  --fast         Skip build and E2E (lint, typecheck, test only)
  --skip-e2e     Skip Playwright tests
  --skip-build   Skip production build
  --only=a,b     Run only listed steps (lint,typecheck,build,test,e2e)
  -h, --help     Show this help
`);
    process.exit(0);
  }

  const start = Date.now();
  let buildCompleted = false;
  for (const step of steps) {
    if (step.id === "build" && !step.skip && (!only || only.includes("build"))) {
      if (!runStep(step)) process.exit(1);
      buildCompleted = true;
      continue;
    }
    if (step.id === "e2e") {
      step.env = { PLAYWRIGHT_SKIP_BUILD: buildCompleted ? "1" : "" };
    }
    if (!runStep(step)) {
      process.exit(1);
    }
  }

  const secs = ((Date.now() - start) / 1000).toFixed(1);
  console.log("═".repeat(60));
  console.log(`  All CI checks passed (${secs}s)`);
  console.log("═".repeat(60));
}

main();
