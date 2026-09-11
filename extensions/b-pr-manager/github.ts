import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import {
  SCHEMA_VERSION,
  type FeedbackKind,
  type FeedbackVersion,
  type GithubPrState,
  type MergeGateSnapshot,
  type MergeMethod,
  type ResolvedPr,
  type RequiredCheck,
} from "./types.js";

const execFile = promisify(execFileCallback);
const SUCCESS_CONCLUSIONS = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);

export type GhRunner = (args: readonly string[]) => Promise<string>;
export interface RepositoryMergeCapabilities { squash: boolean; rebase: boolean; merge: boolean; }
export interface MergedState { merged: true; mergeCommitOid: string; }

export class PrResolutionError extends Error {
  readonly code = "ambiguous_pr" as const;
  constructor(readonly target: number | string | undefined, readonly matchCount: number) {
    super(`Could not resolve exactly one pull request; rerun /b-pr-manager ${typeof target === "number" ? target : "<PR>"}.`);
    this.name = "PrResolutionError";
  }
}

export function defaultGhRunner(args: readonly string[]): Promise<string> {
  return execFile("gh", [...args], { encoding: "utf8" }).then(({ stdout }) => stdout);
}

export class GithubInventory {
  constructor(private readonly run: GhRunner = defaultGhRunner) {}

  async resolvePr(target?: number | string): Promise<ResolvedPr> {
    const value = await this.readPr(target);
    const prs = Array.isArray(value) ? value : [value];
    if (prs.length !== 1) throw new PrResolutionError(target, prs.length);
    return toResolvedPr(prs[0]);
  }

  async readFeedback(pr: ResolvedPr): Promise<FeedbackVersion[]> {
    const [reviews, inline, conversation, threads] = await Promise.all([
      this.apiPages(pr, `pulls/${pr.number}/reviews`), this.apiPages(pr, `pulls/${pr.number}/comments`),
      this.apiPages(pr, `issues/${pr.number}/comments`), this.reviewThreads(pr),
    ]);
    return uniqueVersions([...reviews.map(normalizeReview), ...inline.map((item) => normalizeComment(item, "inline_comment")), ...conversation.map((item) => normalizeComment(item, "conversation_comment")), ...threads.map(normalizeThread)]);
  }

  async readMergeGate(pr: ResolvedPr): Promise<MergeGateSnapshot> {
    const raw = await this.readPr(pr.number);
    return toMergeGate(Array.isArray(raw) ? raw[0] : raw);
  }

  async readMergedState(pr: ResolvedPr): Promise<MergedState | null> {
    const gate = await this.readMergeGate(pr);
    return gate.githubState === "MERGED" && gate.mergeCommitOid ? { merged: true, mergeCommitOid: gate.mergeCommitOid } : null;
  }

  async enableAutoMerge(pr: ResolvedPr, method: MergeMethod, expectedHeadOid: string): Promise<boolean> {
    const fresh = await this.resolvePr(pr.number);
    if (fresh.headOid !== expectedHeadOid) return false;
    await this.run(["pr", "merge", String(pr.number), "--auto", `--${method}`]);
    return true;
  }

  private async readPr(target?: number | string): Promise<unknown> {
    const selector = target === undefined ? [] : [String(target)];
    return JSON.parse(await this.run(["pr", "view", ...selector, "--json", PR_FIELDS])) as unknown;
  }

  private async apiPages(pr: ResolvedPr, endpoint: string): Promise<unknown[]> {
    return parsePages(await this.run(["api", "--paginate", `repos/${pr.owner}/${pr.repo}/${endpoint}`]));
  }

  private async reviewThreads(pr: ResolvedPr): Promise<unknown[]> {
    const output = await this.run(["api", "graphql", "-f", `query=${THREADS_QUERY}`, "-F", `owner=${pr.owner}`, "-F", `repo=${pr.repo}`, "-F", `number=${pr.number}`]);
    return threadNodes(JSON.parse(output));
  }
}

export function feedbackDelta(current: readonly FeedbackVersion[], previous: readonly FeedbackVersion[]): FeedbackVersion[] {
  const known = new Set(previous.map((item) => item.fingerprint));
  return uniqueVersions([...current]).filter((item) => !known.has(item.fingerprint)).sort(compareVersions);
}

export function normalizeReview(value: unknown): FeedbackVersion {
  const item = object(value);
  return version(item, "review", String(item.submitted_at ?? item.updated_at ?? item.created_at ?? ""), false, false);
}

export function normalizeComment(value: unknown, kind: "inline_comment" | "conversation_comment"): FeedbackVersion {
  const item = object(value);
  return version(item, kind, String(item.updated_at ?? item.created_at ?? ""), false, kind === "inline_comment" && item.line === null);
}

export function normalizeThread(value: unknown): FeedbackVersion {
  const thread = object(value); const latest = latestThreadComment(thread);
  return version(threadItem(thread, latest), "review_thread", threadUpdatedAt(latest), Boolean(thread.isResolved), Boolean(thread.isOutdated));
}

export function toMergeGate(value: unknown): MergeGateSnapshot {
  const item = object(value);
  return { schemaVersion: SCHEMA_VERSION, headOid: refOid(item, "headRefOid", "headRef"), baseOid: refOid(item, "baseRefOid", "baseRef"), baseRefName: String(item.baseRefName ?? ""), draft: Boolean(item.isDraft ?? item.draft), mergeable: mergeability(item.mergeable), requiredChecks: requiredChecks(item), reviewDecision: reviewDecision(item.reviewDecision), autoMerge: hasAutoMerge(item), githubState: state(item.state), mergeCommitOid: oid(item.mergeCommit) };
}

function latestThreadComment(thread: Record<string, any>): Record<string, any> { const comments = array(thread.comments?.nodes ?? thread.comments); return object(comments[comments.length - 1] ?? {}); }
function threadItem(thread: Record<string, any>, latest: Record<string, any>): Record<string, unknown> { return { ...latest, id: thread.id ?? latest.id, node_id: thread.id ?? latest.node_id, path: thread.path ?? latest.path, line: thread.line ?? latest.line }; }
function threadUpdatedAt(latest: Record<string, any>): string { return String(latest.updatedAt ?? latest.updated_at ?? latest.createdAt ?? ""); }
function refOid(item: Record<string, any>, oidKey: string, refKey: string): string { return String(item[oidKey] ?? object(item[refKey]).oid ?? ""); }
function mergeability(value: unknown): boolean | null { if (value === "MERGEABLE") return true; if (value === "CONFLICTING") return false; return null; }
function reviewDecision(value: unknown): string | null { return typeof value === "string" ? value : null; }
function hasAutoMerge(item: Record<string, any>): boolean { return item.autoMergeRequest !== null && item.autoMergeRequest !== undefined; }

function toResolvedPr(value: unknown): ResolvedPr {
  const item = object(value); const [owner, repo] = repository(item);
  return { number: Number(item.number), url: String(item.url), owner, repo, headRef: String(item.headRefName), baseRef: String(item.baseRefName), headOid: String(item.headRefOid ?? object(item.headRef).oid ?? ""), draft: Boolean(item.isDraft ?? item.draft), state: state(item.state), mergeCapabilities: mergeCapabilities(item) };
}

function version(item: Record<string, unknown>, kind: FeedbackKind, updatedAt: string, resolved: boolean, outdated: boolean): FeedbackVersion {
  const id = String(item.id ?? item.node_id ?? ""); const content = String(item.body ?? item.bodyText ?? ""); const contentDigest = digest(content);
  return { ...versionCore(item, kind, updatedAt, resolved, outdated, id), ...locationFields(item), content, contentDigest, fingerprint: `${id}:${updatedAt}:${contentDigest}` };
}
function versionCore(item: Record<string, unknown>, kind: FeedbackKind, updatedAt: string, resolved: boolean, outdated: boolean, id: string): Omit<FeedbackVersion, "path" | "line" | "originalCommit" | "content" | "contentDigest" | "fingerprint"> { return { schemaVersion: SCHEMA_VERSION, id, nodeId: nodeId(item), kind, author: author(item), url: feedbackUrl(item), createdAt: createdAt(item, updatedAt), updatedAt, resolved, outdated }; }
function nodeId(item: Record<string, unknown>): string { return String(item.node_id ?? item.id ?? ""); }
function feedbackUrl(item: Record<string, unknown>): string { return String(item.html_url ?? item.url ?? ""); }
function createdAt(item: Record<string, unknown>, fallback: string): string { return String(item.created_at ?? item.createdAt ?? fallback); }
function author(item: Record<string, unknown>): string { return String(object(item.user ?? item.author).login ?? object(item.author).login ?? ""); }
function locationFields(item: Record<string, unknown>): Pick<FeedbackVersion, "path" | "line" | "originalCommit"> { const result: Pick<FeedbackVersion, "path" | "line" | "originalCommit"> = {}; addPath(result, item.path); addLine(result, item.line); addOriginalCommit(result, item.original_commit_id); return result; }
function addPath(result: Pick<FeedbackVersion, "path" | "line" | "originalCommit">, value: unknown): void { const path = stringValue(value); if (path) result.path = path; }
function addLine(result: Pick<FeedbackVersion, "path" | "line" | "originalCommit">, value: unknown): void { const line = numberValue(value); if (line !== undefined) result.line = line; }
function addOriginalCommit(result: Pick<FeedbackVersion, "path" | "line" | "originalCommit">, value: unknown): void { const commit = stringValue(value); if (commit) result.originalCommit = commit; }

function requiredChecks(item: Record<string, unknown>): RequiredCheck[] {
  const rollup = array(item.statusCheckRollup);
  return rollup.filter((check) => object(check).isRequired !== false).map((check) => ({ name: String(object(check).name ?? object(check).context ?? ""), status: String(object(check).status ?? ""), conclusion: typeof object(check).conclusion === "string" ? object(check).conclusion : null }));
}

export function checkState(checks: readonly RequiredCheck[]): "pending" | "success" | "failure" {
  if (checks.some((check) => check.status !== "COMPLETED")) return "pending";
  return checks.every((check) => check.conclusion !== null && SUCCESS_CONCLUSIONS.has(check.conclusion)) ? "success" : "failure";
}

function uniqueVersions(items: FeedbackVersion[]): FeedbackVersion[] { return [...new Map(items.map((item) => [item.fingerprint, item])).values()].sort(compareVersions); }
function compareVersions(a: FeedbackVersion, b: FeedbackVersion): number { return a.fingerprint.localeCompare(b.fingerprint); }
function digest(content: string): string { return createHash("sha256").update(content).digest("hex"); }
function object(value: unknown): Record<string, any> { return value !== null && typeof value === "object" ? value as Record<string, any> : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function stringValue(value: unknown): string | undefined { return typeof value === "string" && value ? value : undefined; }
function numberValue(value: unknown): number | undefined { return typeof value === "number" ? value : undefined; }
function oid(value: unknown): string | null { const found = object(value).oid; return typeof found === "string" ? found : null; }
function state(value: unknown): GithubPrState { return value === "MERGED" || value === "CLOSED" ? value : "OPEN"; }
function repository(item: Record<string, any>): [string, string] { const name = String(object(item.repository).nameWithOwner ?? ""); const [owner = "", repo = ""] = name.split("/"); return [owner, repo]; }
function mergeCapabilities(item: Record<string, any>): RepositoryMergeCapabilities { const repo = object(item.repository); return { squash: Boolean(repo.squashMergeAllowed ?? item.squashMergeAllowed), rebase: Boolean(repo.rebaseMergeAllowed ?? item.rebaseMergeAllowed), merge: Boolean(repo.mergeCommitAllowed ?? item.mergeCommitAllowed) }; }
function parsePages(output: string): unknown[] { return output.trim().split(/\n(?=[{[])/).flatMap((page) => { const parsed: unknown = JSON.parse(page); return Array.isArray(parsed) ? parsed : [parsed]; }); }
function threadNodes(value: unknown): unknown[] { return array(object(object(object(object(value).data).repository).pullRequest).reviewThreads?.nodes); }

const PR_FIELDS = "number,url,headRefName,baseRefName,headRefOid,baseRefOid,isDraft,state,mergeable,reviewDecision,autoMergeRequest,mergeCommit,repository,statusCheckRollup";
const THREADS_QUERY = "query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100){nodes{id isResolved isOutdated path line comments(first:100){nodes{id body url createdAt updatedAt author{login}}}}}}}";
