#!/usr/bin/env bun
/**
 * Deterministic fix-pr ingest. Shells out to `gh`, writes an inventory file,
 * and prints a one-line summary. No jq, no extension, no model call.
 *
 * Usage: fetch-feedback.ts <owner/repo> <pr-number> [--seen-ids-file <path>]
 */
import { spawn } from "node:child_process";
import { accessSync, chmodSync, constants, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const THREAD_QUERY =
  "query($owner:String!,$name:String!,$number:Int!,$after:String){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100,after:$after){pageInfo{hasNextPage endCursor}nodes{id isResolved path line comments(first:100){pageInfo{hasNextPage endCursor}nodes{databaseId url body author{login} createdAt commit{oid}}}}}}}}";

const COMMENT_QUERY =
  "query($id:ID!,$after:String!){node(id:$id){... on PullRequestReviewThread{comments(first:100,after:$after){pageInfo{hasNextPage endCursor}nodes{databaseId url body author{login} createdAt commit{oid}}}}}}";

const JOB_LINK = /^https:\/\/github\.com\/[^/]+\/[^/]+\/actions\/runs\/([0-9]+)\/job\/([0-9]+)\/?$/;
const ANSI = /\u001b\[[0-9;]*m/g;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z /;
const KEEP_SUBSTRINGS = [
  "FAIL ",
  "Failed Tests",
  "AssertionError",
  "Error:",
  "##[error]",
  "❯ ",
  "Test Files",
  "Tests ",
  "Serialized Error",
];
const DROP_LOG = "##[error]Process completed with exit code 1.";
const DROP_ANN = "Process completed with exit code 1.";
const KNOWN_BUCKETS: Record<string, true> = {
  fail: true,
  cancel: true,
  pending: true,
  pass: true,
  skipping: true,
};
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SIGNAL_CAP = 40;
const MAX_GH_BYTES = 64 * 1024 * 1024;

type GhResult = { status: number; stdout: string };

type GqlComment = {
  url?: unknown;
  body?: unknown;
  author?: { login?: unknown } | null;
  createdAt?: unknown;
  commit?: { oid?: unknown } | null;
};

type GqlThread = {
  id: string;
  isResolved: boolean;
  path: string;
  line: string;
  comments: GqlComment[];
};

type Item = {
  source: string;
  id: string;
  url: string;
  commit: string;
  path: string;
  line: string;
  pathLine: string;
  author: string;
  claim: string;
  submittedAt: string;
  threadId: string;
  threadResolved: boolean | null;
  mechanical: string;
  seen: boolean;
  logStatus?: string;
  signals?: string[];
  duplicateOf?: string;
};

let phase = "starting";
let phaseStarted = Date.now();
let spinnerIdx = 0;
let inflight = 0;
let heartbeat: NodeJS.Timeout | null = null;

function stopHeartbeat(): void {
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

function note(message: string): void {
  phase = message;
  phaseStarted = Date.now();
  const frame = SPINNER[spinnerIdx % SPINNER.length]!;
  spinnerIdx++;
  process.stderr.write(`fix-pr ${frame} ${message}\n`);
}

function die(code: number, message: string): never {
  stopHeartbeat();
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function commandExists(name: string): boolean {
  const pathEnv = process.env.PATH ?? "";
  for (const dir of pathEnv.split(":")) {
    if (dir && existsSync(join(dir, name))) return true;
  }
  return false;
}

function ensureHeartbeat(): void {
  if (heartbeat) return;
  heartbeat = setInterval(() => {
    const secs = Math.max(1, Math.round((Date.now() - phaseStarted) / 1000));
    const frame = SPINNER[spinnerIdx % SPINNER.length]!;
    spinnerIdx++;
    process.stderr.write(`fix-pr ${frame} still working — ${phase} (${secs}s)\n`);
  }, 2000);
  heartbeat.unref();
}

function runGh(args: string[], label: string): Promise<GhResult> {
  note(label);
  inflight++;
  ensureHeartbeat();
  return new Promise((resolve) => {
    const child = spawn("gh", args, { env: process.env });
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (status: number, stdout: string): void => {
      if (settled) return;
      settled = true;
      inflight = Math.max(0, inflight - 1);
      if (inflight === 0) stopHeartbeat();
      resolve({ status, stdout });
    };
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_GH_BYTES) {
        child.kill();
        return;
      }
      chunks.push(chunk);
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") die(3, "error: gh not found");
      die(4, "error: pr metadata incomplete");
    });
    child.on("close", (status) => {
      finish(status ?? 1, Buffer.concat(chunks).toString("utf8"));
    });
  });
}

function consumeJsonString(src: string, start: number): number {
  let escape = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i]!;
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (c === '"') return i;
  }
  throw new Error("unterminated json");
}

function jsonValueEnd(src: string, start: number): number {
  const open = src[start];
  if (open !== "{" && open !== "[") throw new Error("not a json value");
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i]!;
    if (c === '"') {
      i = consumeJsonString(src, i + 1);
      continue;
    }
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  throw new Error("unterminated json");
}

function parseJsonStream(text: string): unknown[] {
  const src = text.trim();
  if (!src) throw new Error("empty");
  const values: unknown[] = [];
  let i = 0;
  while (i < src.length) {
    while (i < src.length && /\s/.test(src[i]!)) i++;
    if (i >= src.length) break;
    const end = jsonValueEnd(src, i);
    values.push(JSON.parse(src.slice(i, end)));
    i = end;
  }
  if (values.length === 0) throw new Error("empty");
  return values;
}

async function fetchPages(endpoint: string, label: string): Promise<unknown[]> {
  const run = await runGh(["api", "--paginate", endpoint], label);
  if (run.status !== 0) die(4, "error: pr metadata incomplete");
  let pages: unknown[];
  try {
    pages = parseJsonStream(run.stdout);
  } catch {
    die(4, "error: pr metadata incomplete");
  }
  const items: unknown[] = [];
  for (const page of pages) {
    if (!Array.isArray(page)) die(4, "error: pr metadata incomplete");
    items.push(...page);
  }
  note(`${label}: ${items.length}`);
  return items;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function strOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function collapse(body: unknown): string {
  if (typeof body !== "string") return "";
  return body.replace(/[\t\r\n]+/g, " ");
}

function decimalId(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.length > 0) return value;
  return "";
}

function loginOf(user: unknown): string {
  const record = asRecord(user);
  if (!record) return "";
  return typeof record.login === "string" ? record.login : "";
}

function pathLineOf(path: string, line: string): string {
  if (path && line) return `${path}:${line}`;
  if (path) return path;
  return "";
}

function numericLine(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function requirePageInfo(pageInfo: unknown): { hasNextPage: boolean; endCursor: string | null } {
  const record = asRecord(pageInfo);
  if (!record) die(5, "error: reviewThreads fetch failed");
  const hasNext = record.hasNextPage;
  if (hasNext !== true && hasNext !== false) die(5, "error: reviewThreads fetch failed");
  const endCursor = record.endCursor;
  if (hasNext === true && (typeof endCursor !== "string" || endCursor.length === 0)) {
    die(5, "error: reviewThreads fetch failed");
  }
  return { hasNextPage: hasNext, endCursor: typeof endCursor === "string" ? endCursor : null };
}

async function ghGraphql(flagArgs: string[], label: string): Promise<Record<string, unknown>> {
  const run = await runGh(["api", "graphql", ...flagArgs], label);
  if (run.status !== 0) die(5, "error: reviewThreads fetch failed");
  let body: unknown;
  try {
    body = JSON.parse(run.stdout);
  } catch {
    die(5, "error: reviewThreads fetch failed");
  }
  const record = asRecord(body);
  if (!record) die(5, "error: reviewThreads fetch failed");
  if (Array.isArray(record.errors)) die(5, "error: reviewThreads fetch failed");
  return record;
}

function readComments(comments: unknown): { nodes: GqlComment[]; hasNextPage: boolean; endCursor: string | null } {
  const record = asRecord(comments);
  if (!record) die(5, "error: reviewThreads fetch failed");
  const page = requirePageInfo(record.pageInfo);
  if (!Array.isArray(record.nodes)) die(5, "error: reviewThreads fetch failed");
  const nodes: GqlComment[] = [];
  for (const node of record.nodes) {
    const comment = asRecord(node);
    if (!comment) die(5, "error: reviewThreads fetch failed");
    nodes.push(comment as GqlComment);
  }
  return { nodes, hasNextPage: page.hasNextPage, endCursor: page.endCursor };
}

async function paginateComments(threadId: string, path: string, comments: unknown): Promise<GqlComment[]> {
  const first = readComments(comments);
  const nodes = [...first.nodes];
  let more = first.hasNextPage;
  let commentAfter = first.endCursor;
  while (more) {
    if (!commentAfter) die(5, "error: reviewThreads fetch failed");
    const follow = await ghGraphql(
      ["-f", `query=${COMMENT_QUERY}`, "-f", `id=${threadId}`, "-f", `after=${commentAfter}`],
      `walking comments on ${path || threadId}`,
    );
    const followData = asRecord(follow.data);
    const followNode = asRecord(followData?.node);
    if (!followNode || followNode.comments === undefined || followNode.comments === null) {
      die(5, "error: reviewThreads fetch failed");
    }
    const next = readComments(followNode.comments);
    nodes.push(...next.nodes);
    more = next.hasNextPage;
    commentAfter = next.endCursor;
  }
  return nodes;
}

async function threadFromNode(node: unknown): Promise<GqlThread> {
  const thread = asRecord(node);
  if (!thread || typeof thread.id !== "string" || thread.id.length === 0) {
    die(5, "error: reviewThreads fetch failed");
  }
  if (typeof thread.isResolved !== "boolean") die(5, "error: reviewThreads fetch failed");
  const path = typeof thread.path === "string" ? thread.path : "";
  return {
    id: thread.id,
    isResolved: thread.isResolved,
    path,
    line: numericLine(thread.line),
    comments: await paginateComments(thread.id, path, thread.comments),
  };
}

function acceptThreadPage(body: Record<string, unknown>, pageNumber: number): { nodes: unknown[]; hasNextPage: boolean; endCursor: string | null } {
  const data = asRecord(body.data);
  const repository = data ? asRecord(data.repository) : null;
  const pullRequest = repository ? asRecord(repository.pullRequest) : null;
  const reviewThreads = pullRequest ? asRecord(pullRequest.reviewThreads) : null;
  if (!reviewThreads || !Array.isArray(reviewThreads.nodes)) die(5, "error: reviewThreads fetch failed");
  const page = requirePageInfo(reviewThreads.pageInfo);
  const suffix = page.hasNextPage ? ", more pages" : "";
  note(`review threads page ${pageNumber}: ${reviewThreads.nodes.length}${suffix}`);
  return { nodes: reviewThreads.nodes, hasNextPage: page.hasNextPage, endCursor: page.endCursor };
}

async function fetchAllThreads(owner: string, name: string, pr: string): Promise<GqlThread[]> {
  const threads: GqlThread[] = [];
  let after: string | undefined;
  let pageNumber = 0;
  for (;;) {
    pageNumber++;
    const args = ["-f", `query=${THREAD_QUERY}`, "-f", `owner=${owner}`, "-f", `name=${name}`, "-F", `number=${pr}`];
    if (after !== undefined) args.push("-f", `after=${after}`);
    const body = await ghGraphql(args, `walking review threads page ${pageNumber}`);
    const page = acceptThreadPage(body, pageNumber);
    for (const node of page.nodes) threads.push(await threadFromNode(node));
    if (!page.hasNextPage) break;
    if (!page.endCursor) die(5, "error: reviewThreads fetch failed");
    after = page.endCursor;
  }
  note(`review threads: ${threads.length}`);
  return threads;
}

function reviewCommit(obj: Record<string, unknown>): string {
  if (typeof obj.commit_id === "string" && obj.commit_id.length > 0) return obj.commit_id;
  const body = typeof obj.body === "string" ? obj.body : "";
  const match = /Commit:\s*([0-9a-f]{7,40})/i.exec(body);
  return match?.[1] ?? "";
}

function inlineLine(obj: Record<string, unknown>): string {
  const line = numericLine(obj.line);
  if (line) return line;
  return numericLine(obj.original_line);
}

function blankItem(source: string, id: string): Item {
  return {
    source,
    id,
    url: "",
    commit: "",
    path: "",
    line: "",
    pathLine: "",
    author: "",
    claim: "",
    submittedAt: "",
    threadId: "",
    threadResolved: null,
    mechanical: "needs_judgment",
    seen: false,
  };
}

function extractLogSignals(log: string): string[] {
  const kept: string[] = [];
  for (const raw of log.split("\n")) {
    const rawLine = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    const tab1 = rawLine.indexOf("\t");
    const tab2 = tab1 === -1 ? -1 : rawLine.indexOf("\t", tab1 + 1);
    let rest = tab2 === -1 ? rawLine : rawLine.slice(tab2 + 1);
    rest = rest.replace(TIMESTAMP, "").replace(ANSI, "");
    if (!KEEP_SUBSTRINGS.some((needle) => rest.includes(needle))) continue;
    if (rest === DROP_LOG) continue;
    kept.push(rest.slice(0, 500));
    if (kept.length >= SIGNAL_CAP) break;
  }
  return kept;
}

function annotationSignals(body: unknown): string[] | null {
  if (!Array.isArray(body)) return null;
  const signals: string[] = [];
  for (const ann of body) {
    const record = asRecord(ann);
    if (!record) continue;
    if (record.annotation_level !== "failure") continue;
    if (record.message === DROP_ANN) continue;
    const path = typeof record.path === "string" ? record.path : "";
    const message = typeof record.message === "string" ? record.message : "";
    if (record.start_line === null || record.start_line === undefined) signals.push(`${path}: ${message}`);
    else signals.push(`${path}:${String(record.start_line)}: ${message}`);
  }
  return signals;
}

function ciClaim(name: string, signals: string[]): string {
  const claim = signals.length === 0 ? name : `${name} | ${signals.join(" | ")}`;
  return claim.slice(0, 4000);
}

function compareItems(a: Item, b: Item): number {
  if (a.submittedAt === "" && b.submittedAt !== "") return 1;
  if (a.submittedAt !== "" && b.submittedAt === "") return -1;
  if (a.submittedAt < b.submittedAt) return -1;
  if (a.submittedAt > b.submittedAt) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

function emitItem(item: Item): Record<string, unknown> {
  const out: Record<string, unknown> = {
    source: item.source,
    id: item.id,
    url: item.url,
    commit: item.commit,
    path: item.path,
    line: item.line,
    pathLine: item.pathLine,
    author: item.author,
    claim: item.claim,
    submittedAt: item.submittedAt,
    threadId: item.threadId,
    threadResolved: item.threadResolved,
    mechanical: item.mechanical,
    seen: item.seen,
  };
  if (item.source === "ci") {
    out.logStatus = item.logStatus;
    out.signals = item.signals ?? [];
  }
  if (item.mechanical === "duplicate_id") out.duplicateOf = item.duplicateOf ?? "";
  return out;
}

function requireOwnerRepo(repo: string): { owner: string; name: string } {
  const slash = repo.indexOf("/");
  const oneSlash = slash > 0 && slash === repo.lastIndexOf("/") && slash < repo.length - 1;
  if (!oneSlash) die(2, "error: invalid arguments");
  return { owner: repo.slice(0, slash), name: repo.slice(slash + 1) };
}

function takeSeenFile(argv: string[], index: number, current: string | undefined): { seenFile: string; next: number } {
  if (current !== undefined) die(2, "error: invalid arguments");
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) die(2, "error: invalid arguments");
  return { seenFile: value, next: index + 2 };
}

function parseArgs(argv: string[]): { repo: string; owner: string; name: string; pr: string; seenFile?: string } {
  let seenFile: string | undefined;
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--seen-ids-file") {
      const taken = takeSeenFile(argv, i, seenFile);
      seenFile = taken.seenFile;
      i = taken.next - 1;
      continue;
    }
    if (arg.startsWith("-")) die(2, "error: invalid arguments");
    positionals.push(arg);
  }
  if (positionals.length !== 2 || !/^[1-9][0-9]*$/.test(positionals[1]!)) die(2, "error: invalid arguments");
  const repo = positionals[0]!;
  return { repo, ...requireOwnerRepo(repo), pr: positionals[1]!, seenFile };
}

function loadSeenIds(path: string | undefined): Set<string> {
  if (path === undefined) return new Set();
  try {
    accessSync(path, constants.R_OK);
    const text = readFileSync(path, "utf8");
    return new Set(text.split(/\r?\n/).filter((line) => line.length > 0));
  } catch {
    die(2, "error: seen-ids file unreadable");
  }
}

async function loadChecks(repo: string, pr: string): Promise<unknown[]> {
  const checksRun = await runGh(
    ["pr", "checks", pr, "--repo", repo, "--json", "name,state,bucket,link,workflow,completedAt,description"],
    "fetching checks",
  );
  const accepted = checksRun.status === 0 || checksRun.status === 1 || checksRun.status === 8;
  if (!accepted) die(4, "error: pr metadata incomplete");
  let checksRaw: unknown;
  try {
    checksRaw = JSON.parse(checksRun.stdout);
  } catch {
    die(4, "error: pr metadata incomplete");
  }
  if (!Array.isArray(checksRaw)) die(4, "error: pr metadata incomplete");
  for (const row of checksRaw) {
    const bucket = asRecord(row)?.bucket;
    if (typeof bucket !== "string" || !KNOWN_BUCKETS[bucket]) die(4, "error: pr metadata incomplete");
  }
  note(`checks loaded: ${checksRaw.length}`);
  return checksRaw;
}

function attachThread(item: Item, threads: GqlThread[], joined: Set<string>): void {
  if (!item.path || !item.line) return;
  const matches = threads.filter((thread) => thread.path === item.path && thread.line === item.line);
  if (matches.length !== 1) return;
  const thread = matches[0]!;
  item.threadId = thread.id;
  item.threadResolved = thread.isResolved;
  joined.add(thread.id);
}

function appendFeedbackItems(
  reviews: unknown[],
  inlineComments: unknown[],
  conversation: unknown[],
  threads: GqlThread[],
): Item[] {
  const items: Item[] = [];
  const joinedThreadIds = new Set<string>();
  for (const raw of reviews) {
    const review = asRecord(raw);
    if (!review) continue;
    const item = blankItem("review", decimalId(review.id));
    item.url = strOrEmpty(review.html_url);
    item.commit = reviewCommit(review);
    item.author = loginOf(review.user);
    item.claim = collapse(review.body);
    item.submittedAt = strOrEmpty(review.submitted_at);
    items.push(item);
  }
  for (const raw of inlineComments) {
    const comment = asRecord(raw);
    if (!comment) continue;
    const item = blankItem("inline", decimalId(comment.id));
    item.url = strOrEmpty(comment.html_url);
    item.commit = typeof comment.commit_id === "string" ? comment.commit_id : "";
    item.path = strOrEmpty(comment.path);
    item.line = inlineLine(comment);
    item.pathLine = pathLineOf(item.path, item.line);
    item.author = loginOf(comment.user);
    item.claim = collapse(comment.body);
    item.submittedAt = strOrEmpty(comment.created_at);
    attachThread(item, threads, joinedThreadIds);
    items.push(item);
  }
  for (const raw of conversation) {
    const comment = asRecord(raw);
    if (!comment) continue;
    const item = blankItem("conversation", decimalId(comment.id));
    item.url = strOrEmpty(comment.html_url);
    item.author = loginOf(comment.user);
    item.claim = collapse(comment.body);
    item.submittedAt = strOrEmpty(comment.created_at);
    items.push(item);
  }
  for (const thread of threads) {
    if (joinedThreadIds.has(thread.id)) continue;
    const first = thread.comments[0];
    const item = blankItem("thread", thread.id);
    item.url = strOrEmpty(first?.url);
    const commit = asRecord(first?.commit);
    item.commit = strOrEmpty(commit?.oid);
    item.path = thread.path;
    item.line = thread.line;
    item.pathLine = pathLineOf(item.path, item.line);
    item.author = loginOf(first?.author);
    item.claim = collapse(first?.body);
    item.submittedAt = strOrEmpty(first?.createdAt);
    item.threadId = thread.id;
    item.threadResolved = thread.isResolved;
    items.push(item);
  }
  return items;
}

type PrMeta = {
  title: string;
  state: string;
  url: string;
  headRefName: string;
  headRefOid: string;
  headRepositoryName: string;
  isCrossRepository: boolean;
  baseRefName: string;
  baseRefOid: string;
};

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) die(4, "error: pr metadata incomplete");
  return value;
}

function crossFlag(meta: Record<string, unknown>): boolean {
  if (!("isCrossRepository" in meta)) return false;
  if (typeof meta.isCrossRepository !== "boolean") die(4, "error: pr metadata incomplete");
  return meta.isCrossRepository;
}

async function loadMetadata(repo: string, pr: string): Promise<PrMeta> {
  const metaRun = await runGh(
    [
      "pr", "view", pr, "--repo", repo, "--json",
      "number,title,state,url,headRefName,headRefOid,headRepository,headRepositoryOwner,isCrossRepository,baseRefName,baseRefOid",
    ],
    `fetching PR #${pr} metadata`,
  );
  if (metaRun.status !== 0) die(4, "error: pr metadata incomplete");
  let metaRaw: unknown;
  try {
    metaRaw = JSON.parse(metaRun.stdout);
  } catch {
    die(4, "error: pr metadata incomplete");
  }
  const meta = asRecord(metaRaw);
  if (!meta || meta.number !== Number(pr)) die(4, "error: pr metadata incomplete");
  const headRepository = asRecord(meta.headRepository);
  return {
    title: strOrEmpty(meta.title),
    state: strOrEmpty(meta.state),
    url: strOrEmpty(meta.url),
    headRefName: requiredString(meta.headRefName),
    headRefOid: requiredString(meta.headRefOid),
    headRepositoryName: requiredString(headRepository?.nameWithOwner),
    isCrossRepository: crossFlag(meta),
    baseRefName: strOrEmpty(meta.baseRefName),
    baseRefOid: strOrEmpty(meta.baseRefOid),
  };
}

function ciWithoutJob(item: Item, checkName: string, state: string, bucket: string, description: unknown): void {
  const text = description == null ? "" : strOrEmpty(description);
  item.logStatus = "no_job_id";
  item.signals = [];
  item.claim = `${checkName}: ${state}: ${text}`;
  note(`check ${bucket}: ${checkName} (no Actions job id) — ${text || state}`);
}

async function readJobEvidence(repo: string, jobId: string, checkName: string): Promise<{ logStatus: string; signals: string[] }> {
  const annRun = await runGh(
    ["api", `repos/${repo}/check-runs/${jobId}/annotations`],
    `fetching annotations for ${checkName} job ${jobId}`,
  );
  let annFailed = annRun.status !== 0;
  let annSignals: string[] = [];
  if (!annFailed) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(annRun.stdout);
    } catch {
      annFailed = true;
    }
    const extracted = annotationSignals(parsed);
    if (extracted === null) annFailed = true;
    else annSignals = extracted;
  } else {
    note(`annotations unavailable for ${checkName}`);
  }
  const logRun = await runGh(
    ["run", "view", "--repo", repo, "--job", jobId, "--log-failed"],
    `fetching failed log for ${checkName} job ${jobId}`,
  );
  if (logRun.status !== 0) {
    const logStatus = annFailed ? "unavailable" : "log_unavailable";
    note(`failed log unavailable for ${checkName} (${logStatus})`);
    return { logStatus, signals: annSignals.slice(0, SIGNAL_CAP) };
  }
  const signals = extractLogSignals(logRun.stdout);
  for (const signal of annSignals) {
    if (signals.length >= SIGNAL_CAP) break;
    if (!signals.includes(signal)) signals.push(signal);
  }
  return { logStatus: "parsed", signals };
}

async function appendCheckItems(items: Item[], checksRaw: unknown[], repo: string, headRefOid: string) {
  const checks = { passed: 0, skipped: 0, failed: 0, pending: [] as Array<{ name: string; state: string; link: string }> };
  for (const raw of checksRaw) {
    const check = asRecord(raw);
    if (!check) continue;
    const bucket = strOrEmpty(check.bucket);
    const checkName = strOrEmpty(check.name);
    const state = strOrEmpty(check.state);
    const link = strOrEmpty(check.link);
    if (bucket === "pass") {
      checks.passed++;
      continue;
    }
    if (bucket === "skipping") {
      checks.skipped++;
      continue;
    }
    if (bucket === "pending") {
      checks.pending.push({ name: checkName, state, link });
      note(`check pending: ${checkName || "(unnamed)"}`);
      continue;
    }
    checks.failed++;
    const jobMatch = JOB_LINK.exec(link);
    const jobId = jobMatch ? jobMatch[2] : "";
    const item = blankItem("ci", jobId ? `job:${jobId}` : `check:${checkName.replaceAll(" ", "-")}`);
    item.url = link;
    item.commit = headRefOid;
    item.submittedAt = strOrEmpty(check.completedAt);
    if (!jobId) ciWithoutJob(item, checkName, state, bucket, check.description);
    else {
      const evidence = await readJobEvidence(repo, jobId, checkName);
      item.logStatus = evidence.logStatus;
      item.signals = evidence.signals;
      item.claim = ciClaim(checkName, evidence.signals);
      const preview = (evidence.signals[0] ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
      const shown = preview ? `: ${preview}` : "";
      note(`check ${bucket}: ${checkName} — ${evidence.signals.length} signals${shown}`);
    }
    items.push(item);
  }
  return checks;
}

function mechanicalClass(item: Item): string {
  if (item.source === "ci") return "needs_judgment";
  if (item.claim.trim() === "") return "empty";
  if (item.threadResolved === true) return "resolved_thread";
  return "needs_judgment";
}

function classifyItems(items: Item[], seenIds: Set<string>): void {
  const seenItemIds = new Set<string>();
  for (const item of items) {
    if (seenItemIds.has(item.id)) {
      item.mechanical = "duplicate_id";
      item.duplicateOf = item.id;
    } else {
      seenItemIds.add(item.id);
      item.mechanical = mechanicalClass(item);
    }
    item.seen = seenIds.has(item.id);
  }
}

function countItems(items: Item[], pendingChecks: number) {
  const counts = {
    needs_judgment: 0,
    resolved_thread: 0,
    duplicate_id: 0,
    empty: 0,
    pending_checks: pendingChecks,
  };
  for (const item of items) {
    if (item.mechanical === "needs_judgment") counts.needs_judgment++;
    else if (item.mechanical === "resolved_thread") counts.resolved_thread++;
    else if (item.mechanical === "duplicate_id") counts.duplicate_id++;
    else if (item.mechanical === "empty") counts.empty++;
  }
  return counts;
}

function inventoryDir(): string {
  const dir = process.env.TMPDIR;
  if (dir && dir.length > 0) return dir;
  return "/tmp";
}

async function main(): Promise<void> {
  const { repo, owner, name, pr, seenFile } = parseArgs(process.argv.slice(2));
  const seenIds = loadSeenIds(seenFile);
  if (!commandExists("gh")) die(3, "error: gh not found");
  note(`starting ingest for ${repo}#${pr}`);

  const meta = await loadMetadata(repo, pr);
  const headRefName = meta.headRefName;
  const headRefOid = meta.headRefOid;
  const headRepositoryName = meta.headRepositoryName;
  const isCrossRepository = meta.isCrossRepository;
  const titleSuffix = meta.title ? ` — ${meta.title}` : "";
  note(`PR #${pr} ${headRepositoryName}:${headRefName}${titleSuffix}`);

  const reviews = await fetchPages(`repos/${repo}/pulls/${pr}/reviews`, "fetching reviews");
  const inlineComments = await fetchPages(`repos/${repo}/pulls/${pr}/comments`, "fetching inline comments");
  const conversation = await fetchPages(`repos/${repo}/issues/${pr}/comments`, "fetching conversation comments");

  const checksRaw = await loadChecks(repo, pr);

  const threads = await fetchAllThreads(owner, name, pr);
  const items = appendFeedbackItems(reviews, inlineComments, conversation, threads);

  const checks = await appendCheckItems(items, checksRaw, repo, headRefOid);

  items.sort(compareItems);
  classifyItems(items, seenIds);
  const counts = countItems(items, checks.pending.length);

  const inventory = {
    ok: true,
    repo,
    number: Number(pr),
    title: strOrEmpty(meta.title),
    state: strOrEmpty(meta.state),
    url: strOrEmpty(meta.url),
    headRefName,
    headRefOid,
    headRepository: headRepositoryName,
    isCrossRepository,
    baseRefName: strOrEmpty(meta.baseRefName),
    baseRefOid: strOrEmpty(meta.baseRefOid),
    checks,
    items: items.map(emitItem),
  };

  const inventoryDirectory = mkdtempSync(join(inventoryDir(), `fix-pr-${owner}-${name}-${pr}-`));
  chmodSync(inventoryDirectory, 0o700);
  const inventoryPath = join(inventoryDirectory, "inventory.json");
  try {
    writeFileSync(inventoryPath, JSON.stringify(inventory));
    chmodSync(inventoryPath, 0o600);
  } catch {
    die(4, "error: pr metadata incomplete");
  }

  const summary = {
    ok: true,
    inventoryPath,
    repo,
    number: Number(pr),
    headRefName,
    headRefOid,
    headRepository: headRepositoryName,
    isCrossRepository,
    baseRefName: strOrEmpty(meta.baseRefName),
    baseRefOid: strOrEmpty(meta.baseRefOid),
    state: strOrEmpty(meta.state),
    url: strOrEmpty(meta.url),
    counts,
    candidates: items
      .filter((item) => item.mechanical === "needs_judgment" && item.seen === false)
      .map((item) => ({
        id: item.id,
        source: item.source,
        pathLine: item.pathLine,
        mechanical: item.mechanical,
        seen: item.seen,
        claim: item.claim.slice(0, 200),
      })),
  };
  stopHeartbeat();
  const pendingNames = checks.pending.map((pending) => pending.name).filter((pendingName) => pendingName.length > 0);
  note(
    `done — ${items.length} items, ${summary.candidates.length} to validate` +
      (pendingNames.length > 0 ? `, pending: ${pendingNames.join(", ")}` : "") +
      ` — inventory ${inventoryPath}`,
  );
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  die(4, message.startsWith("error:") ? message : `error: ${message}`);
});
