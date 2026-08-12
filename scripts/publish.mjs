#!/usr/bin/env node
// buck-workflow release / npm publish script.
//
// Usage:
//   npm run release                 # bump patch, test, publish, tag, push
//   npm run release -- minor        # bump minor instead
//   npm run release -- major        # bump major
//   npm run release -- none         # publish current version, no bump
//   npm run release -- --dry-run    # preview tarball, publish nothing
//
// Prereqs:
//   - `npm login` once (publishes as the logged-in account)
//   - clean git tree (`npm version` commits + tags)
//
// Secret safety: the `files` allowlist in package.json is the gate — only listed
// dirs ship. This script also prints `npm pack --dry-run` so you review exactly
// what enters the tarball before it goes public. No .npmignore required while the
// allowlist is maintained, but you can add one to drop e.g. *.test.mjs from scripts/.
//
// Flow: auth check -> clean-tree check -> version bump (optional) ->
// already-published guard -> test gate -> tarball preview -> publish --access public ->
// push the release tag.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const bump = argv.find((a) => ["patch", "minor", "major"].includes(a));
const NO_BUMP = argv.includes("none");

const readPkg = () =>
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
const out = (cmd, onErr = "") => {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return onErr;
  }
};
const step = (m) => console.log(`\n▶ ${m}`);

// 1. npm auth
step("Checking npm login…");
const who = out("npm whoami");
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
  run(`npm version ${kind}`);
}

// 4. already-published guard
let { name, version } = readPkg();
step(`Checking ${name}@${version} on registry…`);
const exists = out(`npm view ${name}@${version} version`);
if (!DRY && exists) {
  console.error(
    `✗ ${name}@${version} is already published. Bump the version (pass \`patch\`/\`minor\`/\`major\` instead of \`none\`) before releasing.`
  );
  process.exit(1);
}

// 5. test gate
step("Running tests…");
run("npm test");

// 6. tarball preview (review this for anything unexpected / sensitive)
step("Tarball contents…");
run("npm pack --dry-run");

if (DRY) {
  console.log("\n⊘ Dry-run — nothing published.");
  process.exit(0);
}

// 7. publish (public; prepublishOnly re-runs tests as a safety net)
step(`Publishing ${name}@${version} (public)…`);
run("npm publish --access public");

// 8. push the release tag
step("Pushing tags…");
const pushed = out("git push --follow-tags", "__FAIL__");
if (pushed === "__FAIL__") {
  console.warn("⚠ git push failed — push manually: git push --follow-tags");
}

console.log(`\n✓ Released ${name}@${version}`);
