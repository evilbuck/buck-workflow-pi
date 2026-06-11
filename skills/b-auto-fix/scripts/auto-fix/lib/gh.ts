// Thin wrapper around the `gh` CLI. All functions shell out via Bun.spawn.
// Tests use a fake-gh shim prepended to PATH — no network calls.

export interface GhIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: { name: string }[];
  assignees: { login: string }[];
}

export interface GhPr {
  number: number;
  title: string;
  state: string;
  headRefName: string;
  url: string;
  isDraft: boolean;
}

export class GhError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = "GhError";
  }
}
async function gh(args: string[], opts?: { cwd?: string }): Promise<string> {
  const maxRetries = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const ghBin = process.env.AUTO_FIX_GH_BIN ?? "gh";
      const proc = Bun.spawn({
        cmd: [ghBin, ...args],
        cwd: opts?.cwd,
        stdout: "pipe",
        stderr: "pipe",
      });
      const [out, err] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      await proc.exited;

      if (proc.exitCode !== 0) {
        throw new GhError(
          `gh ${args[0]} failed (exit ${proc.exitCode})`,
          proc.exitCode,
          err,
        );
      }
      return out;
    } catch (e) {
      if (e instanceof GhError) throw e;
      lastError = e;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 200));
      }
    }
  }
  throw lastError;
}

// ── Read-only ───────────────────────────────────────────
export async function listOpenIssues(opts: {
  assignee: string;
  repo: string;
  limit?: number;
}): Promise<GhIssue[]> {
  const args = [
    "issue",
    "list",
    "--repo",
    opts.repo,
    "--assignee",
    opts.assignee,
    "--state",
    "open",
    "--limit",
    String(opts.limit ?? 30),
    "--json",
    "number,title,body,state,labels,assignees",
  ];
  const raw = await gh(args);
  return JSON.parse(raw) as GhIssue[];
}

export async function getIssue(
  issueNumber: number,
  repo: string,
): Promise<GhIssue> {
  const args = [
    "issue",
    "view",
    String(issueNumber),
    "--repo",
    repo,
    "--json",
    "number,title,body,state,labels,assignees",
  ];
  const raw = await gh(args);
  return JSON.parse(raw) as GhIssue;
}

export async function findExistingDraftPr(
  branch: string,
  repo: string,
): Promise<GhPr | null> {
  const args = [
    "pr",
    "list",
    "--repo",
    repo,
    "--head",
    branch,
    "--state",
    "open",
    "--json",
    "number,title,state,headRefName,url,isDraft",
  ];
  const raw = await gh(args);
  const prs = JSON.parse(raw) as GhPr[];
  return prs.length > 0 ? prs[0]! : null;
}

// ── Write ───────────────────────────────────────────────
export async function addLabel(
  issueNumber: number,
  label: string,
  repo: string,
): Promise<void> {
  await gh([
    "issue",
    "edit",
    String(issueNumber),
    "--repo",
    repo,
    "--add-label",
    label,
  ]);
}

export async function removeLabel(
  issueNumber: number,
  label: string,
  repo: string,
): Promise<void> {
  await gh([
    "issue",
    "edit",
    String(issueNumber),
    "--repo",
    repo,
    "--remove-label",
    label,
  ]);
}

export async function postComment(
  issueNumber: number,
  body: string,
  repo: string,
): Promise<void> {
  const proc = Bun.spawn({
    cmd: [
      "gh",
      "issue",
      "comment",
      String(issueNumber),
      "--repo",
      repo,
      "--body",
      body,
    ],
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;
  if (proc.exitCode !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new GhError(
      `gh issue comment failed (exit ${proc.exitCode})`,
      proc.exitCode,
      err,
    );
  }
}
