#!/usr/bin/env bun
// skills/code-review/scripts/pr-context.ts
//
// PR code-review context: parse arg, resolve PR, create worktree,
// emit pr-context.json + pr.diff. Zero deps. Requires bun, git, gh.
//
// Usage:
//   bun skills/code-review/scripts/pr-context.ts <pr-url|owner/repo#N|#N|N>

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { matchPrRef } from "./pr-ref.js";

// ---------- domain types ----------

type ParsedPr = { owner: string; repo: string; number: number };

type PrView = {
  number: number;
  title: string;
  state: string;
  url: string;
  isDraft: boolean;
  isCrossRepository: boolean;
  headRefName: string;
  headRefOid: string;
  headRepositoryOwner: { login: string };
  headRepository: { name: string };
  baseRefName: string;
  baseRefOid: string;
  additions: number;
  deletions: number;
  changedFiles: number;
};

type ChangedFile = {
  path: string;
  additions: number;
  deletions: number;
  // `gh` < 2.50 uses `status` ("added" | "modified" | "removed").
  // `gh` >= 2.50 uses `changeType` ("ADDED" | "MODIFIED" | "DELETED").
  // Both optional in our shape; the value is unused downstream.
  status?: string;
  changeType?: string;
};

type RepoView = { nameWithOwner: string };

type PrContextFile = {
  pr: {
    number: number;
    title: string;
    url: string;
    state: string;
    is_draft: boolean;
    is_fork: boolean;
    head_ref: string;
    base_ref: string;
    additions: number;
    deletions: number;
    changed_files: number;
  };
  owner: string;
  repo: string;
  head_sha: string;
  base_sha: string;
  worktree: string;
  base_remote: string;
  fetched_at: string;
  changed_files_detail: ChangedFile[];
};

type ExecError = Error & {
  status?: number | null;
  stdout?: Buffer | string;
  stderr?: Buffer | string;
};

// ---------- small utilities ----------

function die(msg: string, code = 1): never {
  console.error(`pr-context: ${msg}`);
  process.exit(code);
}

function formatExecError(e: unknown): string {
  if (e instanceof Error) {
    const ee = e as ExecError;
    if (ee.stderr) {
      const s = typeof ee.stderr === "string" ? ee.stderr : ee.stderr.toString();
      const trimmed = s.trim();
      if (trimmed) return trimmed;
    }
    return e.message;
  }
  return String(e);
}

function execGh(args: readonly string[]): string {
  try {
    return execFileSync("gh", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (e: unknown) {
    const subcommand = args[1] ?? "";
    die(`gh ${args[0]} ${subcommand} failed: ${formatExecError(e)}`.trim());
  }
}

function execGit(args: readonly string[]): string {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (e: unknown) {
    die(`git ${args[0]} failed: ${formatExecError(e)}`);
  }
}

// tryGit runs a git command that may legitimately fail (e.g. a fallback fetch).
// Returns true on success, false on failure. The error is logged to stderr so
// the user can see what was tried, but execution continues.
function tryGit(args: readonly string[]): boolean {
  try {
    execFileSync("git", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch (e: unknown) {
    console.error(`pr-context: git ${args.join(" ")} failed: ${formatExecError(e)}`);
    return false;
  }
}

// ---------- type guards ----------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function hasStringProp(o: object, key: string): o is Record<string, string> {
  return typeof (o as Record<string, unknown>)[key] === "string";
}

function hasNumberProp(o: object, key: string): o is Record<string, number> {
  return typeof (o as Record<string, unknown>)[key] === "number";
}

function hasBooleanProp(o: object, key: string): o is Record<string, boolean> {
  return typeof (o as Record<string, unknown>)[key] === "boolean";
}

function isOwner(v: unknown): v is { login: string } {
  return isObject(v) && hasStringProp(v, "login");
}

function isHeadRepository(v: unknown): v is { name: string } {
  return isObject(v) && hasStringProp(v, "name");
}

function isChangedFile(v: unknown): v is ChangedFile {
  if (!isObject(v)) return false;
  if (!hasStringProp(v, "path")) return false;
  if (!hasNumberProp(v, "additions")) return false;
  if (!hasNumberProp(v, "deletions")) return false;
  // status/changeType both optional
  return true;
}

function isChangedFileArray(v: unknown): v is ChangedFile[] {
  return Array.isArray(v) && v.every(isChangedFile);
}

function isRepoView(v: unknown): v is RepoView {
  return isObject(v) && hasStringProp(v, "nameWithOwner");
}

function isPrView(v: unknown): v is PrView {
  if (!isObject(v)) return false;
  return (
    hasNumberProp(v, "number") &&
    hasStringProp(v, "title") &&
    hasStringProp(v, "state") &&
    hasStringProp(v, "url") &&
    hasBooleanProp(v, "isDraft") &&
    hasBooleanProp(v, "isCrossRepository") &&
    hasStringProp(v, "headRefName") &&
    hasStringProp(v, "headRefOid") &&
    hasStringProp(v, "baseRefName") &&
    hasStringProp(v, "baseRefOid") &&
    hasNumberProp(v, "additions") &&
    hasNumberProp(v, "deletions") &&
    hasNumberProp(v, "changedFiles") &&
    isOwner(v["headRepositoryOwner"]) &&
    isHeadRepository(v["headRepository"])
  );
}

function parseJson<T>(raw: string, guard: (v: unknown) => v is T, label: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e: unknown) {
    die(`failed to parse ${label} JSON: ${formatExecError(e)}`);
  }
  if (!guard(parsed)) {
    die(`${label} JSON did not match expected shape`);
  }
  return parsed;
}

// ---------- argument parsing ----------

function parsePrArg(arg: string): ParsedPr | null {
  const ref = matchPrRef(arg);
  if (!ref) return null;

  if (ref.kind !== "num") {
    return { owner: ref.owner, repo: ref.repo, number: ref.number };
  }

  // "#N" and bare "N": resolve owner/repo from the current checkout.
  const repoRaw = execGh(["repo", "view", "--json", "nameWithOwner"]);
  const repo = parseJson(repoRaw, isRepoView, "gh repo view");
  const [owner, name] = repo.nameWithOwner.split("/");
  if (!owner || !name) die(`unexpected nameWithOwner: ${repo.nameWithOwner}`);
  return { owner, repo: name, number: ref.number };
}

// ---------- main ----------

const arg = process.argv[2];
if (!arg || arg === "--help" || arg === "-h") {
  console.error("usage: pr-context <pr-url|owner/repo#N|#N|N>");
  process.exit(arg ? 0 : 2);
}

// 1. Preflight
execGit(["rev-parse", "--is-inside-work-tree"]);
execGh(["auth", "status"]);

const parsed = parsePrArg(arg);
if (!parsed) die(`unrecognized PR argument: ${arg}`);

// 2. Resolve PR via gh
const prViewRaw = execGh([
  "pr", "view", String(parsed.number), "--repo", `${parsed.owner}/${parsed.repo}`,
  "--json",
  "number,title,state,url,isDraft,isCrossRepository,headRefName,headRefOid,headRepositoryOwner,headRepository,baseRefName,baseRefOid,additions,deletions,changedFiles",
]);
const pr = parseJson(prViewRaw, isPrView, "gh pr view");

if (pr.state !== "OPEN") {
  console.error(`pr-context: warning: PR #${pr.number} is ${pr.state}; reviewing anyway`);
}

// 3. Fetch the head into a remote-tracking ref. The `refs/remotes/_pr/<N>/head`
// namespace is remote-tracking, so it never collides with a checked-out branch.
// (A plain `refs/heads/pr-N-head` collides whenever any worktree holds it.)
const refName = `refs/remotes/_pr/${pr.number}/head`;
if (pr.isCrossRepository) {
  const forkUrl = `https://github.com/${pr.headRepositoryOwner.login}/${pr.headRepository.name}.git`;
  if (!tryGit(["fetch", forkUrl, `${pr.headRefName}:${refName}`])) {
    die(`failed to fetch head from fork ${forkUrl}`);
  }
} else {
  const remotes = execGit(["remote"]).trim().split("\n").filter(Boolean);
  let fetchRemote: string | null = null;
  for (const r of remotes) {
    try {
      execGit(["rev-parse", "--verify", `${r}/${pr.baseRefName}`]);
      fetchRemote = r;
      break;
    } catch {
      continue;
    }
  }
  if (!fetchRemote) die(`no local remote has branch '${pr.baseRefName}'; run \`git fetch --all\``);
  // First try GitHub's magic ref `pull/<N>/head`; fall back to fetching by branch name.
  if (
    !tryGit(["fetch", fetchRemote, `pull/${pr.number}/head:${refName}`]) &&
    !tryGit(["fetch", fetchRemote, `${pr.headRefName}:${refName}`])
  ) {
    die(`failed to fetch PR #${pr.number} head from remote '${fetchRemote}'`);
  }
}

// 4. Compute worktree path
const repoRoot = execGit(["rev-parse", "--show-toplevel"]).trim();
const worktreesDir = join(repoRoot, ".worktrees");
const worktreePath = join(worktreesDir, `pr-${pr.number}`);

// 5. Create, recreate, or reuse
const needCreate = ((): boolean => {
  if (!existsSync(worktreePath)) return true;
  try {
    const existing = execGit(["-C", worktreePath, "rev-parse", "HEAD"]).trim();
    return existing !== pr.headRefOid;
  } catch {
    return true;
  }
})();

if (needCreate) {
  if (existsSync(worktreePath)) {
    try {
      execGit(["worktree", "remove", "--force", worktreePath]);
    } catch {
      rmSync(worktreePath, { recursive: true, force: true });
    }
    execGit(["worktree", "prune"]);
  }
  mkdirSync(worktreesDir, { recursive: true });
  execGit(["worktree", "add", worktreePath, refName]);
}

// 6. Make sure the base is fetchable in the worktree (best-effort)
const baseRemote = ((): string => {
  const remotes = execGit(["remote"]).trim().split("\n").filter(Boolean);
  for (const r of remotes) {
    try {
      execGit(["rev-parse", "--verify", `${r}/${pr.baseRefName}`]);
      return r;
    } catch {
      continue;
    }
  }
  return "origin";
})();
tryGit(["-C", worktreePath, "fetch", baseRemote, pr.baseRefName]);

// 7. Capture the diff (in the worktree so paths are correct)
const diff = execGit(["-C", worktreePath, "diff", `${pr.baseRefOid}..${pr.headRefOid}`]);

// 8. Per-file detail from gh
const filesRaw = execGh([
  "pr", "view", String(pr.number), "--repo", `${parsed.owner}/${parsed.repo}`,
  "--json", "files", "--jq", ".files",
]);
const changedFiles = parseJson(filesRaw, isChangedFileArray, "gh pr view files");

// 9. Write the context blob and the diff
const context: PrContextFile = {
  pr: {
    number: pr.number,
    title: pr.title,
    url: pr.url,
    state: pr.state,
    is_draft: pr.isDraft,
    is_fork: pr.isCrossRepository,
    head_ref: pr.headRefName,
    base_ref: pr.baseRefName,
    additions: pr.additions,
    deletions: pr.deletions,
    changed_files: pr.changedFiles,
  },
  owner: parsed.owner,
  repo: parsed.repo,
  head_sha: pr.headRefOid,
  base_sha: pr.baseRefOid,
  worktree: worktreePath,
  base_remote: baseRemote,
  fetched_at: new Date().toISOString(),
  changed_files_detail: changedFiles,
};
writeFileSync(join(worktreePath, "pr-context.json"), JSON.stringify(context, null, 2));
writeFileSync(join(worktreePath, "pr.diff"), diff);

// 10. Tight stdout summary — the LLM `jq`s pr-context.json for details
const tight = {
  pr_number: pr.number,
  pr_title: pr.title,
  pr_url: pr.url,
  pr_state: pr.state,
  is_fork: pr.isCrossRepository,
  worktree: worktreePath,
  head_sha: pr.headRefOid,
  base_sha: pr.baseRefOid,
  base_remote: baseRemote,
  changed_files_count: changedFiles.length,
  context_path: join(worktreePath, "pr-context.json"),
  diff_path: join(worktreePath, "pr.diff"),
};
console.log(JSON.stringify(tight, null, 2));
