/// <reference types="node" />
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";

const source = join(dirname(fileURLToPath(import.meta.url)), "sync-storage-bundle.ts");
const roots: string[] = [];
const files: string[] = [
  "skills/_shared/storage/example.ts",
  "skills/_shared/scripts/workflow-state.ts",
  "skills/_shared/scripts/workflow-state-cli.ts",
  "skills/_shared/scripts/workflow-state.test.ts",
  "skills/_shared/scripts/consumer-persist.test.ts",
  "skills/_shared/scripts/file-store.test.ts",
  "skills/_shared/scripts/storage-publication.test.ts",
  "skills/_shared/scripts/plan-source.test.ts",
  "migrations/example.sql",
  "skills/_shared/scripts/postgres-store.test.ts",
  "skills/_shared/workflow-state-access.md",
];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it("copies canonical storage inputs into the plugin without touching unrelated files", () => {
  const root = mkdtempSync(join(tmpdir(), "bundle-sync-test-"));
  roots.push(root);
  mkdirSync(join(root, "scripts"));
  copyFileSync(source, join(root, "scripts", "sync-storage-bundle.ts"));
  for (const file of files) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `content:${file}`);
  }
  const unrelated = join(root, "plugins/buck-workflow/unrelated.txt");
  mkdirSync(dirname(unrelated), { recursive: true });
  writeFileSync(unrelated, "unchanged");
  const result = spawnSync("bun", [join(root, "scripts/sync-storage-bundle.ts")], { encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  for (const file of files) {
    expect(readFileSync(join(root, "plugins/buck-workflow", file), "utf8")).toBe(`content:${file}`);
  }
  expect(readFileSync(unrelated, "utf8")).toBe("unchanged");
});
