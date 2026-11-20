#!/usr/bin/env bun
// buck-workflow release / npm publish script.
//
// Usage:
//   bun scripts/publish.ts                 # bump patch, test, publish, tag, push
//   bun scripts/publish.ts minor           # bump minor instead
//   bun scripts/publish.ts major           # bump major
//   bun scripts/publish.ts none            # publish current version, no bump
//   bun scripts/publish.ts --dry-run       # preview tarball, publish nothing
//
// Prereqs:
//   - npm registry credentials (from `npm login` once, or a token line in
//     .npmrc — Bun reads the same .npmrc / bunfig.toml as npm)
//   - clean git tree (`bun pm version` commits + tags)
//
// Secret safety: the `files` allowlist in package.json is the gate — only listed
// dirs ship. This script also prints `bun pm pack --dry-run` so you review exactly
// what enters the tarball before it goes public. No .npmignore required while the
// allowlist is maintained, but you can add one to drop e.g. *.test.ts from scripts/.
//
// Flow: auth check -> clean-tree check -> version bump (optional) ->
// already-published guard -> test gate -> tarball preview -> publish --access public ->
// push the release tag.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const argv: string[] = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const bump = argv.find((a) => ["patch", "minor", "major"].includes(a));
const NO_BUMP = argv.includes("none");

interface PackageJson {
  name: string;
  version: string;
}

const readPkg = (): PackageJson =>
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as PackageJson;

const run = (cmd: string): void => { execSync(cmd, { stdio: "inherit" }); };
const out = (cmd: string, onErr = ""): string => {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return onErr;
  }
};
const step = (m: string): void => console.log(`\n▶ ${m}`);

// 1. npm auth
step("Checking npm login…");
const who = out("bun pm whoami");
if (!who) {
  console.error("✗ Not logged into npm. Run `npm login` first.");
  process.exit(1);
}
console.log(`  logged in as ${who}`);

// 2. clean git tree (npm version requires it)
step("Checking git tree…");
const dirty = out("git status --porcelain");
if (dirty) {
  console.error("✗ Git tree not clean. Commit or stash first.\n" + dirty);
  process.exit(1);
}

// 3. version bump (skipped in --dry-run; creates git commit + tag v<new>)
if (!NO_BUMP && !DRY) {
  const kind = bump || "patch";
  step(`Bumping ${kind} (git commit + tag)…`);
  run(`bun pm version ${kind}`);
}

// 4. already-published guard
let { name, version } = readPkg();
step(`Checking ${name}@${version} on registry…`);
const exists = out(`bun pm view ${name}@${version}`);
if (!DRY && exists) {
  console.error(
    `✗ ${name}@${version} is already published. Bump the version (pass \`patch\`/\`minor\`/\`major\` instead of \`none\`) before releasing.`
  );
  process.exit(1);
}

// 5. test gate
step("Running tests…");
run("bun run test");

// 6. tarball preview (review this for anything unexpected / sensitive)
step("Tarball contents…");
run("bun pm pack --dry-run");

if (DRY) {
  console.log("\n⊘ Dry-run — nothing published.");
  process.exit(0);
}

// 7. publish (public; prepublishOnly re-runs tests as a safety net)
step(`Publishing ${name}@${version} (public)…`);
run("bun publish --access public");

// 8. push the release tag
step("Pushing tags…");
const pushed = out("git push --follow-tags", "__FAIL__");
if (pushed === "__FAIL__") {
  console.warn("⚠ git push failed — push manually: git push --follow-tags");
}

console.log(`\n✓ Released ${name}@${version}`);
