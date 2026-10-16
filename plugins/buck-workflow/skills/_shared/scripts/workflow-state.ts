import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { ArtifactKey, ArtifactKind, ArtifactQuery, ArtifactRevision, RunReceipt, StorageStore } from "../storage/contract.js";
import { loadStorageConfig, type ResolvedStorageConfig } from "../storage/config.js";
import { revisionHash } from "../storage/adapter-utils.js";
import { assertReceiptReadback, discoverStoredContext, lookupKnowledge } from "../storage/domain.js";
import { ExternalFilesStorageStore, RepoFilesStorageStore } from "../storage/file-store.js";
import { createBranchIdentity, createPrivateWorkspaceIdentity, createRunId, createWorktreeId, resolveProjectIdentity, validateArtifactKey } from "../storage/identity.js";
import { PostgresStorageStore } from "../storage/postgres-store.js";
import { SQLiteStorageStore } from "../storage/sqlite-store.js";
import { createLazyPool } from "../storage/db.js";
import type { TextLifecycleIntent } from "./subject-lifecycle.js";
import { readPublicationLedger, recordRewriteMapping, revokeRewriteMapping, resolvePublicationConflict, resolveCommit, staysPrivateAfterMerge } from "../storage/publication.js";
export type WorkflowRole = "read" | "write" | "save" | "admin";
export interface ArtifactRef { subjectId: string; kind: ArtifactKind; logicalName: string; revision?: string }
export interface TrustedWorkflowContext {
  projectId: string;
  branchId: string;
  publishedRevisionIds: readonly string[];
  worktreeId?: string;
  runId?: string;
  selection?: ResolvedStorageConfig;
  manifestRoot?: string;
}
export type WorkflowRequest =
  | { operation: "read"; token?: string; ref?: ArtifactRef }
  | { operation: "list"; subjectId?: string; kind?: ArtifactKind; prefix?: string; limit?: number; cursor?: string }
  | { operation: "search"; text: string; kind?: ArtifactKind; subjectId?: string; limit?: number; cursor?: string }
  | { operation: "write"; ref: ArtifactRef; body?: string; bytesBase64?: string; links?: ArtifactRef[]; expectedRevision?: string | null; author?: string; source?: string }
  | { operation: "correct"; token?: string; ref?: ArtifactRef; predecessorRevision: string; body?: string | null; idempotencyKey: string }
  | { operation: "discover"; kind?: ArtifactKind; prefix?: string }
  | { operation: "inspect-lifecycle"; subjectId: string }
  | { operation: "transition"; subjectId: string; fromRevision: string | null; expectedState: "missing" | "draft" | "active" | "completed"; intent: TextLifecycleIntent; evidence: readonly string[] }
  | { operation: "read-receipt" }
  | { operation: "write-receipt"; attemptId: string; status: RunReceipt["status"]; artifactRevisions: readonly string[]; kind?: RunReceipt["kind"]; metadataDuties?: readonly string[] }
  | { operation: "inspect"; branchRef: string }
  | { operation: "recover"; scopeToken?: string; action?: "export" | "rebind" }
  | { operation: "publication-view" }
  | { operation: "revoke-mapping"; checkpointId: string }
  | { operation: "map-checkpoint"; checkpointId: string; revisionSet: readonly { revision: string; sha256: string }[]; targetCommit: string; evidence: readonly string[] }
  | { operation: "resolve-publication"; revision: string };

const SCOPE_KEYS: Record<string, true> = { selection: true, manifestRoot: true, projectId: true, branchId: true, publishedRevisionIds: true, worktreeId: true, runId: true, project: true, visibility: true, published: true };
const ROLE_OPS: Record<WorkflowRole, readonly WorkflowRequest["operation"][]> = {
  read: ["read", "list", "search", "discover", "inspect-lifecycle", "read-receipt"],
  write: ["read", "list", "search", "discover", "inspect-lifecycle", "read-receipt", "write"],
  save: ["read", "list", "search", "discover", "inspect-lifecycle", "read-receipt", "write", "correct", "transition", "write-receipt"],
  admin: ["read", "list", "search", "discover", "inspect-lifecycle", "read-receipt", "write", "correct", "transition", "write-receipt", "inspect", "recover", "publication-view", "map-checkpoint", "revoke-mapping", "resolve-publication"],
};
export interface GitResult { status: number; stdout: string }
export type GitRunner = (cwd: string, args: string[]) => GitResult;
export interface WorkflowExecuteOptions {
  cwd: string;
  request: WorkflowRequest;
  context: TrustedWorkflowContext;
  role: WorkflowRole;
  origin?: string;
  store?: StorageStore;
  configPath?: string;
  identityPath?: string;
  git?: GitRunner;
}

export function artifactToken(ref: ArtifactRef): string {
  return `workflow-artifact:${Buffer.from(JSON.stringify(ref)).toString("base64url")}`;
}
export function parseArtifactToken(token: string): ArtifactRef {
  const match = /^workflow-artifact:([A-Za-z0-9_-]+)$/.exec(token);
  if (!match) throw new Error("Invalid workflow artifact token");
  const value: unknown = JSON.parse(Buffer.from(match[1]!, "base64url").toString("utf8"));
  rejectCallerScope(value, "token");
  if (!isRef(value)) throw new Error("Invalid workflow artifact token payload");
  return value;
}
export function rejectCallerScope(value: unknown, path = "request"): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectCallerScope(item, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key in SCOPE_KEYS) throw new Error(`callers cannot supply ${key}; workflow context is bound by the runtime`);
    rejectCallerScope(child, `${path}.${key}`);
  }
}

function isRef(value: unknown): value is ArtifactRef {
  if (!value || typeof value !== "object") return false;
  const ref = value as ArtifactRef;
  return typeof ref.subjectId === "string" && typeof ref.kind === "string" && typeof ref.logicalName === "string";
}
function defaultGit(cwd: string, args: string[]): GitResult {
  try {
    return { status: 0, stdout: execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim() };
  } catch (error) {
    const failed = error as { status?: number; stdout?: string | Buffer };
    const stdout = typeof failed.stdout === "string" ? failed.stdout : failed.stdout?.toString("utf8") ?? "";
    return { status: failed.status ?? 1, stdout: stdout.trim() };
  }
}
function identityPath(explicit?: string): string {
  if (explicit) return explicit;
  const base = process.env.XDG_CONFIG_HOME || process.env.BUCK_VITEST_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "buck-workflow", "branch-identity.json");
}
interface BranchRecord { branchId: string; ref: string; incarnation: string; initialTip: string; observedTip: string }
interface AttemptBinding { runId: string; branchId: string; attemptId: string }
interface WorkspaceRecord { nonce: string; worktreeId: string; runId: string; attempts?: AttemptBinding[]; consumerDestinations?: Record<string, string>; privateBranches?: Record<string, { branchId: string; initialTip?: string; observedTip?: string }> }
interface IdentityFile { projects: Record<string, { branches: BranchRecord[]; workspaces?: Record<string, WorkspaceRecord> }> }
function readIdentity(path: string): IdentityFile {
  try { return JSON.parse(readFileSync(path, "utf8")) as IdentityFile; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { projects: {} }; throw error; }
}
function writeIdentity(path: string, file: IdentityFile): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(file));
  renameSync(temporary, path);
}
// Atomic replacement protects crash consistency; this lock protects the whole RMW.
// Abandoned locks fail closed rather than risk stealing a live owner's lock.
async function identityTransaction<T>(path: string, operation: () => T | Promise<T>): Promise<T> {
  mkdirSync(dirname(path), { recursive: true });
  const lock = `${path}.lock`;
  const deadline = Date.now() + 10_000;
  for (;;) {
    try { mkdirSync(lock); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (Date.now() >= deadline) throw new Error("identity lock timeout; concurrent or abandoned writer");
      const { promise, resolve: wake } = Promise.withResolvers<void>();
      setTimeout(wake, 10);
      await promise;
    }
  }
  try { return await operation(); }
  finally { rmSync(lock, { recursive: true }); }
}
async function bindBranch(projectId: string, ref: string, tip: string, cwd: string, path: string, git: GitRunner): Promise<string> {
  const file = await readIdentity(path);
  const project = file.projects[projectId] ?? { branches: [] };
  const matches: BranchRecord[] = [];
  for (const record of project.branches.filter((item) => item.ref === ref)) {
    const status = record.observedTip === tip ? 0 : git(cwd, ["merge-base", "--is-ancestor", record.initialTip, ref]).status;
    if (status === 0) matches.push(record);
    else if (status !== 1) throw new Error("Cannot prove branch continuity; refusing shared scope");
  }
  if (matches.length > 1) throw new Error("Branch identity is ambiguous; refusing shared scope");
  if (matches[0]) {
    if (matches[0].observedTip !== tip) {
      matches[0].observedTip = tip;
      writeIdentity(path, file);
    }
    return matches[0].branchId;
  }
  const created = createBranchIdentity(ref, tip);
  project.branches.push({ ...created, observedTip: tip });
  file.projects[projectId] = project;
  await writeIdentity(path, file);
  return created.branchId;
}
async function bindPrivate(projectId: string, cwd: string, path: string): Promise<TrustedWorkflowContext> {
  const file = await readIdentity(path);
  const project = file.projects[projectId] ?? { branches: [] };
  const workspaces = project.workspaces ?? {};
  const key = resolve(cwd);
  // runId here is only the private-workspace token. Receipt runs live in attempts.
  let existing = workspaces[key];
  if (!existing) {
    existing = { nonce: randomUUID(), worktreeId: createWorktreeId(), runId: createRunId() };
    workspaces[key] = existing;
    project.workspaces = workspaces;
    file.projects[projectId] = project;
    writeIdentity(path, file);
  }
  const workspace = createPrivateWorkspaceIdentity({ projectId, workspaceNonce: existing.nonce, worktreeId: existing.worktreeId, runId: existing.runId });
  return { projectId, branchId: workspace.branchId, worktreeId: workspace.worktreeId, runId: existing.runId, publishedRevisionIds: [] };
}

export class TrustedIdentityError extends Error {
  override name = "TrustedIdentityError";
}

function observeCheckout(cwd: string, git: GitRunner): { common: GitResult; ref: GitResult; head: GitResult } {
  const observed = git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir", "HEAD^{commit}", "--symbolic-full-name", "HEAD"]);
  const lines = observed.stdout.split("\n");
  if (observed.status === 0 && lines.length === 3 && lines[0] && /^[a-f0-9]{40,64}$/iu.test(lines[1]!)) {
    return {
      common: { status: 0, stdout: lines[0] },
      head: { status: 0, stdout: lines[1]! },
      ref: { status: lines[2] === "HEAD" ? 1 : 0, stdout: lines[2]! },
    };
  }
  if (observed.status !== 0 && lines.length === 2 && lines[0] && lines[1] === "HEAD^{commit}") {
    return {
      common: { status: 0, stdout: lines[0] },
      head: { status: observed.status, stdout: lines[1] },
      ref: git(cwd, ["symbolic-ref", "--quiet", "HEAD"]),
    };
  }
  // Unborn/no-Git observations require the individual command statuses.
  return {
    common: git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]),
    ref: git(cwd, ["symbolic-ref", "--quiet", "HEAD"]),
    head: git(cwd, ["rev-parse", "HEAD^{commit}"]),
  };
}

function assertGitObservation(cwd: string, common: GitResult, ref: GitResult, head: GitResult): void {
  if (common.status === 0) {
    if (ref.status !== 0 && head.status !== 0) throw new TrustedIdentityError("Cannot resolve trusted identity from unreadable Git HEAD");
  } else if (existsSync(join(cwd, ".git"))) {
    throw new TrustedIdentityError("Cannot resolve trusted identity from a malformed Git checkout");
  }
}

function bindUnbornBranch(cwd: string, path: string, git: GitRunner, context: TrustedWorkflowContext, ref: string, file: IdentityFile, workspace: WorkspaceRecord): string {
  if (git(cwd, ["show-ref", "--verify", "--quiet", ref]).status !== 1) throw new TrustedIdentityError("Cannot prove unborn branch identity");
  const bindings = workspace.privateBranches ?? {};
  const previous = bindings[ref];
  if (previous && previous.initialTip === undefined) return previous.branchId;
  const privateScope = createPrivateWorkspaceIdentity({ projectId: context.projectId, workspaceNonce: `${workspace.nonce}\0${ref}\0${randomUUID()}`, worktreeId: workspace.worktreeId, runId: workspace.runId });
  bindings[ref] = { branchId: privateScope.branchId };
  workspace.privateBranches = bindings;
  writeIdentity(path, file);
  return privateScope.branchId;
}

async function bindWorkspaceBranch(cwd: string, path: string, git: GitRunner, context: TrustedWorkflowContext, ref: GitResult, head: GitResult): Promise<string> {
  if (ref.status !== 0) return context.branchId;
  const file = readIdentity(path);
  const workspace = loadWorkspace(file, context.projectId, cwd, context.worktreeId!);
  if (head.status !== 0) return bindUnbornBranch(cwd, path, git, context, ref.stdout, file, workspace);
  const privateBranch = workspace.privateBranches?.[ref.stdout];
  if (!privateBranch) return bindBranch(context.projectId, ref.stdout, head.stdout, cwd, path, git);
  if (privateBranch.initialTip === undefined) {
    privateBranch.initialTip = head.stdout;
    privateBranch.observedTip = head.stdout;
    writeIdentity(path, file);
    return privateBranch.branchId;
  }
  const continuity = privateBranch.observedTip === head.stdout ? 0 : git(cwd, ["merge-base", "--is-ancestor", privateBranch.initialTip, head.stdout]).status;
  if (continuity === 0) {
    if (privateBranch.observedTip !== head.stdout) {
      privateBranch.observedTip = head.stdout;
      writeIdentity(path, file);
    }
    return privateBranch.branchId;
  }
  if (continuity !== 1) throw new TrustedIdentityError("Cannot prove private branch continuity");
  delete workspace.privateBranches![ref.stdout];
  writeIdentity(path, file);
  return bindBranch(context.projectId, ref.stdout, head.stdout, cwd, path, git);
}
export async function resolveTrustedContext(cwd: string, options: { origin?: string; identityPath?: string; configPath?: string; git?: GitRunner } = {}): Promise<TrustedWorkflowContext> {
  const git = options.git ?? defaultGit;
  const path = identityPath(options.identityPath);
  const remote = options.origin === undefined ? git(cwd, ["config", "--get", "remote.origin.url"]) : undefined;
  const origin = options.origin ?? (remote?.status === 0 ? remote.stdout : undefined);
  const { common, ref, head } = observeCheckout(cwd, git);
  assertGitObservation(cwd, common, ref, head);
  const config = await loadStorageConfig({ origin, configPath: options.configPath });
  const project = resolveProjectIdentity({ configuredKey: config.projectKey, origin, gitCommonDir: common.status === 0 ? common.stdout : resolve(cwd) });
  return identityTransaction(path, async () => {
    const workspace = await bindPrivate(project.projectId, cwd, path);
    const branchId = await bindWorkspaceBranch(cwd, path, git, workspace, ref, head);
    return { ...workspace, branchId, selection: config, manifestRoot: join(dirname(path), "projects", project.projectId, "repo-manifest") };
  });
}

function requireContext(context: TrustedWorkflowContext): void {
  if (!context.projectId || !context.branchId || !Array.isArray(context.publishedRevisionIds)) throw new Error("Trusted workflow context is incomplete");
}
function denyRole(role: WorkflowRole, operation: WorkflowRequest["operation"]): void {
  if (!ROLE_OPS[role].includes(operation)) throw new Error(`${operation} is not permitted for the ${role} role`);
}
function queryFor(context: TrustedWorkflowContext, values: { subjectId?: string; kind?: ArtifactKind; prefix?: string; limit?: number; cursor?: string }): ArtifactQuery {
  return {
    projectId: context.projectId, branchId: context.branchId, publishedRevisionIds: context.publishedRevisionIds,
    ...(values.subjectId ? { subjectId: values.subjectId } : {}), ...(values.kind ? { kind: values.kind } : {}),
    ...(values.prefix ? { logicalNamePrefix: values.prefix } : {}), ...(values.limit ? { limit: values.limit } : {}), ...(values.cursor ? { cursor: values.cursor } : {}),
  };
}
function bindRef(context: TrustedWorkflowContext, ref: ArtifactRef): ArtifactKey {
  return validateArtifactKey({ projectId: context.projectId, branchId: context.branchId, subjectId: ref.subjectId, kind: ref.kind, logicalName: ref.logicalName });
}
function textOf(bytes: Uint8Array): string | undefined {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return undefined; }
}
function valueScore(text: string | undefined): number | undefined {
  const match = text ? /^value_score:\s*([0-9]+(?:\.[0-9]+)?)\s*$/m.exec(text) : undefined;
  return match && Number.isFinite(Number(match[1])) ? Number(match[1]) : undefined;
}
function view(item: ArtifactRevision, rank?: number): Record<string, unknown> {
  const text = textOf(item.bytes);
  const score = valueScore(text);
  return { token: artifactToken({ subjectId: item.key.subjectId, kind: item.key.kind, logicalName: item.key.logicalName, revision: item.revision }), revision: item.revision, sha256: item.sha256, subjectId: item.key.subjectId, kind: item.key.kind, logicalName: item.key.logicalName, ...(text === undefined ? { bytesBase64: Buffer.from(item.bytes).toString("base64") } : { text }), ...(rank === undefined ? {} : { rank }), ...(score === undefined ? {} : { valueScore: score }) };
}
function refFrom(request: { token?: string; ref?: ArtifactRef }): ArtifactRef {
  if (request.token) return parseArtifactToken(request.token);
  if (request.ref) return request.ref;
  throw new Error("artifact reference is required");
}
function bytesOf(request: { body?: string; bytesBase64?: string }): Uint8Array {
  if (request.body !== undefined) return new TextEncoder().encode(request.body);
  if (request.bytesBase64 !== undefined) return new Uint8Array(Buffer.from(request.bytesBase64, "base64"));
  throw new Error("write requires body or bytesBase64");
}
export async function withConfiguredStore<T>(cwd: string, run: (store: StorageStore, context: TrustedWorkflowContext) => Promise<T>, options: { origin?: string; identityPath?: string; configPath?: string; git?: GitRunner } = {}): Promise<T> {
  const context = await resolveTrustedContext(cwd, options);
  if (!context.selection || !context.manifestRoot) throw new Error("Trusted workflow context is incomplete");
  const opened = await openStore(cwd, context.selection, context.projectId, context.manifestRoot);
  try { return await run(opened.store, await publicationContext(opened.store, cwd, context)); }
  finally { await opened.close(); }
}

/** Internal consumer seam: reopen only the destination already resolved by the caller. */
export async function withBoundStore<T>(cwd: string, context: TrustedWorkflowContext, run: (store: StorageStore, context: TrustedWorkflowContext) => Promise<T>): Promise<T> {
  if (!context.selection || !context.manifestRoot) throw new Error("Trusted workflow context is incomplete");
  const opened = await openStore(cwd, context.selection, context.projectId, context.manifestRoot);
  try { return await run(opened.store, await publicationContext(opened.store, cwd, context)); }
  finally { await opened.close(); }
}

export async function bindConsumerAttempt(context: TrustedWorkflowContext, cwd: string, attemptId: string): Promise<{ worktreeId: string; runId: string }> {
  return bindAttemptRun(context, { operation: "write-receipt", attemptId, status: "attempted", artifactRevisions: [] }, { cwd, context, role: "save", request: { operation: "read-receipt" } });
}

/** A consumer workspace run cannot silently move to a different configured backend. */
export async function resolveConsumerContext(cwd: string): Promise<TrustedWorkflowContext> {
  const path = identityPath();
  const context = await resolveTrustedContext(cwd, { identityPath: path });
  if (!context.worktreeId || !context.selection) throw new Error("Consumer context is not bound");
  const destination = JSON.stringify({ storage: context.selection.storage, manifestRoot: context.manifestRoot });
  await identityTransaction(path, () => {
    const file = readIdentity(path);
    const workspace = loadWorkspace(file, context.projectId, cwd, context.worktreeId!);
    const destinations = workspace.consumerDestinations ?? {};
    const previous = destinations[context.branchId];
    if (previous !== undefined && previous !== destination) throw new Error("Consumer destination changed during the bound workspace run");
    if (previous === destination) return;
    destinations[context.branchId] = destination;
    workspace.consumerDestinations = destinations;
    writeIdentity(path, file);
  });
  return context;
}
async function openStore(cwd: string, selection: ResolvedStorageConfig, projectKey: string, manifestRoot: string): Promise<{ store: StorageStore; close: () => void | Promise<void> }> {
  const storage = selection.storage;
  if (storage.adapter === "repo-files") {
    const contextRoot = join(cwd, ".context");
    // Editable bodies remain Git-portable; immutable authority stays machine-private.
    await mkdir(manifestRoot, { recursive: true });
    return { store: new RepoFilesStorageStore({ contextRoot, manifestRoot }), close: () => {} };
  }
  if (storage.adapter === "external-files") {
    return { store: new ExternalFilesStorageStore({ projectKey: selection.projectKey ?? projectKey, ...(storage.root ? { root: storage.root } : {}) }), close: () => {} };
  }
  if (storage.adapter === "sqlite") {
    if (!storage.database) throw new Error("SQLite storage requires a database path");
    const path = resolve(storage.database);
    await mkdir(dirname(path), { recursive: true });
    // Driver stays inside SQLiteStorageStore.open; this module must not import node:sqlite.
    const store = await SQLiteStorageStore.open(path);
    return { store, close: () => store.close() };
  }
  const envName = storage.connection_env;
  if (!envName) throw new Error("PostgreSQL storage requires connection_env");
  const url = process.env[envName];
  if (!url) throw new Error(`PostgreSQL connection env ${envName} is unset`);
  const pool = createLazyPool(url)();
  const store = new PostgresStorageStore(pool);
  await store.migrate();
  return { store, close: () => pool.end() };
}

async function publicationContext(store: StorageStore, cwd: string, context: TrustedWorkflowContext): Promise<TrustedWorkflowContext> {
  const ref = context.selection?.integrationRef;
  return ref ? { ...context, publishedRevisionIds: await store.reconcile(ref, cwd, context.projectId) } : context;
}

/** Runtime-only checkpoint seam; seals the branch snapshot, never the published overlay. */
export async function sealWorkflowCheckpoint(cwd: string): Promise<string | null> {
  // Publication-disabled commits must not open an adapter or register identities.
  const remote = defaultGit(cwd, ["config", "--get", "remote.origin.url"]);
  const selection = await loadStorageConfig({ origin: remote.status === 0 ? remote.stdout : undefined });
  if (!selection.integrationRef) return null;
  return withConfiguredStore(cwd, async (store, context) => {
    if (!context.selection?.integrationRef || context.branchId.startsWith("private-")) return null;
    await importRepoProjection(store, cwd, context);
    const commit = resolveCommit(cwd, "HEAD");
    const integrationTip = resolveCommit(cwd, context.selection.integrationRef);
    const items = await store.checkpointSnapshot(context.projectId, context.branchId);
    return store.sealCheckpoint({ projectId: context.projectId, branchId: context.branchId, commit, integrationTip, revisionSet: items.map(({ revision, sha256 }) => ({ revision, sha256 })) });
  });
}

export async function bindWorkflowCheckpoint(cwd: string, id: string): Promise<void> {
  await withConfiguredStore(cwd, async (store, context) => {
    const selected = (await store.listCheckpoints(context.projectId)).find(x => x.id === id && x.branchId === context.branchId);
    if (!selected) throw new Error("checkpoint is not in the trusted branch scope");
    const head = resolveCommit(cwd, "HEAD");
    if (selected.boundCommit === head) return;
    await store.bindCheckpoint(id, head, cwd);
  });
}
const PROJECTION_KIND: ReadonlyArray<readonly [RegExp, ArtifactKind]> = [
  [/^index\.md$/u, "subject-index"],
  [/^plan-.+\.md$/u, "plan"],
  [/^research-.+\.md$/u, "research"],
  [/^phase-.+\.md$/u, "phase"],
  [/^spec-.+\.md$/u, "spec"],
  [/^iterate-.+\.md$/u, "iterate"],
  [/^brainstorm-.+\.md$/u, "brainstorm"],
  [/^review-.+\.md$/u, "review"],
];
function projectionKind(name: string): ArtifactKind | null {
  return PROJECTION_KIND.find(([pattern]) => pattern.test(name))?.[1] ?? null;
}
async function importRepoProjection(store: StorageStore, cwd: string, context: TrustedWorkflowContext): Promise<void> {
  if (!(store instanceof RepoFilesStorageStore)) return;
  let names: string[] = [];
  try { names = (await readdir(join(cwd, ".context"), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name); }
  catch { return; }
  for (const subjectId of names) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(subjectId)) continue;
    await importSubjectProjection(store, cwd, context, subjectId);
  }
}
async function importSubjectProjection(store: RepoFilesStorageStore, cwd: string, context: TrustedWorkflowContext, subjectId: string): Promise<void> {
  let names: string[] = [];
  try { names = await readdir(join(cwd, ".context", subjectId)); } catch { return; }
  for (const name of names) {
    const kind = projectionKind(name);
    if (!kind) continue;
    const key = bindRef(context, { subjectId, kind, logicalName: name });
    if (await store.read(key)) continue;
    if (context.selection?.integrationRef) {
      // A clean tracked body may have arrived from another branch after sealing.
      // Only observable local edits can initialize an unpublished branch overlay.
      const local = defaultGit(cwd, ["status", "--porcelain", "--untracked-files=all", "--", `.context/${subjectId}/${name}`]);
      if (local.status !== 0 || !local.stdout) continue;
    }
    let bytes: Uint8Array;
    try { bytes = new Uint8Array(await readFile(join(cwd, ".context", subjectId, name))); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    await store.writeBatch([{ key, revision: randomUUID(), bytes, sha256: revisionHash(bytes), author: "workflow-state", source: "projection-import", createdAt: new Date().toISOString(), links: [], expectedRevision: null }]);
  }
}
async function writeEvidence(store: StorageStore, context: TrustedWorkflowContext, name: string, body: unknown): Promise<Record<string, unknown>> {
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  const ref = { subjectId: "workflow-evidence", kind: "audit" as const, logicalName: name };
  const revision: ArtifactRevision = { key: bindRef(context, ref), revision: randomUUID(), bytes, sha256: revisionHash(bytes), author: "workflow-state", source: "inspect-evidence", createdAt: new Date().toISOString(), links: [] };
  const [written] = await store.writeBatch([revision]);
  return view(written ?? revision);
}
async function namedBranch(context: TrustedWorkflowContext, ref: string, cwd: string, path: string, git: GitRunner): Promise<string> {
  if (!ref.startsWith("refs/heads/")) throw new Error("inspect requires a named local branch ref");
  const tip = git(cwd, ["rev-parse", "--verify", ref]);
  if (tip.status !== 0 || !/^[a-f0-9]{40,64}$/i.test(tip.stdout)) throw new Error(`Cannot resolve named branch scope ${ref}`);
  return identityTransaction(path, () => bindWorkspaceBranch(cwd, path, git, context, { status: 0, stdout: ref }, tip));
}

export async function executeWorkflowState(options: WorkflowExecuteOptions): Promise<unknown> {
  rejectCallerScope(options.request);
  requireContext(options.context);
  denyRole(options.role, options.request.operation);
  const trusted = options.store || options.context.selection ? options.context : await resolveTrustedContext(options.cwd, options);
  const opened = options.store ? { store: options.store, close: () => {} } : await openStore(options.cwd, trusted.selection!, options.context.projectId, trusted.manifestRoot!);
  try {
    const context = await publicationContext(opened.store, options.cwd, trusted);
    options = { ...options, context };
    if (options.request.operation === "list" || options.request.operation === "search" || options.request.operation === "discover" || options.request.operation === "inspect-lifecycle") {
      await importRepoProjection(opened.store, options.cwd, options.context);
    }
    return await dispatch(options, opened.store);
  } finally { await opened.close(); }
}
const HANDLERS: Record<WorkflowRequest["operation"], (options: WorkflowExecuteOptions, store: StorageStore) => Promise<unknown>> = {
  read: (options, store) => readOne(store, options.context, refFrom(options.request as Extract<WorkflowRequest, { operation: "read" }>)),
  list: async (options, store) => (await store.list(queryFor(options.context, options.request as Extract<WorkflowRequest, { operation: "list" }>))).map((item, index) => view(item, index + 1)),
  search: async (options, store) => {
    const request = options.request as Extract<WorkflowRequest, { operation: "search" }>;
    return (await lookupKnowledge(store, { ...queryFor(options.context, request), text: request.text })).map((item, index) => view(item, index + 1));
  },
  write: (options, store) => writeOne(store, options.context, options.request as Extract<WorkflowRequest, { operation: "write" }>),
  correct: (options, store) => correctOne(store, options.context, options.request as Extract<WorkflowRequest, { operation: "correct" }>),
  discover: (options, store) => discoverStoredContext(store, queryFor(options.context, options.request as Extract<WorkflowRequest, { operation: "discover" }>)),
  "inspect-lifecycle": (options, store) => store.inspectLifecycle(options.context.projectId, options.context.branchId, (options.request as Extract<WorkflowRequest, { operation: "inspect-lifecycle" }>).subjectId, options.context.publishedRevisionIds),
  transition: (options, store) => store.transition({ ...(options.request as Extract<WorkflowRequest, { operation: "transition" }>), projectId: options.context.projectId, branchId: options.context.branchId, publishedRevisionIds: options.context.publishedRevisionIds }),
  "read-receipt": (options, store) => readBoundReceipt(store, options),
  "write-receipt": (options, store) => writeReceipt(store, options, options.request as Extract<WorkflowRequest, { operation: "write-receipt" }>),
  inspect: (options, store) => inspectScope(store, options.context, (options.request as Extract<WorkflowRequest, { operation: "inspect" }>).branchRef, options),
  recover: (options, store) => recoverScopes(store, options.context, options),
  "publication-view": async (options, store) => ({ ...(await readPublicationLedger(store, options.context.projectId)).value, checkpoints: await store.listCheckpoints(options.context.projectId) }),
  "map-checkpoint": async (options, store) => {
    const request = options.request as Extract<WorkflowRequest, { operation: "map-checkpoint" }>;
    const ref = options.context.selection?.integrationRef;
    if (!ref) throw new Error("mapping requires configured integration_ref");
    await recordRewriteMapping(store, options.cwd, options.context.projectId, ref, { ...request, projectId: options.context.projectId });
    return store.reconcile(ref, options.cwd, options.context.projectId);
  },
  "revoke-mapping": async (options, store) => {
    const request = options.request as Extract<WorkflowRequest, { operation: "revoke-mapping" }>;
    await revokeRewriteMapping(store, options.context.projectId, request.checkpointId);
    const ref = options.context.selection?.integrationRef;
    if (!ref) throw new Error("revocation requires configured integration_ref");
    return store.reconcile(ref, options.cwd, options.context.projectId);
  },
  "resolve-publication": async (options, store) => {
    const request = options.request as Extract<WorkflowRequest, { operation: "resolve-publication" }>;
    await resolvePublicationConflict(store, options.context.projectId, request.revision);
    const ref = options.context.selection?.integrationRef;
    if (!ref) throw new Error("resolution requires configured integration_ref");
    return store.reconcile(ref, options.cwd, options.context.projectId);
  },
};
async function dispatch(options: WorkflowExecuteOptions, store: StorageStore): Promise<unknown> {
  return HANDLERS[options.request.operation](options, store);
}
async function readOne(store: StorageStore, context: TrustedWorkflowContext, ref: ArtifactRef): Promise<Record<string, unknown> | null> {
  const visible = await store.list(queryFor(context, { subjectId: ref.subjectId, kind: ref.kind, prefix: ref.logicalName }));
  const selected = visible.find(item => item.key.logicalName === ref.logicalName && (ref.revision === undefined || item.revision === ref.revision));
  return selected ? view(selected) : null;
}
async function writeOne(store: StorageStore, context: TrustedWorkflowContext, request: Extract<WorkflowRequest, { operation: "write" }>): Promise<Record<string, unknown>> {
  const bytes = bytesOf(request);
  const revision: ArtifactRevision = {
    key: bindRef(context, request.ref), revision: randomUUID(), bytes, sha256: revisionHash(bytes),
    author: request.author ?? "workflow-state", source: request.source ?? "workflow-state", createdAt: new Date().toISOString(),
    links: (request.links ?? []).map((link) => bindRef(context, link)),
    ...(request.expectedRevision !== undefined ? { expectedRevision: request.expectedRevision } : {}),
  };
  const [written] = await store.writeBatch([revision]);
  return view(written ?? revision);
}
async function correctOne(store: StorageStore, context: TrustedWorkflowContext, request: Extract<WorkflowRequest, { operation: "correct" }>): Promise<Record<string, unknown> | null> {
  const ref = refFrom(request);
  const key = bindRef(context, ref);
  const replacement = request.body === undefined || request.body === null ? null : await replacementRevision(key, request.body, request.predecessorRevision);
  const corrected = await store.correct({ key, predecessorRevision: request.predecessorRevision, replacement, idempotencyKey: request.idempotencyKey, publishedRevisionIds: context.publishedRevisionIds });
  return corrected ? view(corrected) : null;
}
async function replacementRevision(key: ArtifactKey, body: string, predecessor: string): Promise<ArtifactRevision> {
  const bytes = new TextEncoder().encode(body);
  return { key, revision: randomUUID(), bytes, sha256: revisionHash(bytes), author: "workflow-state", source: "correction", createdAt: new Date().toISOString(), links: [], expectedRevision: predecessor };
}
async function writeReceipt(store: StorageStore, options: WorkflowExecuteOptions, request: Extract<WorkflowRequest, { operation: "write-receipt" }>): Promise<RunReceipt> {
  const context = options.context;
  const run = await receiptRun(context, request, options);
  if (!run) throw new Error("receipt requires a trusted run identity");
  const receipt: RunReceipt = { projectId: context.projectId, branchId: context.branchId, ...run, attemptId: request.attemptId, status: request.status, artifactRevisions: request.artifactRevisions, ...(request.kind ? { kind: request.kind } : {}), ...(request.metadataDuties ? { metadataDuties: request.metadataDuties } : {}) };
  await store.writeReceipt(receipt);
  const stored = await store.readReceipt(context.projectId, run.runId);
  if (!stored) throw new Error("uncertain persistence blocks save");
  assertReceiptReadback(stored, receipt);
  assertBoundReceipt(stored, context, run);
  return stored;
}
async function readBoundReceipt(store: StorageStore, options: WorkflowExecuteOptions): Promise<RunReceipt | null> {
  const context = options.context;
  const run = await receiptRun(context, undefined, options);
  if (!run) return null;
  const stored = await store.readReceipt(context.projectId, run.runId);
  if (!stored) return null;
  assertBoundReceipt(stored, context, run);
  return stored;
}
function assertBoundReceipt(stored: RunReceipt, context: TrustedWorkflowContext, run: { worktreeId: string; runId: string }): void {
  if (stored.projectId === context.projectId && stored.branchId === context.branchId && stored.worktreeId === run.worktreeId && stored.runId === run.runId) return;
  throw new Error("receipt scope does not match the bound context");
}
async function receiptRun(context: TrustedWorkflowContext, request: Extract<WorkflowRequest, { operation: "write-receipt" }> | undefined, options: WorkflowExecuteOptions): Promise<{ worktreeId: string; runId: string } | undefined> {
  try {
    return request ? await bindAttemptRun(context, request, options) : await latestAttemptRun(context, options);
  } catch (error) {
    if (!context.worktreeId || !context.runId || !/trusted run identity/.test(error instanceof Error ? error.message : String(error))) throw error;
    return { worktreeId: context.worktreeId, runId: context.runId };
  }
}
async function bindAttemptRun(context: TrustedWorkflowContext, request: Extract<WorkflowRequest, { operation: "write-receipt" }>, options: WorkflowExecuteOptions): Promise<{ worktreeId: string; runId: string }> {
  if (!context.worktreeId) throw new Error("receipt requires a trusted run identity");
  const path = identityPath(options.identityPath);
  const worktreeId = context.worktreeId;
  return identityTransaction(path, async () => {
    const file = await readIdentity(path);
    const workspace = loadWorkspace(file, context.projectId, options.cwd, worktreeId);
    const existing = (workspace.attempts ?? []).find((item) => item.branchId === context.branchId && item.attemptId === request.attemptId);
    if (existing) return { worktreeId, runId: existing.runId };
    if (request.status === "complete") throw new Error("complete receipt requires matching attempted identity");
    const created = { runId: createRunId(), branchId: context.branchId, attemptId: request.attemptId };
    workspace.attempts = [...(workspace.attempts ?? []), created];
    await writeIdentity(path, file);
    return { worktreeId, runId: created.runId };
  });
}
async function latestAttemptRun(context: TrustedWorkflowContext, options: WorkflowExecuteOptions): Promise<{ worktreeId: string; runId: string } | undefined> {
  if (!context.worktreeId) return undefined;
  const path = identityPath(options.identityPath);
  const worktreeId = context.worktreeId;
  return identityTransaction(path, async () => {
    const workspace = loadWorkspace(await readIdentity(path), context.projectId, options.cwd, worktreeId);
    const latest = (workspace.attempts ?? []).filter((item) => item.branchId === context.branchId).at(-1);
    return latest ? { worktreeId, runId: latest.runId } : undefined;
  });
}
function loadWorkspace(file: IdentityFile, projectId: string, cwd: string, worktreeId: string): WorkspaceRecord {
  const workspace = file.projects[projectId]?.workspaces?.[resolve(cwd)];
  if (!workspace || workspace.worktreeId !== worktreeId) throw new Error("receipt requires a trusted run identity");
  return workspace;
}
async function inspectScope(store: StorageStore, context: TrustedWorkflowContext, branchRef: string, options: WorkflowExecuteOptions): Promise<unknown> {
  const git = options.git ?? defaultGit;
  const branchId = await namedBranch(context, branchRef, options.cwd, identityPath(options.identityPath), git);
  const items = await store.list({ projectId: context.projectId, branchId, publishedRevisionIds: context.publishedRevisionIds });
  const evidence = await writeEvidence(store, context, `inspect/${Date.now()}-${branchRef.replace(/[^A-Za-z0-9._-]/g, "-")}.json`, { operation: "inspect", branchRef, branchId, count: items.length });
  return { scope: { branchRef, branchId }, evidence, items: items.map((item, index) => view(item, index + 1)) };
}
async function recoverScopes(store: StorageStore, context: TrustedWorkflowContext, options: WorkflowExecuteOptions): Promise<unknown> {
  const file = readIdentity(identityPath(options.identityPath));
  const project = file.projects[context.projectId] ?? { branches: [] };
  const checkpoints = await store.listCheckpoints(context.projectId);
  const scopes = [
    ...namedRecoveryScopes(project.branches, context, options),
    ...workspaceRecoveryScopes(project.workspaces ?? {}, context),
    ...storedRecoveryScopes(await store.listScopes(context.projectId), context),
  ].map(scope => ({ ...scope, checkpointIds: checkpoints.filter(x => x.branchId === scope.branchId).map(x => x.id) }));
  const request = options.request as Extract<WorkflowRequest, { operation: "recover" }>;
  if (!request.scopeToken && !request.action) {
    const evidence = await writeEvidence(store, context, `recover/${randomUUID()}.json`, { operation: "recover", scopes });
    return { scopes, evidence };
  }
  const selected = scopes.find(x => x.scopeToken === request.scopeToken);
  if (!selected || !request.action) throw new Error("recovery requires an explicitly selected scope and action");
  return recoverSelected(store, context, selected, request.action);
}

async function recoverSelected(store: StorageStore, context: TrustedWorkflowContext, selected: RecoveryScope, action: "export" | "rebind"): Promise<unknown> {
  const items = await store.list({ projectId: context.projectId, branchId: selected.branchId, publishedRevisionIds: [], worktreeId: selected.worktreeId, runId: selected.runId });
  const evidence = await writeEvidence(store, context, `recover/${randomUUID()}.json`, { selected, action, revisions: items.map(x => x.revision) });
  if (action === "export") return { selected, evidence, items: items.map(x => ({ ...view(x), bytesBase64: Buffer.from(x.bytes).toString("base64") })) };
  if (action !== "rebind") throw new Error("unknown recovery action");
  const copies = items.filter(x => !staysPrivateAfterMerge(x.key.kind)).map(x => ({ ...x, key: { ...x.key, branchId: context.branchId, worktreeId: undefined, runId: undefined }, revision: randomUUID(), expectedRevision: null, source: `recovered:${selected.scopeToken}:${x.revision}`, links: [...x.links, x.key] }));
  await store.writeBatch(copies);
  return { selected, evidence, items: copies.map(x => view(x)) };
}

interface RecoveryScope {
  scopeToken: string;
  branchRef: string;
  branchId: string;
  reason: string;
  incarnation?: string;
  initialTip?: string;
  observedTip?: string;
  worktreeId?: string;
  runId?: string;
}
function namedRecoveryScopes(branches: BranchRecord[], context: TrustedWorkflowContext, options: WorkflowExecuteOptions): RecoveryScope[] {
  const git = options.git ?? defaultGit;
  return branches.filter(x => x.branchId !== context.branchId).map(record => {
    const tip = git(options.cwd, ["rev-parse", "--verify", record.ref]);
    const continuity = tip.status === 0 ? git(options.cwd, ["merge-base", "--is-ancestor", record.initialTip, tip.stdout]).status : 1;
    return { scopeToken: record.branchId, branchRef: record.ref, branchId: record.branchId, incarnation: record.incarnation, initialTip: record.initialTip, observedTip: record.observedTip, reason: tip.status !== 0 ? "deleted-or-unprovable" : continuity === 0 ? "other-branch" : "recreated-or-unprovable" };
  });
}
function workspaceRecoveryScopes(workspaces: Record<string, WorkspaceRecord>, context: TrustedWorkflowContext): RecoveryScope[] {
  const scopes: RecoveryScope[] = [];
  for (const workspace of Object.values(workspaces)) {
    const detached = createPrivateWorkspaceIdentity({ projectId: context.projectId, workspaceNonce: workspace.nonce, worktreeId: workspace.worktreeId, runId: workspace.runId });
    const branches = [{ branchId: detached.branchId, ref: "HEAD", initialTip: undefined as string | undefined }, ...Object.entries(workspace.privateBranches ?? {}).map(([ref, value]) => ({ ...value, ref }))];
    for (const branch of branches.filter(x => x.branchId !== context.branchId)) {
      scopes.push({ scopeToken: `${branch.branchId}:${workspace.worktreeId}`, branchId: branch.branchId, branchRef: branch.ref, initialTip: branch.initialTip, reason: branch.ref === "HEAD" ? "detached" : branch.initialTip ? "private-named" : "unborn", worktreeId: workspace.worktreeId, runId: workspace.runId });
    }
  }
  return scopes;
}

function storedRecoveryScopes(scopes: readonly Pick<ArtifactKey, "branchId" | "worktreeId" | "runId">[], context: TrustedWorkflowContext): RecoveryScope[] {
  return scopes.filter(scope => scope.branchId && scope.branchId !== "publication-authority" && scope.branchId !== context.branchId).map(scope => ({
    ...scope,
    branchId: scope.branchId!,
    scopeToken: `stored:${Buffer.from(JSON.stringify(scope)).toString("base64url")}`,
    branchRef: "",
    reason: "retained-adapter-scope",
  }));
}
