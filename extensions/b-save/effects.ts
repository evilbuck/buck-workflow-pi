import { Buffer } from "node:buffer";
import { revisionHash } from "../../skills/_shared/storage/adapter-utils.js";
import type { StorageStore } from "../../skills/_shared/storage/contract.js";
import { classifyContextPath, consumerKey, flushConfiguredRetains, readCanonicalArtifact, repairLandedReceipt, scheduleConfiguredRetain, type ConsumerScope } from "../../skills/_shared/storage/consumers.js";
import { resolveConsumerContext, withBoundStore } from "../../skills/_shared/scripts/workflow-state.js";

export type EffectName = "native_memory" | "reindex" | "store_retain";

export type EffectOutcome = {
  name: EffectName;
  outcome: "succeeded" | "failed_nonblocking" | "unsupported" | "skipped";
  detail: string | null;
};

export type MemoryStatus = {
  enabled?: boolean;
  backend?: string;
};

export type MemorySaveResult = {
  stored?: number;
};

export type MemoryCtx = {
  status?: () => MemoryStatus | Promise<MemoryStatus>;
  save?: (payload: unknown) => MemorySaveResult | Promise<MemorySaveResult>;
};

export type EffectsInput = {
  noRetain?: boolean;
  memory?: MemoryCtx | null;
  facts?: unknown;
} & (
  | { patchOps?: undefined; cwd?: string; replayBaseline?: undefined }
  // Supplying patchOps makes cwd required: the durable retain resolves its
  // store from the bound workspace. replayBaseline anchors a recovered replay
  // to the canonical revision each projection replaced; anchors it cannot
  // verify fail closed instead of writing unanchored.
  | { patchOps: RetainOp[]; cwd: string; replayBaseline?: Record<string, string | null>; replayPredecessors?: Record<string, string | null> }
);

/** One applied patch op: a durable .context-relative write (content) or delete (null). */
export type RetainOp = { path: string; content: string | null };

const ALLOWED_SAVE: Record<string, true> = { local: true, mnemopi: true };

async function once<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return await fn();
  }
}

function skipped(name: EffectName, detail: string): EffectOutcome {
  return { name, outcome: "skipped", detail };
}

function unsupported(name: EffectName, detail: string): EffectOutcome {
  return { name, outcome: "unsupported", detail };
}

function failed(name: EffectName, detail: string): EffectOutcome {
  return { name, outcome: "failed_nonblocking", detail };
}

function classifyBackend(status: MemoryStatus): EffectOutcome | null {
  const backend = status.backend ?? "none";
  if (!status.enabled || backend === "off" || backend === "none") {
    return skipped("native_memory", "backend " + backend);
  }
  if (backend === "hindsight") {
    return unsupported("native_memory", "hindsight pre-execution retain is unsupported on OMP 18.1.17");
  }
  if (!ALLOWED_SAVE[backend]) return unsupported("native_memory", "unknown backend " + backend);
  return null;
}

async function saveWithCount(memory: MemoryCtx, facts: unknown, backend: string): Promise<EffectOutcome> {
  try {
    const result = await once(async () => {
      const saved = await memory.save!(facts ?? {});
      if (!saved || typeof saved.stored !== "number" || saved.stored < 1) {
        throw new Error("stored count was " + String(saved?.stored ?? 0));
      }
      return saved;
    });
    return { name: "native_memory", outcome: "succeeded", detail: backend + " stored " + result.stored };
  } catch (error) {
    return failed("native_memory", String(error));
  }
}

export async function deliverNativeMemory(input: EffectsInput): Promise<EffectOutcome> {
  if (input.noRetain) return skipped("native_memory", "--no-retain");
  if (!input.memory?.status || !input.memory.save) {
    return skipped("native_memory", "memory runtime missing");
  }
  try {
    const status = await input.memory.status();
    const classified = classifyBackend(status);
    if (classified) return classified;
    return saveWithCount(input.memory, input.facts, status.backend ?? "none");
  } catch (error) {
    return failed("native_memory", String(error));
  }
}

export async function reindexMemory(): Promise<EffectOutcome> {
  return skipped("reindex", "non-OMP adapter not claimed in this release");
}

/** A patch op that survives delete filtering: always a durable write. */
type RetainWrite = RetainOp & { content: string };

function isRetainWrite(op: RetainOp): op is RetainWrite {
  return op.content !== null;
}

function partitionWrites(patchOps: RetainOp[]): { writes: RetainWrite[]; skippedDeletes: number } {
  const writes: RetainWrite[] = [];
  let skippedDeletes = 0;
  for (const op of patchOps) {
    if (!isRetainWrite(op)) { skippedDeletes += 1; continue; }
    writes.push(op);
  }
  return { writes, skippedDeletes };
}

type ReplayDecision =
  | { action: "schedule"; expectedRevision: string | null }
  | { action: "skip" }
  | { action: "reject"; reason: string };

/**
 * Classify one replayed write against the canonical store. A recovered replay
 * may only replace the revision its journaled projection was produced from:
 * identical bytes are already canonical, the journaled before-image is the
 * only allowed predecessor, and everything else — including a missing anchor —
 * is stale and rejected before a single byte is scheduled.
 */
const SAVE_RETAIN_SCOPE = "b-save";

function contentHash(text: string): string {
  return revisionHash(Buffer.from(text, "utf8"));
}

function missingCanonical(path: string, baseline: string | null, recorded: string | null | undefined): ReplayDecision {
  if (recorded === null) return { action: "schedule", expectedRevision: null };
  if (baseline !== null || recorded) {
    return { action: "reject", reason: "canonical predecessor missing for " + path + "; refusing to recreate a possibly-corrected artifact" };
  }
  return { action: "schedule", expectedRevision: null };
}

function sameBeforeImage(currentSha: string, baseline: string | null): boolean {
  return baseline !== null && currentSha === contentHash(baseline);
}

function rejectAdvanced(path: string): ReplayDecision {
  return { action: "reject", reason: "canonical " + path + " advanced past the recovered projection" };
}

/**
 * Classify one replayed write against the canonical store. A recovered replay
 * may only replace the revision its journaled projection was produced from:
 * identical bytes are already canonical, the journaled before-image is the
 * only allowed predecessor, and everything else — including a missing anchor —
 * is stale and rejected before a single byte is scheduled.
 */
async function classifyReplayWrite(
  store: StorageStore,
  scope: ConsumerScope,
  op: RetainWrite,
  baseline: string | null | undefined,
  recorded: string | null | undefined,
): Promise<ReplayDecision> {
  if (baseline === undefined) return { action: "reject", reason: "no canonical baseline recorded for " + op.path };
  const classified = classifyContextPath(op.path);
  const current = await readCanonicalArtifact(store, consumerKey(scope, classified.kind, classified.subjectId, classified.logicalName));
  if (!current) return missingCanonical(op.path, baseline, recorded);
  if (current.sha256 === contentHash(op.content)) {
    await repairLandedReceipt(store, scope, current.revision);
    return { action: "skip" };
  }
  if (recorded !== undefined) {
    if (current.revision !== recorded) return rejectAdvanced(op.path);
    return { action: "schedule", expectedRevision: current.revision };
  }
  if (sameBeforeImage(current.sha256, baseline)) return { action: "schedule", expectedRevision: current.revision };
  return rejectAdvanced(op.path);
}

type ReplayPlan =
  | { expectedRevisions: Record<string, string | null>; alreadyCanonical: number }
  | { rejection: string };

/** Pre-read the canonical store and decide every replayed write up front, so a stale batch schedules nothing. */
async function planReplayWrites(cwd: string, writes: RetainWrite[], baseline: Record<string, string | null>, predecessors?: Record<string, string | null>): Promise<ReplayPlan> {
  const expected: Record<string, string | null> = {};
  let alreadyCanonical = 0;
  let rejection: string | null = null;
  try {
    const context = await resolveConsumerContext(cwd);
    await withBoundStore(cwd, context, async (store, bound) => {
      const scope: ConsumerScope = {
        projectId: bound.projectId,
        branchId: bound.branchId,
        worktreeId: bound.worktreeId ?? "",
        runId: bound.runId ?? "",
      };
      for (const op of writes) {
        const decision = await classifyReplayWrite(store, scope, op, baseline[op.path], predecessors?.[op.path]);
        if (decision.action === "reject") { rejection ??= decision.reason; return; }
        if (decision.action === "skip") { alreadyCanonical += 1; continue; }
        expected[op.path] = decision.expectedRevision;
      }
    });
  } catch (error) {
    return { rejection: "replay staleness check failed: " + String(error) };
  }
  if (rejection) return { rejection };
  return { expectedRevisions: expected, alreadyCanonical };
}

async function flushAndReport(retained: number, alreadyCanonical: number, skippedDeletes: number): Promise<EffectOutcome> {
  try {
    await flushConfiguredRetains(SAVE_RETAIN_SCOPE);
  } catch (error) {
    return failed("store_retain", String(error));
  }
  const canonical = alreadyCanonical > 0 ? `; ${alreadyCanonical} already canonical` : "";
  return { name: "store_retain", outcome: "succeeded", detail: `retained ${retained} write(s) into the configured store${canonical}; ${skippedDeletes} delete(s) left to lifecycle/corrections` };
}

// --no-retain only skips the native (LTM) mirror below; the store retain is the
// durable save itself and always runs. Deletes cannot be expressed as store
// writes (revisions are append-only; removal is a lifecycle/correction concern),
// so they stay local-only and are reported here rather than silently dropped.
function retainPin(path: string, expected: Record<string, string | null> | null, predecessors?: Record<string, string | null>): { reconcile: false; expectedRevision: string | null } | null {
  const source = expected ?? predecessors ?? null;
  if (!source || !(path in source)) return null;
  return { reconcile: false, expectedRevision: source[path] ?? null };
}

export async function retainPatchToStore(input: EffectsInput & { patchOps: RetainOp[]; cwd: string }): Promise<EffectOutcome> {
  const { writes, skippedDeletes } = partitionWrites(input.patchOps);
  let expectedRevisions: Record<string, string | null> | null = null;
  let alreadyCanonical = 0;
  if (input.replayBaseline) {
    const plan = await planReplayWrites(input.cwd, writes, input.replayBaseline, input.replayPredecessors);
    if ("rejection" in plan) return failed("store_retain", "stale replay rejected: " + plan.rejection);
    expectedRevisions = plan.expectedRevisions;
    alreadyCanonical = plan.alreadyCanonical;
  }
  // Replay planning may have skipped ops as already canonical: only the ops
  // that received a schedule decision may reach the store, and each carries
  // the canonical revision it is allowed to replace. A normal retain uses the
  // predecessor recorded before apply, so a revision committed while effects
  // were in flight is not adopted as the compare-and-set anchor.
  const expected = expectedRevisions;
  const scheduled = expected ? writes.filter((op) => op.path in expected) : writes;
  let retained = 0;
  for (const op of scheduled) {
    const classified = classifyContextPath(op.path);
    const pin = retainPin(op.path, expected, input.replayPredecessors);
    scheduleConfiguredRetain({
      cwd: input.cwd,
      ...classified,
      bytes: Buffer.from(op.content, "utf8"),
      author: "b-save",
      source: "b-save-extension",
      ...(pin ?? {}),
    }, SAVE_RETAIN_SCOPE);
    retained += 1;
  }
  if (retained === 0) {
    if (alreadyCanonical === 0) return skipped("store_retain", "no durable writes in patch");
    return { name: "store_retain", outcome: "succeeded", detail: `already canonical: ${alreadyCanonical} write(s) matched the store; ${skippedDeletes} delete(s) left to lifecycle/corrections` };
  }
  return flushAndReport(retained, alreadyCanonical, skippedDeletes);
}

/** Revision ids the upcoming apply is based on. Null means the artifact was absent. */
export async function canonicalPredecessors(cwd: string, paths: string[]): Promise<Record<string, string | null>> {
  const found: Record<string, string | null> = {};
  const context = await resolveConsumerContext(cwd);
  await withBoundStore(cwd, context, async (store, bound) => {
    const scope: ConsumerScope = {
      projectId: bound.projectId,
      branchId: bound.branchId,
      worktreeId: bound.worktreeId ?? "",
      runId: bound.runId ?? "",
    };
    for (const path of paths) {
      const classified = classifyContextPath(path);
      const current = await readCanonicalArtifact(store, consumerKey(scope, classified.kind, classified.subjectId, classified.logicalName));
      found[path] = current?.revision ?? null;
    }
  });
  return found;
}

export async function runEffects(input: EffectsInput): Promise<EffectOutcome[]> {
  const native = await deliverNativeMemory(input);
  const reindex = await reindexMemory();
  return [native, reindex, ...(input.patchOps ? [await retainPatchToStore(input)] : [])];
}
