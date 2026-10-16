import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { ArtifactKey, ArtifactKind, ArtifactQuery, ArtifactRevision, RunReceipt, StorageStore } from "../storage/contract.js";
import { loadStorageConfig, loadStorageConfigSync, type ResolvedStorageConfig } from "../storage/config.js";
import { revisionHash } from "../storage/adapter-utils.js";
import { assertReceiptReadback, discoverStoredContext, lookupKnowledge } from "../storage/domain.js";
import { ExternalFilesStorageStore, RepoFilesStorageStore } from "../storage/file-store.js";
import { createBranchIdentity, createPrivateWorkspaceIdentity, createRunId, createWorktreeId, resolveProjectIdentity, validateArtifactKey } from "../storage/identity.js";
import { PostgresStorageStore } from "../storage/postgres-store.js";
import { SQLiteStorageStore } from "../storage/sqlite-store.js";
import { createLazyPool } from "../storage/db.js";
import type { TextLifecycleIntent } from "./subject-lifecycle.js";
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
  | { operation: "recover" };

const SCOPE_KEYS: Record<string, true> = { selection: true, manifestRoot: true, projectId: true, branchId: true, publishedRevisionIds: true, worktreeId: true, runId: true, project: true, visibility: true, published: true };
const ROLE_OPS: Record<WorkflowRole, readonly WorkflowRequest["operation"][]> = {
  read: ["read", "list", "search", "discover", "inspect-lifecycle", "read-receipt"],
  write: ["read", "list", "search", "discover", "inspect-lifecycle", "read-receipt", "write"],
  save: ["read", "list", "search", "discover", "inspect-lifecycle", "read-receipt", "write", "correct", "transition", "write-receipt"],
  admin: ["read", "list", "search", "discover", "inspect-lifecycle", "read-receipt", "write", "correct", "transition", "write-receipt", "inspect", "recover"],
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
interface WorkspaceRecord { nonce: string; worktreeId: string; runId: string; attempts?: AttemptBinding[] }
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
    const ancestor = git(cwd, ["merge-base", "--is-ancestor", record.initialTip, ref]);
    if (ancestor.status === 0) matches.push(record);
    else if (ancestor.status !== 1) throw new Error("Cannot prove branch continuity; refusing shared scope");
  }
  if (matches.length > 1) throw new Error("Branch identity is ambiguous; refusing shared scope");
  if (matches[0]) {
    matches[0].observedTip = tip;
    file.projects[projectId] = project;
    await writeIdentity(path, file);
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
  const existing = workspaces[key] ?? { nonce: randomUUID(), worktreeId: createWorktreeId(), runId: createRunId() };
  workspaces[key] = existing;
  project.workspaces = workspaces;
  file.projects[projectId] = project;
  await writeIdentity(path, file);
  const workspace = createPrivateWorkspaceIdentity({ projectId, workspaceNonce: existing.nonce, worktreeId: existing.worktreeId, runId: existing.runId });
  return { projectId, branchId: workspace.branchId, worktreeId: workspace.worktreeId, runId: existing.runId, publishedRevisionIds: [] };
}
export async function resolveTrustedContext(cwd: string, options: { origin?: string; identityPath?: string; configPath?: string; git?: GitRunner } = {}): Promise<TrustedWorkflowContext> {
  const git = options.git ?? defaultGit;
  const remote = options.origin === undefined ? git(cwd, ["config", "--get", "remote.origin.url"]) : undefined;
  const origin = options.origin ?? (remote?.status === 0 ? remote.stdout : undefined);
  const common = git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  const config = await loadStorageConfig({ origin, configPath: options.configPath });
  const project = resolveProjectIdentity({ configuredKey: config.projectKey, origin, gitCommonDir: common.status === 0 ? common.stdout : resolve(cwd) });
  const ref = git(cwd, ["symbolic-ref", "--quiet", "HEAD"]);
  const head = git(cwd, ["rev-parse", "HEAD"]);
  const path = identityPath(options.identityPath);
  return identityTransaction(path, async () => {
    const workspace = await bindPrivate(project.projectId, cwd, path);
    const branchId = ref.status !== 0 || head.status !== 0 ? workspace.branchId : await bindBranch(project.projectId, ref.stdout, head.stdout, cwd, path, git);
    return { ...workspace, branchId, selection: config, manifestRoot: join(dirname(path), "projects", project.projectId, "repo-manifest") };
  });
}

/** Read an already-bound workspace scope. Does not invent identity. */
export function readPinnedScopeSync(cwd: string): { projectId: string; branchId: string; worktreeId: string; runId: string; publishedRevisionIds: readonly string[] } | null {
  const origin = readPinnedGitValue(cwd, ["config", "--get", "remote.origin.url"]) ?? undefined;
  const common = readPinnedGitValue(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  let config: ResolvedStorageConfig;
  try { config = loadStorageConfigSync({ origin }); }
  catch { return null; }
  const project = resolveProjectIdentity({ configuredKey: config.projectKey, origin, gitCommonDir: common ?? resolve(cwd) });
  const record = readIdentity(identityPath()).projects[project.projectId];
  const workspace = record?.workspaces?.[resolve(cwd)];
  if (!record || !workspace?.worktreeId || !workspace.runId) return null;
  const branchId = pinnedBranchId(
    project.projectId,
    workspace,
    record.branches,
    readPinnedGitValue(cwd, ["symbolic-ref", "--quiet", "HEAD"]),
  );
  return { projectId: project.projectId, branchId, worktreeId: workspace.worktreeId, runId: workspace.runId, publishedRevisionIds: [] };
}

function readPinnedGitValue(cwd: string, args: string[]): string | null {
  try { return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return null; }
}

function pinnedBranchId(projectId: string, workspace: WorkspaceRecord, branches: readonly BranchRecord[], ref: string | null): string {
  const branch = ref ? branches.find((item) => item.ref === ref) : undefined;
  if (branch) return branch.branchId;
  return createPrivateWorkspaceIdentity({
    projectId,
    workspaceNonce: workspace.nonce,
    worktreeId: workspace.worktreeId,
    runId: workspace.runId,
  }).branchId;
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
  try { return await run(opened.store, context); }
  finally { opened.close(); }
}
async function openStore(cwd: string, selection: ResolvedStorageConfig, projectKey: string, manifestRoot: string): Promise<{ store: StorageStore; close: () => void }> {
  const storage = selection.storage;
  if (storage.adapter === "repo-files") {
    const contextRoot = join(cwd, ".context");
    // Editable bodies remain Git-portable; immutable authority stays machine-private.
    await mkdir(manifestRoot, { recursive: true });
    return { store: new RepoFilesStorageStore({ root: manifestRoot, contextRoot, manifestRoot }), close: () => {} };
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
    try {
      const bytes = new Uint8Array(await readFile(join(cwd, ".context", subjectId, name)));
      await store.writeBatch([{ key, revision: randomUUID(), bytes, sha256: revisionHash(bytes), author: "workflow-state", source: "projection-import", createdAt: new Date().toISOString(), links: [] }]);
    } catch { /* absent projection is not an error */ }
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
  return identityTransaction(path, () => bindBranch(context.projectId, ref, tip.stdout, cwd, path, git));
}

export async function executeWorkflowState(options: WorkflowExecuteOptions): Promise<unknown> {
  rejectCallerScope(options.request);
  requireContext(options.context);
  denyRole(options.role, options.request.operation);
  const trusted = options.store || options.context.selection ? options.context : await resolveTrustedContext(options.cwd, options);
  const opened = options.store ? { store: options.store, close: () => {} } : await openStore(options.cwd, trusted.selection!, options.context.projectId, trusted.manifestRoot!);
  try {
    if (options.request.operation === "list" || options.request.operation === "search" || options.request.operation === "discover" || options.request.operation === "inspect-lifecycle") {
      await importRepoProjection(opened.store, options.cwd, options.context);
    }
    return await dispatch(options, opened.store);
  } finally { opened.close(); }
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
  const file = await readIdentity(identityPath(options.identityPath));
  const scopes = (file.projects[context.projectId]?.branches ?? []).filter((record) => record.branchId !== context.branchId).map((record) => ({ branchRef: record.ref, branchId: record.branchId, initialTip: record.initialTip }));
  const evidence = await writeEvidence(store, context, `recover/${Date.now()}.json`, { operation: "recover", scopes });
  return { scopes, evidence };
}
