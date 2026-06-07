#!/usr/bin/env node
/** Build shared workspace packages (required before Next dev if dist was cleared). */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

const probe = spawnSync(isWin ? "npx" : "pnpm", isWin ? ["pnpm", "--version"] : ["--version"], {
  shell: isWin,
  encoding: "utf8",
});
const runPnpm = probe.status === 0 && !isWin
  ? { cmd: "pnpm", argv: ["--filter", "./packages/*", "build"] }
  : { cmd: "npx", argv: ["pnpm", "--filter", "./packages/*", "build"] };

const result = spawnSync(runPnpm.cmd, runPnpm.argv, {
  cwd: root,
  stdio: "inherit",
  shell: isWin,
});

process.exit(result.status ?? 1);
