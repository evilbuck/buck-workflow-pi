import { randomUUID } from "node:crypto";
import { basename, join } from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { resolveConsumerContext, withBoundStore, withConfiguredStore, type TrustedWorkflowContext } from "../scripts/workflow-state.js";
import { createRunId } from "./identity.js";
import { revisionHash } from "./adapter-utils.js";
import type { ArtifactKind, ArtifactKey, ArtifactRevision, RunReceipt, StorageStore } from "./contract.js";
import { assertReceiptReadback } from "./domain.js";

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
  expectedRevision?: string | null;
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
  receipt: { attemptId: string; status: RunReceipt["status"]; kind?: RunReceipt["kind"]; metadataDuties?: readonly string[]; runId?: string },
): Promise<{ revisions: readonly string[]; receipt: RunReceipt }> {
  const revisions = await Promise.all(writes.map(async (write) => {
    const current = await store.read(consumerKey(scope, write.kind, write.subjectId, write.logicalName));
    return revisionFor(scope, {
      ...write,
      links: write.links ?? current?.links ?? [],
      expectedRevision: write.expectedRevision === undefined ? current?.revision ?? null : write.expectedRevision,
    });
  }));
  const written = await store.writeBatch(revisions);
  await assertBatchReadback(store, revisions, written);
  const stored: RunReceipt = {
    projectId: scope.projectId,
    branchId: scope.branchId,
    worktreeId: scope.worktreeId,
    runId: receipt.runId ?? scope.runId,
    attemptId: receipt.attemptId,
    status: receipt.status,
    artifactRevisions: written.map((item) => item.revision),
    ...(receipt.kind ? { kind: receipt.kind } : {}),
    ...(receipt.metadataDuties ? { metadataDuties: receipt.metadataDuties } : {}),
  };
  await store.writeReceipt(stored);
  const read = await store.readReceipt(scope.projectId, stored.runId);
  if (!read) throw new Error("uncertain persistence blocks save");
  assertReceiptReadback(read, stored);
  if (read.worktreeId !== scope.worktreeId || read.runId !== stored.runId) throw new Error("receipt scope does not match the bound context");
  return { revisions: stored.artifactRevisions, receipt: read };
}

async function assertBatchReadback(store: StorageStore, expected: readonly ArtifactRevision[], written: readonly ArtifactRevision[]): Promise<void> {
  if (written.length !== expected.length) throw new Error("uncertain persistence blocks save");
  for (const revision of expected) {
    const readback = await store.read(revision.key, revision.revision);
    if (!readback || readback.revision !== revision.revision || revisionHash(readback.bytes) !== revision.sha256) throw new Error("uncertain persistence blocks save");
  }
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
    expectedRevision: write.expectedRevision,
  };
}

/** Retain in the bound workspace run; a separate run owns the individual receipt. */
export async function retainConfiguredArtifact(write: ConsumerWrite & { cwd: string }): Promise<string | null> {
  const context = await resolveConsumerContext(write.cwd);
  return retainBoundArtifact(write, context);
}

async function retainBoundArtifact(write: ConsumerWrite & { cwd: string }, context: TrustedWorkflowContext): Promise<string> {
  return withBoundStore(write.cwd, context, async (store) => {
    if (!context.worktreeId || !context.runId) throw new Error("Trusted worktree/run identity is not bound");
    const scope = { ...context, worktreeId: context.worktreeId, runId: context.runId };
    const receiptRun = createRunId();
    await commitConsumerBatch(store, scope, [write], { attemptId: receiptRun, runId: receiptRun, status: "attempted" });
    return context.runId;
  });
}

let retainTail: Promise<void> = Promise.resolve();
let retainFailures: unknown[] = [];

/** Schedule synchronous writers serially; an explicit drain acknowledges accumulated failures. */
export function scheduleConfiguredRetain(write: ConsumerWrite & { cwd: string }): Promise<string | null> {
  // Resolve immediately, not after earlier queued writes finish. Destination and
  // workspace identity are captured before the queue can observe another config.
  const bound = resolveConsumerContext(write.cwd);
  void bound.catch(() => undefined);
  const retained = retainTail.then(async () => retainBoundArtifact(write, await bound));
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
  if (rel.startsWith("memory/")) return { kind: "memory", subjectId: "memory", logicalName: rel.slice("memory/".length) };
  if (rel.startsWith("backlog/")) return { kind: "backlog", subjectId: "backlog", logicalName: rel.slice("backlog/".length) };
  const segments = rel.split("/");
  if (segments.length === 1) return { kind: "audit", subjectId: "save-apply", logicalName: rel };
  const subjectId = segments[0]!;
  const logicalName = segments.slice(1).join("/");
  const name = segments.at(-1)!;
  if (logicalName === "index.md") return { kind: "subject-index", subjectId, logicalName };
  const matched = KIND_BY_FILENAME.find(([pattern]) => pattern.test(name));
  return { kind: matched?.[1] ?? (name.endsWith(".md") ? "capture" : "audit"), subjectId, logicalName };
}

export async function flushConfiguredRetains(): Promise<void> {
  await retainTail;
  const failures = retainFailures;
  retainFailures = [];
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "One or more configured artifact retains failed");
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
