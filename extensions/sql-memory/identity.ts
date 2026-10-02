import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { redactRemoteCredentials } from "../token-attribution/git-identity.js";

const execFileAsync = promisify(execFile);

/** Strict git runner for sql-memory identity. Returns null on any failure. */
export type SqlGitRunner = (args: readonly string[]) => Promise<string | null>;

export interface SqlMemoryIdentity {
  email: string;
  origin: string;
  branch: string | null;
  commit: string | null;
}

export async function defaultSqlGitRunner(args: readonly string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", [...args], { encoding: "utf8" });
    const trimmed = stdout.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

/**
 * Resolve the caller's identity for `remember`. Fails closed when git is missing,
 * the cwd is not a repository, or the email and origin cannot be read.
 *
 * Detached HEADs set branch and commit together to null, matching `saveSqlFacts`.
 */
export async function resolveRememberIdentity(
  cwd: string,
  runner: SqlGitRunner = defaultSqlGitRunner,
): Promise<SqlMemoryIdentity> {
  const email = await runner(["-C", cwd, "config", "user.email"]);
  if (!email) throw new Error("remember requires git config user.email");
  const originRaw = await runner(["-C", cwd, "remote", "get-url", "origin"]);
  if (!originRaw) throw new Error("remember requires git origin; set one with git remote add origin <url>");
  const branchName = await runner(["-C", cwd, "rev-parse", "--abbrev-ref", "HEAD"]);
  const commit = await runner(["-C", cwd, "rev-parse", "HEAD"]);
  const detached = branchName === "HEAD";
  const branch = detached ? null : branchName;
  if (!detached && (branch === null) !== (commit === null)) {
    throw new Error("remember requires branch and commit_sha together; detached HEADs must pass both as null");
  }
  const origin = redactRemoteCredentials(originRaw);
  if (detached) return { email, origin, branch: null, commit: null };
  return { email, origin, branch, commit };
}