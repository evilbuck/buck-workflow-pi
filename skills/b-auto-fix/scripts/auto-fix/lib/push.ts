// Push branch to origin with retry.

export class PushError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number | null,
  ) {
    super(message);
    this.name = "PushError";
  }
}

export async function pushBranch(
  branch: string,
  opts: { repoDir: string },
): Promise<void> {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const proc = Bun.spawn({
      cmd: ["git", "push", "-u", "origin", branch],
      cwd: opts.repoDir,
      stdout: "pipe",
      stderr: "pipe",
    });
    const err = await new Response(proc.stderr).text();
    await proc.exited;

    if (proc.exitCode === 0) return;

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
    } else {
      throw new PushError(
        `git push failed after ${maxRetries} attempts: ${err.trim()}`,
        proc.exitCode,
      );
    }
  }
}
