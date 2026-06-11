// Create draft PR via gh CLI.

export interface PrResult {
  url: string;
  number: number;
}

export class PrError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = "PrError";
  }
}

export async function createDraftPr(opts: {
  head: string;
  base: string;
  title: string;
  body: string;
  repo: string;
}): Promise<PrResult> {
  const ghBin = process.env.AUTO_FIX_GH_BIN ?? "gh";
  const proc = Bun.spawn({
    cmd: [
      ghBin,
      "pr",
      "create",
      "--draft",
      "--base",
      opts.base,
      "--head",
      opts.head,
      "--title",
      opts.title,
      "--body",
      opts.body,
      "--repo",
      opts.repo,
    ],
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  await proc.exited;

  if (proc.exitCode !== 0) {
    throw new PrError(
      `gh pr create failed (exit ${proc.exitCode})`,
      proc.exitCode,
      err,
    );
  }

  // Parse PR URL to extract number
  const match = out.match(/pull\/(\d+)/);
  return {
    url: out.trim(),
    number: match ? parseInt(match[1], 10) : 0,
  };
}
