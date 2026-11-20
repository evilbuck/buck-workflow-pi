#!/usr/bin/env bun

/**
 * hooks.ts — opt-in, coexistence-safe pre-push security-audit hook management.
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

const PROFILES = {
  // full-history preserves the audit's default contract; measured ~46s on
  // buck-workflow-pi. fast (--skip-history) trades history coverage for
  // latency on long-history repositories; measured ~45s here (no local win).
  full: { args: "", label: "full" },
  fast: { args: "--skip-history", label: "fast" },
} as const;

export type HookProfile = keyof typeof PROFILES;

/** Type predicate narrowing a CLI-provided profile name to a known profile. */
export function isHookProfile(name: string): name is HookProfile {
  return Object.hasOwn(PROFILES, name);
}

interface HookExisting {
  path: string;
  content: string;
  managed: boolean;
}

export type HooksInstallResult =
  | { ok: false; reason: string }
  | {
      ok: true;
      action: "unchanged" | "replace-managed" | "create" | "replaced-managed" | "created";
      target: string;
      source: string;
      profile: HookProfile;
      dryRun?: boolean;
    };

export interface HooksStatus {
  hooksDir: string;
  installed: boolean;
  source: string | null;
  profile: string | null;
  auditScript: string | null;
  foreignHookPresent?: boolean;
}

export interface HooksRemoveResult {
  ok: boolean;
  reason?: string;
  note?: string;
  dryRun?: boolean;
  removed?: string | null;
  wouldRemove?: string;
}

function gitOut(repo: string, ...args: string[]): string | null {
  const proc = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  if (proc.status !== 0) return null;
  return proc.stdout ? proc.stdout.trim() : null;
}

/**
 * The repository's actual hooks directory: `core.hooksPath` when set,
 * `<git-dir>/hooks` otherwise.
 */
export function resolveHooksDir(repo: string): string {
  const configured = gitOut(repo, "config", "--path", "--get", "core.hooksPath");
  if (configured) return resolve(repo, configured);
  const gitDir = gitOut(repo, "rev-parse", "--absolute-git-dir");
  if (!gitDir) {
    throw new Error(`${repo} is not a git repository (or git is unavailable)`);
  }
  return join(gitDir, "hooks");
}

function posixSingleQuote(value: string): string {
  return "'" + value.replaceAll("'", "'\"'\"'") + "'";
}

function launcherContent(source: string, profileName: string): string {
  const profile = isHookProfile(profileName) ? PROFILES[profileName] : undefined;
  if (!profile) {
    throw new Error(`unknown profile "${profileName}" — expected one of ${Object.keys(PROFILES).join(", ")}`);
  }
  const template = readFileSync(join(__dirname, "hooks", "pre-push"), "utf8");
  return template
    .replaceAll("__BUCK_WORKFLOW_SOURCE__", posixSingleQuote(source))
    .replaceAll("__BUCK_PROFILE_ARGS__", profile.args)
    .replaceAll("__BUCK_PROFILE_NAME__", profile.label);
}

function hookPath(hooksDir: string): string {
  return join(hooksDir, HOOK_NAME);
}

function existingHook(hooksDir: string): HookExisting | null {
  const path = hookPath(hooksDir);
  if (!existsSync(path)) return null;
  return { path, content: readFileSync(path, "utf8"), managed: false };
}

function classifyExisting(hooksDir: string): HookExisting | null {
  const found = existingHook(hooksDir);
  if (!found) return found;
  found.managed = found.content.startsWith(`#!/usr/bin/env bash\n${HOOK_MARKER}\n`);
  return found;
}

/** Install (or idempotently reinstall) the managed pre-push launcher. */
export function hooksInstall({
  repo,
  source,
  profile = "full",
  dryRun = false,
}: {
  repo: string;
  source: string;
  profile?: HookProfile;
  dryRun?: boolean;
}): HooksInstallResult {
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
    return { ok: true, dryRun: true, action: existing ? "replace-managed" : "create", target, source: resolve(source), profile };
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
export function hooksStatus({ repo }: { repo: string }): HooksStatus {
  const hooksDir = resolveHooksDir(repo);
  const existing = classifyExisting(hooksDir);
  const info: HooksStatus = {
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
  const sourceMatch = existing.content.match(/^BUCK_WORKFLOW_SOURCE=('(?:[^']|'"'"')*')$/m);
  info.source = sourceMatch ? sourceMatch[1].slice(1, -1).replaceAll("'\"'\"'", "'") : null;
  const profileMatch = existing.content.match(/Audit profile: (\w+)/);
  info.profile = profileMatch ? profileMatch[1] : null;
  const audit = info.source ? join(info.source, "scripts", "security-audit.sh") : null;
  info.auditScript = audit && existsSync(audit) ? audit : null;
  return info;
}

/** Remove the managed launcher. Foreign hooks are never touched. */
export function hooksRemove({ repo, dryRun = false }: { repo: string; dryRun?: boolean }): HooksRemoveResult {
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
        `(missing "${HOOK_MARKER}" marker). Remove it manually if intended.`,
    };
  }
  if (dryRun) return { ok: true, dryRun: true, removed: null, wouldRemove: existing.path };
  rmSync(existing.path);
  return { ok: true, removed: existing.path };
}
