import { randomUUID } from "node:crypto";
import { basename, join } from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { withConfiguredStore } from "../scripts/workflow-state.js";
import { createRunId } from "./identity.js";
import { revisionHash } from "./adapter-utils.js";
import { loadStorageConfigSync, type ResolvedStorageConfig } from "./config.js";
import type { ArtifactKind, ArtifactKey, ArtifactRevision, RunReceipt, StorageStore } from "./contract.js";
import { assertReceiptReadback } from "./domain.js";
import { ExternalFilesStorageStore } from "./file-store.js";
import type { MigrationPool } from "./migrations.js";
import { SQLiteStorageStore } from "./sqlite-store.js";

/** Kinds that stay invisible after branch merge. Knowledge kinds omit run identity. */
const RUN_PRIVATE: ReadonlySet<ArtifactKind> = new Set(["run-state", "checkpoint", "activity", "audit", "receipt", "attribution"]);

export interface ConsumerScope {
  projectId: string;
  branchId: string;
  worktreeId: string;
  runId: string;
  publishedRevisionIds?: readonly string[];
}

export interface ConsumerWrite {
  kind: ArtifactKind;
  subjectId: string;
  logicalName: string;
  bytes: Uint8Array;
  author?: string;
  source?: string;
  links?: readonly ArtifactKey[];
}

export function consumerKey(scope: ConsumerScope, kind: ArtifactKind, subjectId: string, logicalName: string): ArtifactKey {
  return {
    projectId: scope.projectId,
    branchId: scope.branchId,
    subjectId,
    kind,
    logicalName,
    ...(RUN_PRIVATE.has(kind) ? { worktreeId: scope.worktreeId, runId: scope.runId } : {}),
  };
}

export function isRunPrivateKind(kind: ArtifactKind): boolean {
  return RUN_PRIVATE.has(kind);
}

/** One store commits the batch and the attempt receipt. A missing readback blocks completion. */
export async function commitConsumerBatch(
  store: StorageStore,
  scope: ConsumerScope,
  writes: readonly ConsumerWrite[],
  receipt: { attemptId: string; status: RunReceipt["status"]; kind?: RunReceipt["kind"]; metadataDuties?: readonly string[] },
): Promise<{ revisions: readonly string[]; receipt: RunReceipt }> {
  const revisions = writes.map((write) => revisionFor(scope, write));
  const written = await store.writeBatch(revisions);
  if (written.length !== revisions.length) throw new Error("uncertain persistence blocks save");
  const stored: RunReceipt = {
    projectId: scope.projectId,
    branchId: scope.branchId,
    worktreeId: scope.worktreeId,
    runId: scope.runId,
    attemptId: receipt.attemptId,
    status: receipt.status,
    artifactRevisions: written.map((item) => item.revision),
    ...(receipt.kind ? { kind: receipt.kind } : {}),
    ...(receipt.metadataDuties ? { metadataDuties: receipt.metadataDuties } : {}),
  };
  await store.writeReceipt(stored);
  const read = await store.readReceipt(scope.projectId, scope.runId);
  if (!read) throw new Error("uncertain persistence blocks save");
  assertReceiptReadback(read, stored);
  if (read.worktreeId !== scope.worktreeId || read.runId !== scope.runId) throw new Error("receipt scope does not match the bound context");
  return { revisions: stored.artifactRevisions, receipt: read };
}

export async function readConsumer(store: StorageStore, scope: ConsumerScope, kind: ArtifactKind, subjectId: string, logicalName: string): Promise<ArtifactRevision | null> {
  const key = consumerKey(scope, kind, subjectId, logicalName);
  const found = await store.read(key);
  if (!found) return null;
  if (found.key.runId !== undefined && (found.key.worktreeId !== scope.worktreeId || found.key.runId !== scope.runId)) return null;
  return found;
}

export async function listVisiblePlans(store: StorageStore, scope: ConsumerScope): Promise<readonly ArtifactRevision[]> {
  return store.list({
    projectId: scope.projectId,
    branchId: scope.branchId,
    publishedRevisionIds: scope.publishedRevisionIds ?? [],
    kind: "plan",
  });
}

function revisionFor(scope: ConsumerScope, write: ConsumerWrite): ArtifactRevision {
  return {
    key: consumerKey(scope, write.kind, write.subjectId, write.logicalName),
    revision: randomUUID(),
    bytes: write.bytes,
    sha256: revisionHash(write.bytes),
    author: write.author ?? "buck-consumer",
    source: write.source ?? "consumer",
    createdAt: new Date().toISOString(),
    links: write.links ?? [],
  };
}

export function resumeScope(projectId: string, branchId: string, worktreeId: string): ConsumerScope {
  return { projectId, branchId, worktreeId, runId: `resume:${worktreeId}`, publishedRevisionIds: [] };
}

export async function writeResumePointer(store: StorageStore, scope: ConsumerScope, bytes: Uint8Array): Promise<string> {
  const committed = await commitConsumerBatch(store, scope, [{
    kind: "checkpoint", subjectId: "buck-loop", logicalName: "workflow/buck-loop.json", bytes, source: "buck-loop",
  }], { attemptId: scope.runId, status: "attempted" });
  return committed.revisions[0] ?? "";
}

export async function readResumePointer(store: StorageStore, scope: ConsumerScope): Promise<Uint8Array | null> {
  const found = await readConsumer(store, scope, "checkpoint", "buck-loop", "workflow/buck-loop.json");
  return found?.bytes ?? null;
}

/** Retain one artifact on the configured store with its own receipt-bearing run. Returns the run id for readback. */
export async function retainConfiguredArtifact(write: {
  kind: ArtifactKind;
  subjectId: string;
  logicalName: string;
  bytes: Uint8Array;
  worktreeId: string;
  author?: string;
  source?: string;
}): Promise<string | null> {
  const selection = loadStorageConfigSync();
  if (selection.storage.adapter === "repo-files") return null;
  const opened = await openConfiguredRetainStore(selection);
  try {
    const runId = randomUUID();
    await commitConsumerBatch(opened.store, {
      projectId: selection.projectKey ?? "configured-project",
      branchId: "configured-branch",
      worktreeId: write.worktreeId,
      runId,
      publishedRevisionIds: [],
    }, [write], { attemptId: runId, status: "attempted" });
    return runId;
  } finally {
    await opened.close();
  }
}

let retainTail: Promise<void> = Promise.resolve();
let retainFailures: unknown[] = [];

/** Schedule synchronous writers serially; an explicit drain acknowledges accumulated failures. */
export function scheduleConfiguredRetain(write: Parameters<typeof retainConfiguredArtifact>[0]): Promise<string | null> {
  const retained = retainTail.then(() => retainConfiguredArtifact(write));
  retainTail = retained.then(
    () => undefined,
    (error: unknown) => { retainFailures.push(error); },
  );
  return retained;
}

const KIND_BY_FILENAME: ReadonlyArray<readonly [RegExp, ArtifactKind]> = [
  [/^plan-/u, "plan"],
  [/^phase-/u, "phase"],
  [/^spec-/u, "spec"],
  [/^iterate-/u, "iterate"],
  [/^review-/u, "review"],
  [/^research-/u, "research"],
  [/^brainstorm-/u, "brainstorm"],
];

/** Classify a `.context`-relative path into its artifact kind, subject, and logical name. */
export function classifyContextPath(path: string): { kind: ArtifactKind; subjectId: string; logicalName: string } {
  const rel = path.replace(/^\.context\//u, "");
  if (rel.startsWith("memory/")) return { kind: "memory", subjectId: "memory", logicalName: rel };
  if (rel.startsWith("backlog/")) return { kind: "backlog", subjectId: "backlog", logicalName: rel };
  const segments = rel.split("/");
  if (segments.length === 1) return { kind: "audit", subjectId: "save-apply", logicalName: rel };
  const subjectId = segments[0]!;
  const name = segments.at(-1)!;
  if (name === "index.md") return { kind: "subject-index", subjectId, logicalName: rel };
  const matched = KIND_BY_FILENAME.find(([pattern]) => pattern.test(name));
  return matched ? { kind: matched[1], subjectId, logicalName: rel } : { kind: "audit", subjectId, logicalName: rel };
}

export async function flushConfiguredRetains(): Promise<void> {
  await retainTail;
  const failures = retainFailures;
  retainFailures = [];
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "One or more configured artifact retains failed");
}

async function openConfiguredRetainStore(selection: ResolvedStorageConfig): Promise<{ store: StorageStore; close: () => Promise<void> | void }> {
  const storage = selection.storage;
  if (storage.adapter === "sqlite") {
    if (!storage.database) throw new Error("SQLite storage requires a database path");
    const store = SQLiteStorageStore.openSync(storage.database);
    return { store, close: () => store.close() };
  }
  if (storage.adapter === "postgres") {
    // Dynamic: PostgresStorageStore eagerly imports pg; consumers must not pay that cost on file/sqlite runs.
    const { PostgresStorageStore } = await import("./postgres-store.js");
    const { createLazyPool } = await import("./db.js");
    const envName = storage.connection_env;
    if (!envName) throw new Error("PostgreSQL storage requires connection_env");
    const url = process.env[envName];
    if (!url) throw new Error(`PostgreSQL connection env ${envName} is unset`);
    const pool = createLazyPool(url)() as MigrationPool & { end(): Promise<void> };
    const store = new PostgresStorageStore(pool);
    await store.migrate();
    return { store, close: () => pool.end() };
  }
  return {
    store: new ExternalFilesStorageStore({ projectKey: selection.projectKey ?? "configured-project" }),
    close: () => {},
  };
}

export interface PresentationRetainOptions {
  slug?: string;
  store?: StorageStore;
  context?: { projectId: string; branchId: string; worktreeId?: string };
  cwd?: string;
}

/**
 * Retain a generated presentation package (pages, assets, sources, manifest) on
 * one store as attachment artifacts — binary bytes intact, one receipt-bearing run.
 * The on-disk package stays the user-facing export; the store keeps the canonical copy.
 */
export async function retainPresentationPackage(packageDir: string, options: PresentationRetainOptions = {}): Promise<{ runId: string; revisions: readonly string[] }> {
  const slug = options.slug ?? basename(packageDir);
  const files = await packageFiles(packageDir);
  if (files.length === 0) throw new Error(`presentation package is empty or missing: ${packageDir}`);
  const writes: ConsumerWrite[] = files.map((file) => ({
    kind: "attachment",
    subjectId: slug,
    logicalName: `presentations/${slug}/${file.relative}`,
    bytes: file.bytes,
    source: "b-present",
  }));
  const attemptRun = createRunId();
  const commit = async (store: StorageStore, context: { projectId: string; branchId: string; worktreeId?: string }): Promise<readonly string[]> => {
    if (!context.worktreeId) throw new Error("presentation retention requires a trusted worktree identity");
    const committed = await commitConsumerBatch(store, {
      projectId: context.projectId,
      branchId: context.branchId,
      worktreeId: context.worktreeId,
      runId: attemptRun,
      publishedRevisionIds: [],
    }, writes, { attemptId: attemptRun, status: "attempted", metadataDuties: ["package"] });
    return committed.revisions;
  };
  const revisions = options.store && options.context
    ? await commit(options.store, options.context)
    : await withConfiguredStore(options.cwd ?? process.cwd(), commit, {});
  return { runId: attemptRun, revisions };
}

async function packageFiles(packageDir: string): Promise<Array<{ relative: string; bytes: Uint8Array }>> {
  const collected: Array<{ relative: string; bytes: Uint8Array }> = [];
  const walk = async (dir: string, prefix: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isSymbolicLink()) throw new Error(`presentation package contains a symlink, refusing: ${join(prefix, entry.name)}`);
      if (entry.isDirectory()) await walk(join(dir, entry.name), `${prefix}${entry.name}/`);
      else if (entry.isFile()) collected.push({ relative: `${prefix}${entry.name}`, bytes: new Uint8Array(await readFile(join(dir, entry.name))) });
    }
  };
  await walk(packageDir, "");
  return collected;
}
