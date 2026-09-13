/**
 * git-ops — the deterministic git lifecycle around the review loop:
 * origin freshness (fetch + autostash rebase onto the exact fetched ref),
 * pre-review checkpoints, disposable detached Reviewer worktrees, and the
 * pre-run state capture used for resume validation and recovery.
 *
 * The extension creates local checkpoint commits and never pushes.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

const GIT_ENV = {
  GIT_AUTHOR_NAME: "buck-code-review",
  GIT_AUTHOR_EMAIL: "code-review@buck.invalid",
  GIT_COMMITTER_NAME: "buck-code-review",
  GIT_COMMITTER_EMAIL: "code-review@buck.invalid",
};

/** Run git synchronously; throws with stderr context on failure. */
export function git(cwd: string, args: string[], env: NodeJS.ProcessEnv = {}): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

export function tryGit(
  cwd: string,
  args: string[],
  env: NodeJS.ProcessEnv = {},
): { ok: boolean; stdout: string; stderr: string } {
  try {
    return { ok: true, stdout: git(cwd, args, env), stderr: "" };
  } catch (e: unknown) {
    const err = e as { stderr?: string; message?: string };
    return { ok: false, stdout: "", stderr: err.stderr?.trim() || err.message || "git failed" };
  }
}

/** Every existing non-bare checkout counts as a worktree, including the primary. */
export function isGitCheckout(cwd: string): boolean {
  const inside = tryGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
  const bare = tryGit(cwd, ["rev-parse", "--is-bare-repository"]);
  return inside.ok && inside.stdout === "true" && bare.stdout === "false";
}

export function currentBranch(cwd: string): string | null {
  const result = tryGit(cwd, ["symbolic-ref", "--short", "HEAD"]);
  return result.ok ? result.stdout : null;
}

export function resolveHead(cwd: string): string {
  return git(cwd, ["rev-parse", "HEAD"]);
}

/** Detected default branch from origin; `--base` overrides the name only. */
export function detectBaseBranch(cwd: string): string | null {
  const symref = tryGit(cwd, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  if (symref.ok && symref.stdout.startsWith("origin/")) return symref.stdout.slice("origin/".length);
  for (const candidate of ["master", "main"]) {
    if (tryGit(cwd, ["rev-parse", "--verify", "--quiet", `origin/${candidate}`]).ok) return candidate;
  }
  return null;
}

export interface FetchResult {
  ok: boolean;
  /** The exact fetched commit the review is pinned against. */
  commit: string | null;
  error: string | null;
}

/** Fetch `origin <base>` and pin the fetched commit. Failure is a hard stop. */
export function fetchBase(cwd: string, base: string): FetchResult {
  const result = tryGit(cwd, ["fetch", "origin", base]);
  if (!result.ok) return { ok: false, commit: null, error: result.stderr };
  const pinned = tryGit(cwd, ["rev-parse", "FETCH_HEAD"]);
  if (!pinned.ok) return { ok: false, commit: null, error: pinned.stderr };
  return { ok: true, commit: pinned.stdout, error: null };
}

export function conflictedFiles(cwd: string): string[] {
  const result = tryGit(cwd, ["diff", "--name-only", "--diff-filter=U"]);
  return result.ok ? result.stdout.split("\n").filter(Boolean) : [];
}

export type RebaseStatus = "ok" | "conflict" | "failed";

export interface RebaseResult {
  status: RebaseStatus;
  files: string[];
  error: string | null;
}

/**
 * Rebase the current branch onto FETCH_HEAD with autostash semantics.
 * A conflict is reported for Fixer routing; a non-conflict failure aborts
 * the rebase so the pre-run state is restored rather than left dirty.
 */
export function rebaseOntoFetched(cwd: string): RebaseResult {
  const result = tryGit(cwd, ["rebase", "--autostash", "FETCH_HEAD"]);
  if (result.ok) return { status: "ok", files: [], error: null };
  const files = conflictedFiles(cwd);
  if (files.length > 0) return { status: "conflict", files, error: result.stderr };
  tryGit(cwd, ["rebase", "--abort"]);
  return { status: "failed", files: [], error: result.stderr };
}

/** Deterministic continuation after a Fixer resolves conflict files. */
export function continueRebase(cwd: string): RebaseResult {
  const result = tryGit(cwd, ["rebase", "--continue"], { GIT_EDITOR: "true" });
  if (result.ok) return { status: "ok", files: [], error: null };
  const files = conflictedFiles(cwd);
  if (files.length > 0) return { status: "conflict", files, error: result.stderr };
  tryGit(cwd, ["rebase", "--abort"]);
  return { status: "failed", files: [], error: result.stderr };
}

export function stageFiles(cwd: string, files: string[]): void {
  for (const file of files) {
    tryGit(cwd, ["add", "--", file]);
  }
}

/** Stage resolved conflict files and continue; loops are driven by the caller. */
export function resolveAndContinue(cwd: string, resolvedFiles: string[]): RebaseResult {
  stageFiles(cwd, resolvedFiles);
  return continueRebase(cwd);
}

export function abortRebase(cwd: string): void {
  tryGit(cwd, ["rebase", "--abort"]);
}

export interface PreRunState {
  head: string;
  branch: string | null;
  dirty: boolean;
  untracked: string[];
}

export function capturePreRun(cwd: string): PreRunState {
  const status = tryGit(cwd, ["status", "--porcelain"]);
  return {
    head: resolveHead(cwd),
    branch: currentBranch(cwd),
    dirty: status.ok ? status.stdout !== "" : true,
    untracked: listUntracked(cwd),
  };
}

export function listUntracked(cwd: string): string[] {
  const result = tryGit(cwd, ["ls-files", "--others", "--exclude-standard"]);
  return result.ok ? result.stdout.split("\n").filter(Boolean) : [];
}

/**
 * Create one checkpoint commit over tracked changes plus the selected
 * untracked paths. Returns the commit sha, or null when nothing was staged.
 */
export function checkpointCommit(cwd: string, untrackedSelected: string[], message: string): string | null {
  const before = tryGit(cwd, ["status", "--porcelain"]).stdout;
  if (before === "") return null;
  tryGit(cwd, ["add", "-u"]);
  if (untrackedSelected.length > 0) stageFiles(cwd, untrackedSelected);
  const staged = tryGit(cwd, ["diff", "--cached", "--name-only"]);
  if (staged.stdout === "") return null;
  const commit = tryGit(cwd, ["commit", "-m", message], GIT_ENV);
  if (!commit.ok) throw new Error(`checkpoint commit failed: ${commit.stderr}`);
  return resolveHead(cwd);
}

export function createDetachedWorktree(cwd: string, sha: string, path: string): { ok: boolean; error: string | null } {
  const result = tryGit(cwd, ["worktree", "add", "--detach", path, sha]);
  return { ok: result.ok, error: result.ok ? null : result.stderr };
}

/** Remove a worktree only when it is clean; never force. */
export function removeWorktree(cwd: string, path: string): { ok: boolean; error: string | null } {
  const status = tryGit(path, ["status", "--porcelain"]);
  if (status.ok && status.stdout !== "") {
    return { ok: false, error: "worktree is dirty; retained for inspection" };
  }
  const result = tryGit(cwd, ["worktree", "remove", path]);
  return { ok: result.ok, error: result.ok ? null : result.stderr };
}

/**
 * Content fingerprint of HEAD plus the entire working tree, used to
 * validate resume safety. `git stash create` captures tracked state as a
 * dangling commit without touching the stash list; untracked files are
 * hashed in directly. The status digest is the fallback when no committer
 * identity is configured.
 */
export function worktreeFingerprint(cwd: string): string {
  const head = tryGit(cwd, ["rev-parse", "HEAD"]).stdout;
  const stash = tryGit(cwd, ["stash", "create"]);
  if (stash.ok) {
    const untracked = tryGit(cwd, ["ls-files", "--others", "--exclude-standard"]).stdout;
    let untrackedDigest = "";
    for (const rel of untracked.split("\n").filter(Boolean)) {
      try {
        untrackedDigest += `${rel}:${createHash("sha256").update(readFileSync(join(cwd, rel))).digest("hex")}\n`;
      } catch {
        untrackedDigest += `${rel}:unreadable\n`;
      }
    }
    const untrackedSha = createHash("sha256").update(untrackedDigest).digest("hex");
    return `${head}:stash:${stash.stdout}:${untrackedSha}`;
  }
  const status = tryGit(cwd, ["status", "--porcelain"]);
  return `${head}:status:${status.stdout}`;
}

export function gitCommonDir(cwd: string): string {
  const raw = git(cwd, ["rev-parse", "--git-common-dir"]);
  return isAbsolute(raw) ? raw : resolve(cwd, raw);
}
export function hasOngoingGitOperation(cwd: string): boolean {
  const common = gitCommonDir(cwd);
  const markers = ["rebase-apply", "rebase-merge", "MERGE_HEAD", "CHERRY_PICK_HEAD"];
  return markers.some((marker) => existsSync(join(common, marker)));
}
