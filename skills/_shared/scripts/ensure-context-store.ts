#!/usr/bin/env bun
// skills/_shared/scripts/ensure-context-store.ts
//
// Dual-mode .context/ ensure: in-repo mkdir, or symlink to an XDG store
// when .context is gitignored and origin exists.
//
// Usage:
//   bun skills/_shared/scripts/ensure-context-store.ts [--json] [cwd]
//
// Exit codes:
//   0 = success
//   1 = hard failure

import { execFileSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  readlinkSync,
  symlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

export const SYMLINK_NOT_IGNORED_WARNING =
  ".context is a symlink but is not gitignored; committing it would leak the store path";

export const NO_ORIGIN_NOTE =
  ".context is gitignored but this repo has no origin remote; created in-repo .context/memory (will not sync across machines)";

export type EnsureMode = "in-repo" | "external";
export type EnsureAction =
  | "untouched"
  | "created-store"
  | "ensured-layout"
  | "mkdir"
  | "repaired-dangling"
  | "noop";

export interface EnsureResult {
  ok: true;
  mode: EnsureMode;
  action: EnsureAction;
  contextPath: string;
  storePath?: string;
  warning?: string;
  note?: string;
}

type ContextKind = "missing" | "dir" | "symlink" | "other";

interface ContextInspect {
  kind: ContextKind;
  target?: string;
}

function runGit(
  cwd: string,
  args: string[],
): { status: number; stdout: string } {
  try {
    const stdout = execFileSync("git", args, {
      cwd,
      env: process.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout };
  } catch (err) {
    const e = err as { status?: number; stdout?: string };
    return { status: e.status ?? 1, stdout: e.stdout ?? "" };
  }
}

export function normalizeOriginUrl(url: string): string {
  let s = url.trim();
  s = s.replace(/^(https?|ssh|git):\/\//i, "");
  const at = s.lastIndexOf("@");
  if (at !== -1) {
    const slash = s.indexOf("/");
    const colon = s.indexOf(":");
    const atBeforeSlash = slash === -1 || at < slash;
    const atBeforeColon = colon === -1 || at < colon;
    if (atBeforeSlash && (atBeforeColon || colon < at)) {
      s = s.slice(at + 1);
    }
  }
  const scpColon = s.indexOf(":");
  const firstSlash = s.indexOf("/");
  if (scpColon !== -1 && (firstSlash === -1 || scpColon < firstSlash)) {
    s = `${s.slice(0, scpColon)}/${s.slice(scpColon + 1)}`;
  }
  s = s.replace(/\.git$/i, "");
  s = s.replace(/\/+$/, "");
  return s;
}

function validateOriginSlug(slug: string): string {
  const parts = slug.split("/");
  if (
    isAbsolute(slug) ||
    parts.length !== 3 ||
    parts.some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(
      `origin must normalize to host/org/repo without path traversal: ${slug}`,
    );
  }
  return slug;
}

export function resolveOriginSlug(cwd: string): string | null {
  const { status, stdout } = runGit(cwd, ["remote", "get-url", "origin"]);
  if (status !== 0) return null;
  const url = stdout.trim();
  if (!url) return null;
  return validateOriginSlug(normalizeOriginUrl(url));
}

export function isGitignored(cwd: string, path: string): boolean {
  return runGit(cwd, ["check-ignore", "-q", "--", path]).status === 0;
}

function storeRoot(): string {
  const xdg =
    process.env.XDG_DATA_HOME && process.env.XDG_DATA_HOME.length > 0
      ? process.env.XDG_DATA_HOME
      : join(homedir(), ".local/share");
  return join(xdg, "buck/projects");
}

function storePathForSlug(slug: string): string {
  const root = storeRoot();
  const storePath = resolve(root, slug);
  const relativePath = relative(root, storePath);
  if (
    !relativePath ||
    relativePath === ".." ||
    relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`origin store path escapes XDG root: ${slug}`);
  }
  return storePath;
}

function inspectContext(contextPath: string): ContextInspect {
  try {
    const st = lstatSync(contextPath);
    if (st.isSymbolicLink()) {
      return { kind: "symlink", target: readlinkSync(contextPath) };
    }
    if (st.isDirectory()) return { kind: "dir" };
    return { kind: "other" };
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === "ENOENT") return { kind: "missing" };
    throw err;
  }
}

function layoutExists(root: string): boolean {
  try {
    return lstatSync(join(root, "memory")).isDirectory() &&
      lstatSync(join(root, "backlog")).isDirectory();
  } catch {
    return false;
  }
}

function ensureStoreLayout(root: string): void {
  mkdirSync(join(root, "memory"), { recursive: true });
  mkdirSync(join(root, "backlog"), { recursive: true });
}

function withSymlinkWarning(
  cwd: string,
  result: EnsureResult,
): EnsureResult {
  if (!isGitignored(cwd, ".context")) {
    return { ...result, warning: SYMLINK_NOT_IGNORED_WARNING };
  }
  return result;
}

function ensureExternalFromMissing(cwd: string, slug: string): EnsureResult {
  const contextPath = join(cwd, ".context");
  const storePath = storePathForSlug(slug);
  ensureStoreLayout(storePath);
  symlinkSync(storePath, contextPath);
  return {
    ok: true,
    mode: "external",
    action: "created-store",
    contextPath,
    storePath,
  };
}

function ensureExistingSymlink(
  cwd: string,
  contextPath: string,
  target: string,
): EnsureResult {
  const storePath = isAbsolute(target) ? target : resolve(cwd, target);
  const slug = resolveOriginSlug(cwd);
  if (!slug) {
    throw new Error(`cannot verify ${contextPath} without an origin remote`);
  }
  const expectedStorePath = storePathForSlug(slug);
  if (storePath !== expectedStorePath) {
    throw new Error(
      `${contextPath} points outside this repository's external store: ${storePath}`,
    );
  }
  let storeMissing = false;
  try {
    lstatSync(storePath);
  } catch {
    storeMissing = true;
  }


  if (storeMissing) {
    ensureStoreLayout(storePath);
    return withSymlinkWarning(cwd, {
      ok: true,
      mode: "external",
      action: "repaired-dangling",
      contextPath,
      storePath,
    });
  }

  if (layoutExists(storePath)) {
    return withSymlinkWarning(cwd, {
      ok: true,
      mode: "external",
      action: "noop",
      contextPath,
      storePath,
    });
  }

  ensureStoreLayout(storePath);
  return withSymlinkWarning(cwd, {
    ok: true,
    mode: "external",
    action: "ensured-layout",
    contextPath,
    storePath,
  });
}

export function ensureContextStore(cwd: string): EnsureResult {
  const contextPath = join(cwd, ".context");
  const inspect = inspectContext(contextPath);

  if (inspect.kind === "dir") {
    return { ok: true, mode: "in-repo", action: "untouched", contextPath };
  }

  if (inspect.kind === "symlink" && inspect.target !== undefined) {
    return ensureExistingSymlink(cwd, contextPath, inspect.target);
  }

  if (inspect.kind === "other") {
    throw new Error(`${contextPath} exists and is not a directory or symlink`);
  }

  const ignored = isGitignored(cwd, ".context");
  const slug = resolveOriginSlug(cwd);
  if (ignored && slug) {
    return ensureExternalFromMissing(cwd, slug);
  }

  mkdirSync(join(contextPath, "memory"), { recursive: true });
  const result: EnsureResult = {
    ok: true,
    mode: "in-repo",
    action: "mkdir",
    contextPath,
  };
  if (ignored && !slug) result.note = NO_ORIGIN_NOTE;
  return result;
}

export function parseArgs(argv: string[]): { json: boolean; cwd: string } {
  let json = false;
  let cwd = process.cwd();
  for (const arg of argv) {
    if (arg === "--json") json = true;
    else if (!arg.startsWith("-")) cwd = arg;
  }
  return { json, cwd };
}

function main(): void {
  const { json, cwd } = parseArgs(process.argv.slice(2));
  try {
    const result = ensureContextStore(cwd);
    if (result.warning) console.error(result.warning);
    if (result.note) console.error(result.note);
    if (json) console.log(JSON.stringify(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (json) console.log(JSON.stringify({ ok: false, error: message }));
    else console.error(message);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
