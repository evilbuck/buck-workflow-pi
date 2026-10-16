#!/usr/bin/env bun
// skills/code-review/scripts/pr-context.ts
//
// PR code-review context: parse arg, resolve PR, create worktree,
// emit pr-context.json + pr.diff, and retain the pinned evidence on the
// configured run-private adapter. Zero deps. Requires bun, git, gh.
//
// Usage:
//   bun skills/code-review/scripts/pr-context.ts <pr-url|owner/repo#N|#N|N>
//   bun skills/code-review/scripts/pr-context.ts --restore <pr-url|owner/repo#N|#N|N> [--head-sha <sha>] [--out <dir>]
//   bun skills/code-review/scripts/pr-context.ts --list <pr-url|owner/repo#N|#N|N>
//
// Restore reads only the retained pinned artifacts of this run/checkout. It
// never refetches `gh`/git inputs and never falls back to the local exports.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { matchPrRef } from "./pr-ref.js";
import {
  commitConsumerBatch, consumerKey, readConsumer, type ConsumerScope, type ConsumerWrite,
} from "../../_shared/storage/consumers.js";
import { revisionHash } from "../../_shared/storage/adapter-utils.js";
import { resolveConsumerContext, withBoundStore, type TrustedWorkflowContext } from "../../_shared/scripts/workflow-state.js";
import { createRunId } from "../../_shared/storage/identity.js";

// ---------- pinned evidence identity ----------

/** Pinned PR evidence is Buck-owned run-private audit input, never user source. */
const PIN_KIND = "audit" as const;
const PIN_SUBJECT = "code-review-pr" as const;
const PIN_AUTHOR = "buck-code-review";
const PIN_SOURCE = "pr-context";

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

/** A retained pinned snapshot, addressed by its immutable pinned identity. */
type PinnedNames = {
  prefix: string;
  context: string;
  diff: string;
  baseSha: string;
  headSha: string;
};

type RetainedPin = {
  base_sha: string;
  head_sha: string;
  context_revision: string;
  diff_revision: string;
  context_sha256: string;
  diff_sha256: string;
  receipt_run?: string;
  reused_existing: boolean;
  /** Re-capture produced the same immutable diff bytes as the pinned snapshot. */
  diff_matches_pinned: boolean;
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

// ---------- pinned evidence names ----------

// The pinned SHA pair is part of the artifact identity, so a later PR revision
// retains a second snapshot and never overwrites the original pinned input.
function pinPrefix(owner: string, repo: string, number: number): string {
  return `pull/${owner}/${repo}/pr-${number}/`;
}

function pinNames(owner: string, repo: string, number: number, baseSha: string, headSha: string): PinnedNames {
  const pin = `${baseSha}..${headSha}`;
  const prefix = `${pinPrefix(owner, repo, number)}${pin}/`;
  return { prefix, context: `${prefix}pr-context.json`, diff: `${prefix}pr.diff`, baseSha, headSha };
}

function parsePinName(logicalName: string): { baseSha: string; headSha: string; file: string } | null {
  const file = logicalName.slice(logicalName.lastIndexOf("/") + 1);
  if (file !== "pr-context.json" && file !== "pr.diff") return null;
  const parent = logicalName.slice(0, logicalName.lastIndexOf("/"));
  const pin = parent.slice(parent.lastIndexOf("/") + 1);
  const parts = pin.split("..");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { baseSha: parts[0], headSha: parts[1], file };
}

// ---------- trusted adapter retention ----------

/**
 * Bind the owning source checkout, never the temporary review worktree: the
 * review worktree is a different git worktree and would mint a foreign
 * worktree/run identity for the pinned evidence.
 */
function owningCheckout(): string {
  return execGit(["rev-parse", "--show-toplevel"]).trim();
}

type PinBinding = { context: TrustedWorkflowContext; scope: ConsumerScope };

async function boundScope(cwd: string): Promise<PinBinding> {
  const context = await resolveConsumerContext(cwd);
  if (!context.worktreeId || !context.runId) die("owning checkout is not bound to a trusted worktree/run identity");
  const scope: ConsumerScope = {
    projectId: context.projectId,
    branchId: context.branchId,
    worktreeId: context.worktreeId,
    runId: context.runId,
    publishedRevisionIds: context.publishedRevisionIds ?? [],
  };
  return { context, scope };
}

/** Retain the exact pinned metadata and diff bytes as one atomic, receipted batch. */
async function retainPinnedEvidence(input: {
  cwd: string;
  binding: PinBinding;
  names: PinnedNames;
  contextBytes: Uint8Array;
  diffBytes: Uint8Array;
}): Promise<RetainedPin> {
  const { context, scope } = input.binding;
  const names = input.names;
  const expectedSha = { context: revisionHash(input.contextBytes), diff: revisionHash(input.diffBytes) };

  return withBoundStore(input.cwd, context, async (store) => {
    const existingContext = await readConsumer(store, scope, PIN_KIND, PIN_SUBJECT, names.context);
    const existingDiff = await readConsumer(store, scope, PIN_KIND, PIN_SUBJECT, names.diff);
    if (existingContext && existingDiff) {
      // The pinned identity already exists: the first retained snapshot stays
      // authoritative. Re-capturing the same SHAs never rewrites it.
      return {
        base_sha: names.baseSha,
        head_sha: names.headSha,
        context_revision: existingContext.revision,
        diff_revision: existingDiff.revision,
        context_sha256: existingContext.sha256,
        diff_sha256: existingDiff.sha256,
        reused_existing: true,
        diff_matches_pinned: existingDiff.sha256 === expectedSha.diff,
      } satisfies RetainedPin;
    }
    if (existingContext || existingDiff) {
      die(`retained pinned evidence for ${names.prefix} is incomplete; refusing a partial overwrite`);
    }

    const receiptRun = createRunId();
    const writes: ConsumerWrite[] = [
      {
        kind: PIN_KIND, subjectId: PIN_SUBJECT, logicalName: names.context, bytes: input.contextBytes,
        author: PIN_AUTHOR, source: PIN_SOURCE, expectedRevision: null,
        links: [consumerKey(scope, PIN_KIND, PIN_SUBJECT, names.diff)],
      },
      {
        kind: PIN_KIND, subjectId: PIN_SUBJECT, logicalName: names.diff, bytes: input.diffBytes,
        author: PIN_AUTHOR, source: PIN_SOURCE, expectedRevision: null,
        links: [consumerKey(scope, PIN_KIND, PIN_SUBJECT, names.context)],
      },
    ];
    const committed = await commitConsumerBatch(store, scope, writes, {
      attemptId: receiptRun, runId: receiptRun, status: "attempted", kind: "rows",
      metadataDuties: ["pr-context", "pr-diff"],
    });

    const readbackContext = await readConsumer(store, scope, PIN_KIND, PIN_SUBJECT, names.context);
    const readbackDiff = await readConsumer(store, scope, PIN_KIND, PIN_SUBJECT, names.diff);
    if (!readbackContext || !readbackDiff) die("retained pinned evidence did not read back");
    assertPinnedHashes(readbackContext.sha256, readbackDiff.sha256, expectedSha);
    return {
      base_sha: names.baseSha,
      head_sha: names.headSha,
      context_revision: committed.revisions[0]!,
      diff_revision: committed.revisions[1]!,
      context_sha256: readbackContext.sha256,
      diff_sha256: readbackDiff.sha256,
      receipt_run: committed.receipt.runId,
      reused_existing: false,
      diff_matches_pinned: true,
    } satisfies RetainedPin;
  });
}

function assertPinnedHashes(contextSha: string, diffSha: string, expected: { context: string; diff: string }): void {
  if (contextSha !== expected.context || diffSha !== expected.diff) {
    die("retained pinned evidence does not match the captured pinned bytes");
  }
}

type RetainedListing = {
  base_sha: string;
  head_sha: string;
  context_revision: string;
  diff_revision: string;
  context_sha256: string;
  diff_sha256: string;
};

/** Enumerate the retained pinned snapshots of this run/checkout for one PR. */
async function listPinnedEvidence(input: { cwd: string; binding: PinBinding; owner: string; repo: string; number: number }): Promise<RetainedListing[]> {
  const { context, scope } = input.binding;
  return withBoundStore(input.cwd, context, async (store) => {
    const listed = await store.list({
      projectId: scope.projectId,
      branchId: scope.branchId,
      publishedRevisionIds: scope.publishedRevisionIds ?? [],
      worktreeId: scope.worktreeId,
      runId: scope.runId,
      subjectId: PIN_SUBJECT,
      kind: PIN_KIND,
      logicalNamePrefix: pinPrefix(input.owner, input.repo, input.number),
    });
    const pins = new Map<string, RetainedListing>();
    for (const item of listed) {
      const parsed = parsePinName(item.key.logicalName);
      if (!parsed) continue;
      const entry = pins.get(`${parsed.baseSha}..${parsed.headSha}`) ?? {
        base_sha: parsed.baseSha,
        head_sha: parsed.headSha,
        context_revision: "",
        diff_revision: "",
        context_sha256: "",
        diff_sha256: "",
      };
      if (parsed.file === "pr-context.json") {
        entry.context_revision = item.revision;
        entry.context_sha256 = item.sha256;
      } else {
        entry.diff_revision = item.revision;
        entry.diff_sha256 = item.sha256;
      }
      pins.set(`${parsed.baseSha}..${parsed.headSha}`, entry);
    }
    return [...pins.values()].sort((a, b) => (a.base_sha === b.base_sha
      ? a.head_sha.localeCompare(b.head_sha)
      : a.base_sha.localeCompare(b.base_sha)));
  });
}

/** The exact retained pinned bytes for one selected pin. */
type RestoredPinnedEvidence = {
  pin: RetainedListing;
  contextBytes: Uint8Array;
  diffBytes: Uint8Array;
};

/** Read the exact retained pinned bytes; never refetches and never falls back locally. */
async function readPinnedEvidence(input: {
  cwd: string;
  binding: PinBinding;
  owner: string;
  repo: string;
  number: number;
  headSha?: string;
}): Promise<RestoredPinnedEvidence> {
  const { context, scope } = input.binding;
  const pins = await listPinnedEvidence(input);
  const selected = input.headSha
    ? pins.filter((pin) => pin.head_sha === input.headSha)
    : pins;
  if (selected.length === 0) {
    die(`no retained pinned evidence for ${pinPrefix(input.owner, input.repo, input.number)}${input.headSha ? ` matching ${input.headSha}` : ""}`);
  }
  if (selected.length > 1) {
    die(`multiple retained pins match; pass --head-sha (${selected.map((pin) => `${pin.base_sha}..${pin.head_sha}`).join(", ")})`);
  }
  const pin = selected[0]!;
  if (!pin.context_revision || !pin.diff_revision) die(`retained pin ${pin.base_sha}..${pin.head_sha} is incomplete`);

  return withBoundStore(input.cwd, context, async (store) => {
    const names = pinNames(input.owner, input.repo, input.number, pin.base_sha, pin.head_sha);
    const contextArtifact = await store.read(consumerKey(scope, PIN_KIND, PIN_SUBJECT, names.context), pin.context_revision);
    const diffArtifact = await store.read(consumerKey(scope, PIN_KIND, PIN_SUBJECT, names.diff), pin.diff_revision);
    if (!contextArtifact || !diffArtifact) die(`retained pin ${pin.base_sha}..${pin.head_sha} could not be read from the configured service`);
    return {
      pin,
      contextBytes: contextArtifact.bytes,
      diffBytes: diffArtifact.bytes,
    };
  });
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

/** Restore/list never call `gh`: the owning checkout's origin names the repo. */
function ownerRepoFromOrigin(): { owner: string; repo: string } {
  let remote: string;
  try {
    remote = execFileSync("git", ["config", "--get", "remote.origin.url"], {
      encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (e: unknown) {
    die(`cannot read the owning checkout origin: ${formatExecError(e)}`);
  }
  const cleaned = remote.replace(/\.git$/, "").replace(/\/+$/, "");
  const segments = cleaned.split(/[/:]/).filter(Boolean);
  const repo = segments[segments.length - 1];
  const owner = segments[segments.length - 2];
  if (!owner || !repo) die(`cannot derive owner/repo from origin '${remote}'`);
  return { owner, repo };
}

function parsePrArgOffline(arg: string): ParsedPr {
  const ref = matchPrRef(arg);
  if (!ref) die(`unrecognized PR argument: ${arg}`);
  if (ref.kind === "num") {
    const { owner, repo } = ownerRepoFromOrigin();
    return { owner, repo, number: ref.number };
  }
  return { owner: ref.owner, repo: ref.repo, number: ref.number };
}

interface Flags {
  positional: string[];
  headSha?: string;
  out?: string;
}

function optionValue(argv: readonly string[], index: number): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) die(`${argv[index]} requires a value`);
  return value;
}

function parseFlags(argv: readonly string[]): Flags {
  const flags: Flags = { positional: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (token === "--help" || token === "-h") return { positional: ["--help"] };
    if (token === "--head-sha" || token === "--out") {
      const value = optionValue(argv, index++);
      if (token === "--head-sha") flags.headSha = value;
      else flags.out = value;
    } else {
      if (token.startsWith("-")) die(`unrecognized option: ${token}`);
      flags.positional.push(token);
    }
  }
  return flags;
}

const USAGE = [
  "usage: pr-context <pr-url|owner/repo#N|#N|N>",
  "       pr-context --restore <pr-url|owner/repo#N|#N|N> [--head-sha <sha>] [--out <dir>]",
  "       pr-context --list <pr-url|owner/repo#N|#N|N>",
].join("\n");

// ---------- capture ----------

async function capture(arg: string): Promise<void> {
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

  // 4. Compute worktree path from the owning checkout (never the review worktree).
  const repoRoot = owningCheckout();
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
    }
    // A removed export directory leaves a stale registration behind.
    execGit(["worktree", "prune"]);
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

  // Capture raw diff bytes; source files may contain non-UTF-8 text.
  const diffBytes = execFileSync("git", ["-C", worktreePath, "diff", `${pr.baseRefOid}..${pr.headRefOid}`], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  // 8. Per-file detail from gh
  const filesRaw = execGh([
    "pr", "view", String(pr.number), "--repo", `${parsed.owner}/${parsed.repo}`,
    "--json", "files", "--jq", ".files",
  ]);
  const changedFiles = parseJson(filesRaw, isChangedFileArray, "gh pr view files");

  // 9. Build the context blob and the exact diff bytes
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
  const contextBytes = new TextEncoder().encode(JSON.stringify(context, null, 2));

  // 10. Retain the pinned evidence on the configured run-private adapter.
  const names = pinNames(parsed.owner, parsed.repo, pr.number, pr.baseRefOid, pr.headRefOid);
  let retained: RetainedPin;
  let binding: PinBinding;
  try {
    binding = await boundScope(repoRoot);
    retained = await retainPinnedEvidence({ cwd: repoRoot, binding, names, contextBytes, diffBytes });
  } catch (e: unknown) {
    die(`retaining pinned evidence on the configured service failed: ${formatExecError(e)}`);
  }

  // Export the retained bytes, including when this pin already existed.
  await withBoundStore(repoRoot, binding.context, async (store) => {
    const pinnedContext = await store.read(consumerKey(binding.scope, PIN_KIND, PIN_SUBJECT, names.context), retained.context_revision);
    const pinnedDiff = await store.read(consumerKey(binding.scope, PIN_KIND, PIN_SUBJECT, names.diff), retained.diff_revision);
    if (!pinnedContext || !pinnedDiff) die("retained pinned evidence could not be exported");
    writeFileSync(join(worktreePath, "pr-context.json"), pinnedContext.bytes);
    writeFileSync(join(worktreePath, "pr.diff"), pinnedDiff.bytes);
  });

  // 12. Tight stdout summary — the LLM `jq`s pr-context.json for details
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
    retained: {
      subject_id: PIN_SUBJECT,
      kind: PIN_KIND,
      context_logical_name: names.context,
      diff_logical_name: names.diff,
      ...retained,
    },
  };
  console.log(JSON.stringify(tight, null, 2));
}

// ---------- restore / list ----------

async function restore(argv: readonly string[]): Promise<void> {
  execGit(["rev-parse", "--is-inside-work-tree"]);
  const flags = parseFlags(argv);
  const arg = flags.positional[0];
  if (!arg) die(`--restore requires a PR argument\n${USAGE}`);
  const parsed = parsePrArgOffline(arg);
  const repoRoot = owningCheckout();

  let restored: RestoredPinnedEvidence;
  try {
    restored = await readPinnedEvidence({
      cwd: repoRoot, binding: await boundScope(repoRoot), owner: parsed.owner, repo: parsed.repo, number: parsed.number,
      ...(flags.headSha ? { headSha: flags.headSha } : {}),
    });
  } catch (e: unknown) {
    // No local fallback: a service outage must not silently refetch or reuse exports.
    die(`reading retained pinned evidence from the configured service failed: ${formatExecError(e)}`);
  }

  const outDir = flags.out ?? join(repoRoot, ".worktrees", `pr-${parsed.number}`);
  mkdirSync(outDir, { recursive: true });
  const contextPath = join(outDir, "pr-context.json");
  const diffPath = join(outDir, "pr.diff");
  writeFileSync(contextPath, restored.contextBytes);
  writeFileSync(diffPath, restored.diffBytes);

  const summary = {
    pr_number: parsed.number,
    owner: parsed.owner,
    repo: parsed.repo,
    base_sha: restored.pin.base_sha,
    head_sha: restored.pin.head_sha,
    restored_from: "configured-adapter",
    context_revision: restored.pin.context_revision,
    diff_revision: restored.pin.diff_revision,
    context_sha256: restored.pin.context_sha256,
    diff_sha256: restored.pin.diff_sha256,
    context_path: contextPath,
    diff_path: diffPath,
  };
  console.log(JSON.stringify(summary, null, 2));
}

async function list(argv: readonly string[]): Promise<void> {
  execGit(["rev-parse", "--is-inside-work-tree"]);
  const flags = parseFlags(argv);
  const arg = flags.positional[0];
  if (!arg) die(`--list requires a PR argument\n${USAGE}`);
  const parsed = parsePrArgOffline(arg);
  const repoRoot = owningCheckout();
  let pins: RetainedListing[];
  try {
    pins = await listPinnedEvidence({ cwd: repoRoot, binding: await boundScope(repoRoot), owner: parsed.owner, repo: parsed.repo, number: parsed.number });
  } catch (e: unknown) {
    die(`listing retained pinned evidence from the configured service failed: ${formatExecError(e)}`);
  }
  console.log(JSON.stringify({
    pr_number: parsed.number,
    owner: parsed.owner,
    repo: parsed.repo,
    listed_from: "configured-adapter",
    pins,
  }, null, 2));
}

// ---------- main ----------

async function main(argv: readonly string[]): Promise<void> {
  const mode = argv[0];
  if (mode === "--restore") return restore(argv.slice(1));
  if (mode === "--list") return list(argv.slice(1));
  const flags = parseFlags(argv);
  if (flags.positional.length === 1 && flags.positional[0] === "--help") {
    console.error(USAGE);
    process.exit(0);
  }
  if (flags.positional.length !== 1) {
    console.error(USAGE);
    process.exit(flags.positional.length === 0 ? 2 : 1);
  }
  await capture(flags.positional[0]!);
}

if (import.meta.main) {
  await main(process.argv.slice(2));
}