/**
 * git-exec — shared synchronous git/binary execution for the b-*-improved
 * commands. Consolidates the three byte-identical exec helpers that previously
 * lived in b-commit-improved, b-pr-improved, and b-kamal-release.
 */

import { execFileSync } from "node:child_process";

/**
 * Run `bin` synchronously, capturing output. Throws an Error carrying the
 * command and trimmed stderr (falling back to the raw message) on failure.
 * Optional `env` entries override the inherited process environment.
 */
export function execText(bin: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): string {
  try {
    return execFileSync(bin, args, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
  } catch (e: unknown) {
    const err = e as Error & { stderr?: Buffer };
    throw new Error(`${bin} ${args.join(" ")} failed: ${err.stderr?.toString().trim() || err.message}`);
  }
}

/** Run git via {@link execText}. */
export function execGit(args: string[], cwd: string, env?: NodeJS.ProcessEnv): string {
  return execText("git", args, cwd, env);
}

/** True when `bin` is on PATH and executable. */
export function hasBin(bin: string): boolean {
  try {
    execFileSync(bin, ["--version"], { stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}
