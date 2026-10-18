#!/usr/bin/env bun
/**
 * Retain a generated presentation package on the configured durable store.
 *
 * The on-disk `presentations/<slug>/` package stays the user-facing export the
 * preview server serves; this script copies the exact package bytes (pages,
 * assets, sources, manifest — binary intact) into the configured storage
 * contract as attachment artifacts with one attempt receipt.
 *
 * Usage:
 *   bun skills/b-present/scripts/retain-package.ts <package-dir> [--cwd <dir>]
 */
import { resolve } from "node:path";
import { retainPresentationPackage } from "../../_shared/storage/consumers.js";

const args = process.argv.slice(2);
const cwdFlag = args.indexOf("--cwd");
if (cwdFlag >= 0 && (cwdFlag + 1 >= args.length || args[cwdFlag + 1]!.startsWith("--"))) {
  console.error("retain-package: --cwd requires a directory");
  process.exit(2);
}
const positionalArgs = cwdFlag >= 0
  ? args.filter((_, index) => index !== cwdFlag && index !== cwdFlag + 1)
  : args;
const packageDir = positionalArgs.find((arg) => !arg.startsWith("--"));

if (typeof packageDir !== "string" || packageDir.trim() === "") {
  console.error("usage: bun skills/b-present/scripts/retain-package.ts <package-dir> [--cwd <dir>]");
  process.exit(2);
}

const cwd = cwdFlag >= 0 ? args[cwdFlag + 1] : undefined;
try {
  const retained = await retainPresentationPackage(resolve(packageDir), {
    ...(cwd ? { cwd: resolve(cwd) } : {}),
  });
  console.log(JSON.stringify({ ok: true, files: retained.revisions.length, runId: retained.runId }));
} catch (error) {
  console.error(`retain-package: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
