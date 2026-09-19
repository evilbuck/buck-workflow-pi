#!/usr/bin/env node

/**
 * hooks.mjs — opt-in, coexistence-safe pre-push security-audit hook management.
 *
 * `buck-workflow hooks install|status|remove` is the ONLY path that touches git
 * hooks. Normal package installation never configures hooks.
 *
 * Guarantees:
 * - Repository-scoped: resolves the named repository's actual hooks directory
 *   (honouring core.hooksPath) and writes only a `pre-push` launcher there.
 * - Refuses to overwrite or delete a pre-existing non-managed pre-push; the
 *   diagnostic says how to chain manually instead.
 * - Idempotent: reinstalling replaces the managed launcher in place.
 * - Removable: `hooks remove` deletes the managed launcher and nothing else,
 *   restoring the prior (hook-less or foreign-hook) state exactly.
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const HOOK_MARKER = "# buck-workflow managed pre-push (security-audit)";
export const HOOK_NAME = "pre-push";

/**
 * Ownership marker: the launcher's first line, preceded by its shebang.
 *
 * `HOOK_MARKER` alone is only a substring test — a foreign dispatcher that
 * chains or embeds the launcher would count as "managed" and get overwritten
 * or deleted. Ownership requires the marker to be the actual managed header:
 * line 1 (shebang) or line 2, starting at column 1.
 */
export const BUCK_MANAGED_HEADER = `#!/usr/bin/env bash\n${HOOK_MARKER}`;

/**
 * Positive managed-hook identification: the file must carry the buck-workflow
 * managed header within its first two lines (line 2 right after the shebang).
 *
 * @param {string} content - full hook file contents
 * @returns {boolean}
 */
export function isManagedHook(content) {
  const head = content.slice(0, 512);
  const lines = head.split("\n", 2);
  return lines.some((line) => line === HOOK_MARKER);
}

const PROFILES = {
  // full-history preserves the audit's default contract; measured ~46s on
  // buck-workflow-pi. fast (--skip-history) trades history coverage for
  // latency on long-history repositories; measured ~45s here (no local win).
  full: { args: "", label: "full" },
  fast: { args: "--skip-history", label: "fast" },
};

function gitOut(repo, ...args) {
  const proc = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  if (proc.status !== 0) return null;
  return proc.stdout.trim();
}

/**
 * The repository's actual hooks directory: `core.hooksPath` when set,
 * `<git-dir>/hooks` otherwise.
 */
export function resolveHooksDir(repo) {
  // `--path` makes git expand a leading `~` (and `~user`) itself. Without it
  // Node resolves the literal `~/.githooks` as `<repo>/~/.githooks`.
  const configured = gitOut(repo, "config", "--path", "--get", "core.hooksPath");
  if (configured) return resolve(repo, configured);
  const gitDir = gitOut(repo, "rev-parse", "--absolute-git-dir");
  if (!gitDir) {
    throw new Error(`${repo} is not a git repository (or git is unavailable)`);
  }
  return join(gitDir, "hooks");
}

/**
 * POSIX single-quote `path` for safe embedding in a shell script:
 * `BUCK_WORKFLOW_SOURCE='<path>'`. Embedded single quotes are spelled
 * `'\''`, the standard end-quote/escaped-quote/reopen-quote idiom, so any
 * metacharacter in the path stays literal at execution time.
 * @param {string} path
 * @returns {string}
 */
function shQuote(path) {
  return `'${path.replaceAll("'", `'\\''`)}'`;
}

function launcherContent(source, profileName) {
  const profile = PROFILES[profileName];
  if (!profile) {
    throw new Error(`unknown profile "${profileName}" — expected one of ${Object.keys(PROFILES).join(", ")}`);
  }
  const template = readFileSync(join(__dirname, "hooks", "pre-push"), "utf8");
  return template
    .replaceAll("__BUCK_WORKFLOW_SOURCE_QUOTED__", shQuote(resolve(source)))
    .replaceAll("__BUCK_PROFILE_ARGS__", profile.args)
    .replaceAll("__BUCK_PROFILE_NAME__", profile.label);
}

function hookPath(hooksDir) {
  return join(hooksDir, HOOK_NAME);
}

function existingHook(hooksDir) {
  const path = hookPath(hooksDir);
  if (!existsSync(path)) return null;
  return { path, content: readFileSync(path, "utf8"), managed: false };
}

function classifyExisting(hooksDir) {
  const found = existingHook(hooksDir);
  if (!found) return found;
  // Positive ownership: managed header within the first two lines.
  // A mere marker substring is NOT ownership (foreign dispatchers can embed it).
  found.managed = isManagedHook(found.content);
  return found;
}

/** Install (or idempotently reinstall) the managed pre-push launcher. */
export function hooksInstall({ repo, source, profile = "full", dryRun = false }) {
  const hooksDir = resolveHooksDir(repo);
  const target = hookPath(hooksDir);
  const existing = classifyExisting(hooksDir);

  if (existing && !existing.managed) {
    return {
      ok: false,
      reason:
        `refusing to overwrite pre-existing pre-push hook at ${target} — it is not managed by buck-workflow. ` +
        `To chain both audits, edit that hook to call "${HOOK_MARKER}" content, or relocate it and re-run ` +
        `buck-workflow hooks install. core.hooksPath chaining: add the buck-workflow launcher as a separate ` +
        `script and call both from your own dispatcher.`,
    };
  }

  const nextContent = launcherContent(resolve(source), profile);
  if (existing && existing.content === nextContent) {
    return { ok: true, action: "unchanged", target, source: resolve(source), profile };
  }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      action: existing ? "replace-managed" : "create",
      target,
      source: resolve(source),
      profile,
    };
  }

  mkdirSync(hooksDir, { recursive: true });
  writeFileSync(target, nextContent);
  chmodSync(target, 0o755);
  return {
    ok: true,
    action: existing ? "replaced-managed" : "created",
    target,
    source: resolve(source),
    profile,
  };
}

/** Report hook state without writing anything. */
export function hooksStatus({ repo }) {
  const hooksDir = resolveHooksDir(repo);
  const existing = classifyExisting(hooksDir);
  const info = {
    hooksDir,
    installed: Boolean(existing?.managed),
    source: null,
    profile: null,
    auditScript: null,
  };
  if (!existing?.managed) {
    info.foreignHookPresent = Boolean(existing);
    return info;
  }
  const sourceMatch = existing.content.match(/BUCK_WORKFLOW_SOURCE='(.*)'/);
  info.source = sourceMatch ? unescapeSh(sourceMatch[1]) : null;
  const profileMatch = existing.content.match(/Audit profile: (\w+)/);
  info.profile = profileMatch ? profileMatch[1] : null;
  const audit = info.source ? join(info.source, "scripts", "security-audit.sh") : null;
  info.auditScript = audit && existsSync(audit) ? audit : null;
  return info;
}

/**
 * Reverse of shQuote's escaping: the captured value between the outer single
 * quotes still contains the `'\''` idiom for embedded quotes; collapse it
 * back to a literal `'`.
 * @param {string} escaped
 * @returns {string}
 */
function unescapeSh(escaped) {
  return escaped.replaceAll(`'\\''`, `'`);
}

/** Remove the managed launcher. Foreign hooks are never touched. */
export function hooksRemove({ repo, dryRun = false }) {
  const hooksDir = resolveHooksDir(repo);
  const existing = classifyExisting(hooksDir);
  if (!existing) {
    return { ok: true, note: "nothing installed — no managed pre-push present" };
  }
  if (!existing.managed) {
    return {
      ok: false,
      reason:
        `refusing to remove pre-push at ${existing.path} — it is not managed by buck-workflow ` +
        `(missing "${HOOK_MARKER}" header). Remove it manually if intended.`,
    };
  }
  if (!dryRun) rmSync(existing.path);
  return {
    ok: true,
    ...(dryRun
      ? { dryRun: true, action: "would-remove", note: "dry run — nothing removed" }
      : { removed: existing.path }),
  };
}
