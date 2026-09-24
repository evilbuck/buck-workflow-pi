import { execFile } from "node:child_process";
import { isAbsolute, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitIdentity {
  projectKey: string;
  branch: string | null;
  worktreeRoot: string;
  detached: boolean;
}

export type GitRunner = (args: readonly string[], cwd: string) => Promise<string>;
export interface GitHeadState {
  key: string;
  branch: string;
  detached: boolean;
}


export const runGit: GitRunner = async (args, cwd) => {
  const { stdout } = await execFileAsync("git", [...args], { cwd, encoding: "utf8" });
  return stdout;
};

async function value(runner: GitRunner, args: readonly string[], cwd: string): Promise<string> {
  const output = (await runner(args, cwd)).trim();
  if (!output) throw new Error(`git ${args.join(" ")} returned no value`);
  return output;
}
export async function resolveGitHeadState(
  cwd: string,
  runner: GitRunner = runGit,
): Promise<GitHeadState | null> {
  try {
    const branchName = await value(runner, ["rev-parse", "--abbrev-ref", "HEAD"], cwd);
    if (branchName !== "HEAD") {
      return { key: branchName, branch: branchName, detached: false };
    }
    const shortSha = await value(runner, ["rev-parse", "--short", "HEAD"], cwd);
    return { key: `HEAD:${shortSha}`, branch: `detached/${shortSha}`, detached: true };
  } catch {
    return null;
  }
}


export async function resolveGitIdentity(
  cwd: string,
  runner: GitRunner = runGit,
  knownHeadState?: GitHeadState | null,
): Promise<GitIdentity> {
  try {
    const headState = knownHeadState === undefined
      ? await resolveGitHeadState(cwd, runner)
      : knownHeadState;
    if (!headState) throw new Error("not a git repository");
    const worktreeRoot = await value(runner, ["rev-parse", "--show-toplevel"], cwd);
    const commonDirRaw = await value(runner, ["rev-parse", "--git-common-dir"], cwd);
    let projectKey: string;
    try {
      projectKey = redactRemoteCredentials(await value(runner, ["remote", "get-url", "origin"], cwd));
    } catch {
      projectKey = isAbsolute(commonDirRaw)
        ? commonDirRaw
        : resolve(worktreeRoot, commonDirRaw);
    }

    return {
      projectKey,
      branch: headState.branch,
      worktreeRoot,
      detached: headState.detached,
    };
  } catch {
    return { projectKey: cwd, branch: null, worktreeRoot: cwd, detached: false };
  }
}

/**
 * Strip embedded credentials from URL-form remotes before persistence.
 * scp-style `git@host:path` remotes are not URLs and pass through unchanged.
 */
export function redactRemoteCredentials(remote: string): string {
  let url: URL;
  try {
    url = new URL(remote);
  } catch {
    return remote;
  }
  if (!url.username && !url.password) return remote;
  url.username = "";
  url.password = "";
  return url.toString();
}
