// Git worktree management — pure git operations, no network.
// Tests use temp git repos.

export interface WorktreeOpts {
  repoDir: string;
  worktreeDir: string;
  branchPrefix: string;
}

export class WorktreeError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number | null,
  ) {
    super(message);
    this.name = "WorktreeError";
  }
}

// ── Internal: run `git` in repoDir ─────────────────────
async function git(args: string[], cwd: string): Promise<string> {
  const proc = Bun.spawn({
    cmd: ["git", ...args],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  await proc.exited;

  if (proc.exitCode !== 0) {
    throw new WorktreeError(
      `git ${args[0]} failed: ${err.trim()}`,
      proc.exitCode,
    );
  }
  return out.trim();
}

// ── Check if working tree is clean ─────────────────────
async function isClean(cwd: string): Promise<boolean> {
  const out = await git(["status", "--porcelain"], cwd);
  return out === "";
}

// ── Public API ─────────────────────────────────────────
export async function create(
  issueN: number,
  base: string,
  opts: WorktreeOpts,
): Promise<string> {
  if (!(await isClean(opts.repoDir))) {
    throw new WorktreeError(
      "Working tree is dirty. Please commit or stash changes first.",
      null,
    );
  }

  const branch = `${opts.branchPrefix}${issueN}`;
  const worktreePath = path(issueN, opts);

  // Check if branch already exists
  try {
    await git(["rev-parse", "--verify", branch], opts.repoDir);
    throw new WorktreeError(
      `Branch ${branch} already exists. Remove it first or use a different issue.`,
      null,
    );
  } catch (e) {
    if (e instanceof WorktreeError && e.exitCode === null) throw e;
    // Branch doesn't exist — that's expected
  }

  await git(
    ["worktree", "add", worktreePath, "-b", branch, base],
    opts.repoDir,
  );

  return worktreePath;
}

export async function remove(
  issueN: number,
  opts: WorktreeOpts,
): Promise<void> {
  const branch = `${opts.branchPrefix}${issueN}`;
  const worktreePath = path(issueN, opts);

  // Remove worktree if it exists
  try {
    await git(["worktree", "remove", worktreePath], opts.repoDir);
  } catch {
    // Worktree may not exist — that's ok (idempotent cleanup)
  }

  // Delete branch if it exists
  try {
    await git(["branch", "-D", branch], opts.repoDir);
  } catch {
    // Branch may not exist — that's ok
  }
}

export function path(issueN: number, opts: WorktreeOpts): string {
  return `${opts.worktreeDir}/issue-${issueN}`;
}
