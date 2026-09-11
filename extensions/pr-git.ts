import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileCaptured } from "./command-progress.js";

const DEFAULT_BASE_NAMES = ["main", "master", "dev", "develop"] as const;

export interface BaseCandidate {
  name: string;
  exists: boolean;
  remote: string;
}

export interface RebaseResult {
  ok: boolean;
  conflicts: string[];
  stderr: string;
}

export interface ContinueRebaseResult {
  done: boolean;
  conflicts: string[];
  stderr: string;
}

export function execGit(args: string[], cwd: string, env?: NodeJS.ProcessEnv): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
  } catch (e: unknown) {
    const err = e as Error & { stderr?: Buffer };
    throw new Error(`git ${args.join(" ")} failed: ${err.stderr?.toString().trim() || err.message}`);
  }
}


function tryGit(
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
): { ok: boolean; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync("git", args, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: env ? { ...process.env, ...env } : process.env,
    });
    return { ok: true, stdout, stderr: "" };
  } catch (e: unknown) {
    const err = e as Error & { stderr?: Buffer | string; stdout?: Buffer | string };
    const stdout = typeof err.stdout === "string" ? err.stdout : err.stdout?.toString() ?? "";
    const stderr = (typeof err.stderr === "string" ? err.stderr : err.stderr?.toString())?.trim() || err.message;
    return { ok: false, stdout, stderr };
  }
}
export function resolveGitDir(cwd: string): string {
  const dir = execGit(["rev-parse", "--git-dir"], cwd).trim();
  return dir.startsWith("/") ? dir : join(cwd, dir);
}

export function baseCachePath(cwd: string): string {
  return join(resolveGitDir(cwd), "b-pr-base");
}

export function readBaseCache(cwd: string): string | null {
  const path = baseCachePath(cwd);
  if (!existsSync(path)) return null;
  const value = readFileSync(path, "utf-8").trim();
  return value.length > 0 ? value : null;
}

export function writeBaseCache(cwd: string, branch: string): void {
  writeFileSync(baseCachePath(cwd), `${branch}\n`);
}

export function clearBaseCache(cwd: string): void {
  const path = baseCachePath(cwd);
  try {
    unlinkSync(path);
  } catch {
    /* missing cache is fine */
  }
}

export function refExists(cwd: string, name: string): { exists: boolean; remote: string } {
  if (tryGit(["rev-parse", "--verify", `refs/remotes/origin/${name}`], cwd).ok) {
    return { exists: true, remote: "origin" };
  }
  if (tryGit(["rev-parse", "--verify", `refs/heads/${name}`], cwd).ok) {
    return { exists: true, remote: "" };
  }
  return { exists: false, remote: "origin" };
}

export type CacheStatus = "hit" | "miss" | "mismatch" | "stale";

export function cachedBaseStatus(cwd: string, expectedBase?: string): CacheStatus {
  const cached = readBaseCache(cwd);
  if (!cached) return "miss";
  if (!refExists(cwd, cached).exists) return "stale";
  if (expectedBase && cached !== expectedBase) return "mismatch";
  return "hit";
}

export function listBaseCandidates(cwd: string, preferredBase?: string): BaseCandidate[] {
  const names: string[] = [];
  if (preferredBase) names.push(preferredBase);
  for (const name of DEFAULT_BASE_NAMES) {
    if (!names.includes(name)) names.push(name);
  }
  const found: BaseCandidate[] = [];
  for (const name of names) {
    const info = refExists(cwd, name);
    if (info.exists) found.push({ name, exists: true, remote: info.remote });
  }
  return found;
}

export function rebaseInProgress(cwd: string): boolean {
  const gitDir = resolveGitDir(cwd);
  return existsSync(join(gitDir, "rebase-merge")) || existsSync(join(gitDir, "rebase-apply"));
}

export function listConflictPaths(cwd: string): string[] {
  const raw = tryGit(["diff", "--diff-filter=U", "--name-only"], cwd).stdout.trim();
  return raw ? raw.split("\n").filter(Boolean) : [];
}

export function startRebase(cwd: string, baseRef: string): RebaseResult {
  const result = tryGit(["rebase", "--autostash", baseRef], cwd);
  if (result.ok) return { ok: true, conflicts: [], stderr: "" };
  return { ok: false, conflicts: listConflictPaths(cwd), stderr: result.stderr };
}

export function continueRebase(cwd: string): ContinueRebaseResult {
  if (!rebaseInProgress(cwd)) {
    return { done: true, conflicts: [], stderr: "" };
  }
  const result = tryGit(["rebase", "--continue"], cwd, { GIT_EDITOR: "true" });
  const conflicts = listConflictPaths(cwd);
  if (conflicts.length > 0) {
    return { done: false, conflicts, stderr: result.stderr };
  }
  if (rebaseInProgress(cwd)) {
    return { done: false, conflicts: [], stderr: result.stderr || "rebase still in progress" };
  }
  return { done: true, conflicts: [], stderr: result.stderr };
}

export function readOid(cwd: string, rev: string): string {
  return execGit(["rev-parse", rev], cwd).trim();
}

export function readRemoteOid(cwd: string, branch: string): string | null {
  const result = tryGit(["rev-parse", "--verify", `refs/remotes/origin/${branch}`], cwd);
  return result.ok ? result.stdout.trim() : null;
}

async function execGitPush(args: string[], cwd: string): Promise<void> {
  const result = await execFileCaptured("git", args, cwd);
  if (result.code !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim() || result.stdout.trim() || "unknown"}`);
  }
}

export async function pushBranchIfAhead(
  branch: string,
  cwd: string,
  allowForceWithLease = false,
): Promise<boolean> {
  const remoteRef = `refs/remotes/origin/${branch}`;
  try {
    execGit(["rev-parse", "--verify", remoteRef], cwd);
  } catch {
    await execGitPush(["push", "-u", "origin", branch], cwd);
    return true;
  }

  const [behind, ahead] = execGit(["rev-list", "--left-right", "--count", `${remoteRef}...${branch}`], cwd)
    .trim()
    .split(/\s+/)
    .map(Number);
  if (ahead === 0) return false;
  if (behind > 0 && !allowForceWithLease) {
    throw new Error(`${remoteRef} has ${behind} commit(s) missing locally; refusing to overwrite it`);
  }

  const args = ["push"];
  if (behind > 0) args.push("--force-with-lease");
  await execGitPush([...args, "-u", "origin", branch], cwd);
  return true;
}
