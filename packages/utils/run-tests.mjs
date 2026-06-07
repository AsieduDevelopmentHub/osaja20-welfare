import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = join(fileURLToPath(import.meta.url), "..", "src");

function collectTests(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectTests(path));
    else if (entry.name.endsWith(".test.ts")) files.push(path);
  }
  return files;
}

const tests = collectTests(srcDir);
if (!tests.length) {
  console.error("No test files found under", srcDir);
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...tests], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
