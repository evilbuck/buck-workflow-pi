// Post issue comments via gh CLI.

import type { GhError } from "./gh.ts";

export async function postIssueSummary(opts: {
  issueNumber: number;
  prUrl: string;
  repo: string;
}): Promise<void> {
  const { postComment } = await import("./gh.ts");
  const body = [
    "## Auto-fix Summary",
    "",
    `PR created: ${opts.prUrl}`,
    "",
    "This PR was generated automatically by b-auto-fix.",
  ].join("\n");

  await postComment(opts.issueNumber, body, opts.repo);
}

export async function postNeedsHuman(opts: {
  issueNumber: number;
  worktreePath: string;
  branch: string;
  failureMode: string;
  repo: string;
}): Promise<void> {
  const { postComment } = await import("./gh.ts");
  const body = [
    "## Auto-fix: Needs Human",
    "",
    `**Failure mode**: ${opts.failureMode}`,
    "",
    `**Worktree**: \`${opts.worktreePath}\``,
    `**Branch**: \`${opts.branch}\``,
    "",
    "The automated fix could not complete. Please inspect the worktree and resolve manually.",
  ].join("\n");

  await postComment(opts.issueNumber, body, opts.repo);
}
