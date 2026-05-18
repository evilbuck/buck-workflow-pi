import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { assign, fromPromise, setup } from "xstate";
import type { ChunkQueueItem, OrchestrationState, WorkerMode } from "./types.js";
import {
  countConsecutiveBlockReasons,
  countConsecutiveIssueFingerprints,
  countConsecutiveNoSourceChangeIterations,
  sourceChangedFiles,
} from "./guards.js";
import { buildQueue } from "./queue-builder.js";
import { readProjection, updateProjection } from "./persistence.js";
import { scanActiveIteratesForSubject } from "./scan-context.js";
import { runWorker, type WorkerResult } from "./worker.js";
import { verifyResult, type VerificationResult } from "./verify-result.js";

const DEFAULT_MAX_ITERATIONS = 5;

interface ChunkQueueContext {
  projectRoot: string;
  subject: string | null;
  goal: string;
  queue: ChunkQueueItem[];
  currentIndex: number;
  currentItem: ChunkQueueItem | null;
  currentMode: WorkerMode | null;
  currentResultFile?: string;
  lastVerification: VerificationResult | null;
  activeIteratePath?: string;
  activeIterateConflict?: { files: string[]; phase: string };
  activeIteration: number;
  maxIterations: number;
  issueFingerprint?: string;
  workerPid?: number;
  lastError?: string;
  blockReason?: string;
}

type ChunkQueueEvent = { type: "START_QUEUE" };

export interface ChunkQueueOutput {
  queue: ChunkQueueItem[];
  blocked?: { chunkId: string; reason: string };
  error?: string;
  active?: OrchestrationState["active"];
  lastWorkerStatus?: string;
}

interface ChunkQueueMachineDeps {
  buildQueue?: (projectRoot: string, subject: string | null) => ChunkQueueItem[];
  runWorker?: (
    chunk: ChunkQueueItem,
    options: {
      projectRoot: string;
      subject: string | null;
      goal: string;
      mode?: WorkerMode;
      inputPath?: string;
      difficulty?: ChunkQueueItem["difficulty"];
    },
  ) => Promise<WorkerResult>;
  verifyResult?: (resultFile: string) => VerificationResult;
  readProjection?: (projectRoot: string) => OrchestrationState | null;
  persistProjection?: (
    projectRoot: string,
    updater: (state: OrchestrationState) => OrchestrationState,
    fallback?: Partial<OrchestrationState>,
  ) => OrchestrationState;
}

function buildActiveProjection(
  context: ChunkQueueContext,
): OrchestrationState["active"] | undefined {
  if (!context.currentItem || !context.currentMode) return undefined;
  return {
    chunkId: context.currentItem.id,
    phasePath: context.currentItem.type === "phase" ? context.currentItem.path : undefined,
    step: context.currentMode,
    iteration: context.activeIteration,
    maxIterations: context.maxIterations,
    workerPid: context.workerPid,
    lastResultFile: context.currentResultFile,
    issueFingerprint: context.issueFingerprint,
  };
}

function replaceCurrentItem(context: ChunkQueueContext, next: ChunkQueueItem | null): ChunkQueueItem | null {
  if (next && context.currentIndex >= 0) {
    context.queue[context.currentIndex] = next;
  }
  return next;
}

function frontmatterValue(path: string, key: string): string | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const raw = readFileSync(path, "utf-8");
    const match = raw.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return match?.[1]?.trim();
  } catch {
    return undefined;
  }
}

function phaseCompleted(path: string): boolean {
  return frontmatterValue(path, "status") === "completed";
}

function activeIterateStatus(path: string | undefined): string | undefined {
  if (!path) return undefined;
  return frontmatterValue(path, "status");
}

function mergePersistedQueue(
  queue: ChunkQueueItem[],
  persistedQueue: ChunkQueueItem[] | undefined,
): ChunkQueueItem[] {
  const persistedById = new Map((persistedQueue ?? []).map((item) => [item.id, item]));
  return queue.map((item) => {
    const persisted = persistedById.get(item.id);
    if (!persisted) return item;
    return {
      ...item,
      workerAttempts: Math.max(item.workerAttempts, persisted.workerAttempts ?? 0),
      lastAttemptAt: persisted.lastAttemptAt ?? item.lastAttemptAt,
      lastResultFile: persisted.lastResultFile ?? item.lastResultFile,
      iterations: persisted.iterations ?? item.iterations,
      blockReasonHistory: persisted.blockReasonHistory ?? item.blockReasonHistory,
    };
  });
}

function readGitSourceChanges(projectRoot: string): string[] {
  try {
    const result = spawnSync("git", ["status", "--porcelain"], {
      cwd: projectRoot,
      encoding: "utf-8",
    });
    if (result.status !== 0) return [];
    return sourceChangedFiles(
      String(result.stdout ?? "")
        .split("\n")
        .map((line) => line.slice(3).trim())
        .filter(Boolean),
    );
  } catch {
    return [];
  }
}

function phaseBoundaryReason(
  projectRoot: string,
  context: ChunkQueueContext,
  verifyImpl: (resultFile: string) => VerificationResult,
  readProjectionImpl?: ChunkQueueMachineDeps["readProjection"],
): string | undefined {
  const currentItem = context.currentItem;
  if (!currentItem || context.currentMode !== "build") return undefined;

  const projection = (readProjectionImpl ?? readProjection)(projectRoot);
  if (projection?.active?.chunkId === currentItem.id) return undefined;
  if (context.currentIndex <= 0) return undefined;

  const changedSourceFiles = readGitSourceChanges(projectRoot);
  if (changedSourceFiles.length === 0) return undefined;

  const previousCompleted = [...context.queue.slice(0, context.currentIndex)]
    .reverse()
    .find((item) => item.status === "completed" || item.status === "completed_with_warnings");
  if (!previousCompleted?.lastResultFile) {
    return `Phase boundary blocked before ${currentItem.id}: source changes exist but the previous completed phase has no result file for attribution`;
  }

  const verification = verifyImpl(previousCompleted.lastResultFile);
  const allowed = new Set(sourceChangedFiles(verification.changedFiles));
  const unexpected = changedSourceFiles.filter((file) => !allowed.has(file));
  if (unexpected.length > 0) {
    return `Phase boundary blocked before ${currentItem.id}: source changes are not attributed to ${previousCompleted.id} (${unexpected.join(", ")})`;
  }

  return undefined;
}

function nextRepeatedReasonMessage(
  currentItem: ChunkQueueItem | null,
  reason: string,
): string {
  const repeats = countConsecutiveBlockReasons(currentItem?.blockReasonHistory, reason) + 1;
  if (repeats >= 3) {
    return `Repeated blocking reason ${repeats} times: ${reason}`;
  }
  return reason;
}

function appendBlockReason(
  currentItem: ChunkQueueItem | null,
  reason: string,
): ChunkQueueItem | null {
  if (!currentItem) return null;
  return {
    ...currentItem,
    blockReasonHistory: [...(currentItem.blockReasonHistory ?? []), reason],
  };
}

function stagnationReason(context: ChunkQueueContext): string | undefined {
  const currentItem = context.currentItem;
  const review = context.lastVerification?.review;
  if (!currentItem || !review) return undefined;

  const nextIteration = context.activeIteration + 1;
  if (nextIteration > context.maxIterations) {
    return `Max iterations reached for ${currentItem.id} (${context.maxIterations})`;
  }

  const repeatedFingerprintCount = countConsecutiveIssueFingerprints(
    currentItem.iterations,
    review.issueFingerprint,
  );
  if (review.issueFingerprint && repeatedFingerprintCount >= 3) {
    return `Stagnation: issue fingerprint ${review.issueFingerprint} persisted across ${repeatedFingerprintCount} iterate passes`;
  }

  const noChangeIterations = countConsecutiveNoSourceChangeIterations(currentItem.iterations);
  if (noChangeIterations >= 2) {
    return `Stagnation: the last ${noChangeIterations} iterate passes completed without source changes`;
  }

  if (context.activeIterateConflict?.files?.length) {
    return `Multiple active iterate artifacts matched this phase: ${context.activeIterateConflict.files.join(", ")}`;
  }

  return undefined;
}

function findUnfinishedAudit(
  projectRoot: string,
  subject: string | null,
  chunkId: string,
): string | undefined {
  const auditDir = subject
    ? join(projectRoot, ".context", subject, "worker-audits")
    : join(projectRoot, ".context", "workflow", "worker-audits");

  if (!existsSync(auditDir)) return undefined;

  try {
    const files = readdirSync(auditDir)
      .filter((f) => f.endsWith("-audit.json"))
      .sort()
      .reverse();

    for (const file of files) {
      const raw = readFileSync(join(auditDir, file), "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed.chunkId !== chunkId) continue;
      if (parsed.completedAt) return undefined;
      const resultFile = typeof parsed.resultFile === "string" ? parsed.resultFile : undefined;
      if (resultFile && existsSync(resultFile)) return undefined;
      const mode = typeof parsed.mode === "string" ? parsed.mode : "worker";
      return `Found unfinished ${mode} audit for ${chunkId} without a matching result file`;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function verifyOrFail(
  resultFile: string | undefined,
  chunkId: string,
  verifyImpl: (resultFile: string) => VerificationResult,
): VerificationResult {
  if (!resultFile) {
    return {
      type: "CHUNK_FAILED",
      chunkId,
      status: "failed",
      reason: "Worker completed without a result file",
    };
  }
  return verifyImpl(resultFile);
}

function reviewBlockReason(context: ChunkQueueContext): string {
  const verification = context.lastVerification;
  if (!verification) return "Review result missing";
  if (verification.type === "CHUNK_FAILED" || verification.type === "CHUNK_BLOCKED") {
    return verification.reason ?? "Review failed";
  }
  if (!verification.review) {
    return "Review result missing review metadata";
  }
  if (context.activeIterateConflict?.files?.length) {
    return `Multiple active iterate artifacts matched this phase: ${context.activeIterateConflict.files.join(", ")}`;
  }
  if (verification.review.outcome === "requires-replan") {
    return "Review requires replan";
  }
  if (verification.review.outcome === "blocking") {
    return verification.review.parseError ?? "Review result was inconsistent or blocking";
  }
  if (verification.review.outcome === "issues-with-iterate" && !verification.review.iterateFile && !context.activeIteratePath) {
    return "Review found issues but no iterate artifact was available";
  }
  return "Review blocked";
}

function persistLifecycleProjection(
  context: ChunkQueueContext,
  persistImpl: ChunkQueueMachineDeps["persistProjection"],
) {
  const fallback: Partial<OrchestrationState> = {
    version: 1,
    goal: context.goal,
    currentState: "executingChunks",
    subject: context.subject,
    queue: context.queue,
    workerAttemptCount: context.queue.reduce((sum, item) => sum + item.workerAttempts, 0),
  };

  (persistImpl ?? updateProjection)(
    context.projectRoot,
    (state) => ({
      ...state,
      goal: state.goal || context.goal,
      subject: context.subject ?? state.subject,
      currentState: "executingChunks",
      updatedAt: new Date().toISOString(),
      queue: context.queue,
      workerAttemptCount: context.queue.reduce((sum, item) => sum + item.workerAttempts, 0),
      lastWorkerStatus: context.currentItem?.status ?? state.lastWorkerStatus,
      active: buildActiveProjection(context),
    }),
    fallback,
  );
}

function reconcileCurrentItem(
  context: ChunkQueueContext,
  readProjectionImpl: ChunkQueueMachineDeps["readProjection"],
  verifyImpl: (resultFile: string) => VerificationResult,
): Partial<ChunkQueueContext> {
  const currentItem = context.currentItem;
  if (!currentItem) {
    return { blockReason: "No chunk selected" };
  }

  if (currentItem.type === "phase" && phaseCompleted(currentItem.path)) {
    return {
      currentItem: replaceCurrentItem(context, { ...currentItem, status: "completed" }),
      currentMode: null,
      currentResultFile: undefined,
      lastVerification: null,
      blockReason: undefined,
    };
  }

  const unfinishedAudit = findUnfinishedAudit(context.projectRoot, context.subject, currentItem.id);
  if (unfinishedAudit) {
    return { blockReason: unfinishedAudit };
  }

  const projection = (readProjectionImpl ?? readProjection)(context.projectRoot);
  const active = projection?.active;
  if (!active || active.chunkId !== currentItem.id) {
    return { blockReason: undefined };
  }

  if (!active.lastResultFile) {
    return {
      currentMode: active.step,
      currentResultFile: undefined,
      lastVerification: null,
      activeIteration: active.iteration ?? context.activeIteration,
      issueFingerprint: active.issueFingerprint,
      workerPid: active.workerPid,
      blockReason: undefined,
    };
  }

  if (!existsSync(active.lastResultFile)) {
    return {
      blockReason: `Projection referenced missing result file: ${active.lastResultFile}`,
    };
  }

  const verification = verifyImpl(active.lastResultFile);
  if (verification.mode && verification.mode !== active.step) {
    return {
      currentMode: active.step,
      currentResultFile: undefined,
      lastVerification: null,
      activeIteration: active.iteration ?? context.activeIteration,
      issueFingerprint: active.issueFingerprint,
      workerPid: active.workerPid,
      blockReason: undefined,
    };
  }

  return {
    currentMode: active.step,
    currentResultFile: active.lastResultFile,
    lastVerification: verification,
    activeIteration: active.iteration ?? context.activeIteration,
    issueFingerprint: active.issueFingerprint,
    workerPid: active.workerPid,
    blockReason: undefined,
  };
}

export function createChunkQueueMachine(
  projectRoot: string,
  subject: string | null,
  goal: string,
  deps: ChunkQueueMachineDeps = {},
) {
  const buildQueueImpl = deps.buildQueue ?? buildQueue;
  const runWorkerImpl = deps.runWorker ?? runWorker;
  const verifyImpl = deps.verifyResult ?? verifyResult;
  const persistImpl = deps.persistProjection;
  const readProjectionImpl = deps.readProjection;

  return setup({
    types: {
      context: {} as ChunkQueueContext,
      events: {} as ChunkQueueEvent,
      output: {} as ChunkQueueOutput,
    },
    actors: {
      buildQueue: fromPromise(() => Promise.resolve(buildQueueImpl(projectRoot, subject))),
      runWorker: fromPromise(({ input }: { input: { chunk: ChunkQueueItem; mode: WorkerMode; inputPath?: string } }) =>
        runWorkerImpl(input.chunk, {
          projectRoot,
          subject,
          goal,
          mode: input.mode,
          inputPath: input.inputPath,
          difficulty: input.chunk.difficulty,
          onSpawn: ({ pid }) => {
            (persistImpl ?? updateProjection)(
              projectRoot,
              (state) => ({
                ...state,
                active: state.active
                  ? { ...state.active, workerPid: pid }
                  : state.active,
                updatedAt: new Date().toISOString(),
              }),
            );
          },
        })),
    },
    guards: {
      hasNextPending: ({ context }) => context.queue.some((item) => item.status === "pending"),
      hasRecoveredBuildResult: ({ context }) => context.currentMode === "build" && !!context.lastVerification,
      hasRecoveredReviewResult: ({ context }) => context.currentMode === "review" && !!context.lastVerification,
      hasRecoveredIterateResult: ({ context }) => context.currentMode === "iterate" && !!context.lastVerification,
      hasRecoveredSaveResult: ({ context }) => context.currentMode === "save" && !!context.lastVerification,
      needsReviewRecoveryRun: ({ context }) => context.currentMode === "review" && !context.lastVerification,
      needsIterateRecoveryRun: ({ context }) => context.currentMode === "iterate" && !context.lastVerification,
      needsSaveRecoveryRun: ({ context }) => context.currentMode === "save" && !context.lastVerification,
      hasRecoveryBlock: ({ context }) => !!context.blockReason,
      currentChunkCompleted: ({ context }) => context.currentItem?.status === "completed",
      buildBlocked: ({ context }) => {
        const verification = context.lastVerification;
        return verification?.type === "CHUNK_FAILED" || verification?.type === "CHUNK_BLOCKED";
      },
      reviewBlocked: ({ context }) => {
        const verification = context.lastVerification;
        if (!verification) return true;
        if (verification.type === "CHUNK_FAILED" || verification.type === "CHUNK_BLOCKED") return true;
        if (!verification.review) return true;
        return verification.review.outcome === "requires-replan" || verification.review.outcome === "blocking";
      },
      reviewPasses: ({ context }) => context.lastVerification?.review?.outcome === "pass",
      reviewNeedsIterate: ({ context }) => context.lastVerification?.review?.outcome === "issues-with-iterate",
      iterateBlocked: ({ context }) => {
        const verification = context.lastVerification;
        return verification?.type === "CHUNK_FAILED" || verification?.type === "CHUNK_BLOCKED";
      },
      saveBlocked: ({ context }) => {
        const verification = context.lastVerification;
        if (!verification) return true;
        if (verification.type === "CHUNK_FAILED" || verification.type === "CHUNK_BLOCKED") return true;
        if (context.currentItem?.type === "phase") {
          return !phaseCompleted(context.currentItem.path);
        }
        return false;
      },
    },
  }).createMachine({
    id: "chunk-queue",
    initial: "idle",
    context: {
      projectRoot,
      subject,
      goal,
      queue: [],
      currentIndex: -1,
      currentItem: null,
      currentMode: null,
      currentResultFile: undefined,
      lastVerification: null,
      activeIteratePath: undefined,
      activeIterateConflict: undefined,
      activeIteration: 0,
      maxIterations: DEFAULT_MAX_ITERATIONS,
      issueFingerprint: undefined,
      workerPid: undefined,
      blockReason: undefined,
      lastError: undefined,
    },
    states: {
      idle: {
        always: "buildingQueue",
        on: {
          START_QUEUE: "buildingQueue",
        },
      },

      buildingQueue: {
        invoke: {
          src: "buildQueue",
          onDone: [
            {
              guard: ({ event }) => (event.output as ChunkQueueItem[]).length > 0,
              target: "selectingNext",
              actions: assign({
                queue: ({ event }) => {
                  const built = event.output as ChunkQueueItem[];
                  const persisted = (readProjectionImpl ?? readProjection)(projectRoot)?.queue;
                  return mergePersistedQueue(built, persisted);
                },
              }),
            },
            {
              target: "queueExhausted",
            },
          ],
          onError: {
            target: "blockedPhase",
            actions: assign({
              lastError: ({ event }) =>
                event.error instanceof Error ? event.error.message : String(event.error),
              blockReason: ({ event }) =>
                event.error instanceof Error ? event.error.message : String(event.error),
            }),
          },
        },
      },

      selectingNext: {
        always: [
          {
            guard: "hasNextPending",
            target: "checkingPhaseBoundarySafety",
            actions: assign({
              currentItem: ({ context }) => {
                const index = context.queue.findIndex((item) => item.status === "pending");
                if (index < 0) return null;
                context.currentIndex = index;
                const next = { ...context.queue[index], status: "in-progress" as const };
                context.queue[index] = next;
                return next;
              },
              currentIndex: ({ context }) => context.currentIndex,
              currentMode: () => "build" as WorkerMode,
              currentResultFile: () => undefined,
              lastVerification: () => null,
              activeIteratePath: () => undefined,
              activeIterateConflict: () => undefined,
              activeIteration: () => 0,
              issueFingerprint: () => undefined,
              workerPid: () => undefined,
              blockReason: () => undefined,
              lastError: () => undefined,
            }),
          },
          {
            target: "queueExhausted",
          },
        ],
      },

      checkingPhaseBoundarySafety: {
        entry: [
          assign(({ context }) => {
            const reconciled = reconcileCurrentItem(context, readProjectionImpl, verifyImpl);
            const activeIterateScan = subject
              ? scanActiveIteratesForSubject(projectRoot, subject)
              : null;
            const nextContext = {
              ...context,
              currentItem: reconciled.currentItem ?? context.currentItem,
              currentMode: reconciled.currentMode ?? context.currentMode,
              currentResultFile: reconciled.currentResultFile,
              lastVerification: reconciled.lastVerification ?? context.lastVerification,
              activeIteration: reconciled.activeIteration ?? context.activeIteration,
              issueFingerprint: reconciled.issueFingerprint,
              workerPid: reconciled.workerPid ?? context.workerPid,
              activeIteratePath: activeIterateScan?.active?.path ?? context.activeIteratePath,
              activeIterateConflict: activeIterateScan?.conflict,
              blockReason: reconciled.blockReason,
            };
            return {
              currentItem: nextContext.currentItem,
              currentMode: nextContext.currentMode,
              currentResultFile: nextContext.currentResultFile,
              lastVerification: nextContext.lastVerification,
              activeIteration: nextContext.activeIteration,
              issueFingerprint: nextContext.issueFingerprint,
              workerPid: nextContext.workerPid,
              activeIteratePath: nextContext.activeIteratePath,
              activeIterateConflict: nextContext.activeIterateConflict,
              blockReason:
                nextContext.blockReason ??
                (((nextContext.currentMode === "iterate" || nextContext.currentMode === "review") && nextContext.activeIterateConflict?.files?.length)
                  ? `Multiple active iterate artifacts matched this phase: ${nextContext.activeIterateConflict.files.join(", ")}`
                  : undefined) ??
                phaseBoundaryReason(projectRoot, nextContext, verifyImpl, readProjectionImpl),
            };
          }),
          ({ context }) => persistLifecycleProjection(context, persistImpl),
        ],
        always: [
          {
            guard: "currentChunkCompleted",
            target: "phaseComplete",
          },
          {
            guard: "hasRecoveryBlock",
            target: "blockedPhase",
          },
          {
            guard: "hasRecoveredBuildResult",
            target: "processingBuildResult",
          },
          {
            guard: "hasRecoveredReviewResult",
            target: "processingReviewResult",
          },
          {
            guard: "hasRecoveredIterateResult",
            target: "processingIterateResult",
          },
          {
            guard: "hasRecoveredSaveResult",
            target: "processingSaveResult",
          },
          {
            guard: "needsReviewRecoveryRun",
            target: "reviewingPhase",
          },
          {
            guard: "needsIterateRecoveryRun",
            target: "iteratingPhase",
          },
          {
            guard: "needsSaveRecoveryRun",
            target: "savingPhase",
          },
          {
            target: "buildingPhase",
          },
        ],
      },

      buildingPhase: {
        entry: ({ context }) => persistLifecycleProjection(context, persistImpl),
        invoke: {
          src: "runWorker",
          input: ({ context }) => ({
            chunk: context.currentItem!,
            mode: "build" as WorkerMode,
          }),
          onDone: [
            {
              guard: ({ event }) => (event.output as WorkerResult).type === "WORKER_COMPLETED",
              target: "processingBuildResult",
              actions: assign({
                currentMode: () => "build" as WorkerMode,
                workerPid: () => undefined,
                currentResultFile: ({ event }) => (event.output as WorkerResult).resultFile,
                lastVerification: ({ context, event }) =>
                  verifyOrFail((event.output as WorkerResult).resultFile, context.currentItem?.id ?? "unknown", verifyImpl),
                currentItem: ({ context, event }) => {
                  if (!context.currentItem) return null;
                  const next = {
                    ...context.currentItem,
                    workerAttempts: context.currentItem.workerAttempts + 1,
                    lastAttemptAt: new Date().toISOString(),
                    lastResultFile: (event.output as WorkerResult).resultFile,
                  };
                  return replaceCurrentItem(context, next);
                },
              }),
            },
            {
              target: "blockedPhase",
              actions: assign({
                workerPid: () => undefined,
                currentItem: ({ context, event }) => {
                  const reason = nextRepeatedReasonMessage(
                    context.currentItem,
                    (event.output as WorkerResult).error ?? "Build worker failed",
                  );
                  return context.currentItem
                    ? replaceCurrentItem(
                        context,
                        appendBlockReason({ ...context.currentItem, status: "failed" }, reason)!,
                      )
                    : null;
                },
                blockReason: ({ context, event }) =>
                  nextRepeatedReasonMessage(context.currentItem, (event.output as WorkerResult).error ?? "Build worker failed"),
                lastError: ({ context, event }) =>
                  nextRepeatedReasonMessage(context.currentItem, (event.output as WorkerResult).error ?? "Build worker failed"),
              }),
            },
          ],
        },
      },

      processingBuildResult: {
        entry: ({ context }) => persistLifecycleProjection(context, persistImpl),
        always: [
          {
            guard: "buildBlocked",
            target: "blockedPhase",
            actions: assign({
              currentItem: ({ context }) => {
                const reason = nextRepeatedReasonMessage(
                  context.currentItem,
                  context.lastVerification?.reason ?? "Build verification failed",
                );
                return context.currentItem
                  ? replaceCurrentItem(
                      context,
                      appendBlockReason({ ...context.currentItem, status: "blocked" }, reason)!,
                    )
                  : null;
              },
              blockReason: ({ context }) =>
                nextRepeatedReasonMessage(context.currentItem, context.lastVerification?.reason ?? "Build verification failed"),
              lastError: ({ context }) =>
                nextRepeatedReasonMessage(context.currentItem, context.lastVerification?.reason ?? "Build verification failed"),
            }),
          },
          {
            target: "reviewingPhase",
            actions: assign({
              currentMode: () => "review" as WorkerMode,
              currentResultFile: () => undefined,
              lastVerification: () => null,
              blockReason: () => undefined,
            }),
          },
        ],
      },

      reviewingPhase: {
        entry: ({ context }) => persistLifecycleProjection(context, persistImpl),
        invoke: {
          src: "runWorker",
          input: ({ context }) => ({
            chunk: context.currentItem!,
            mode: "review" as WorkerMode,
            inputPath: context.currentItem?.path,
          }),
          onDone: [
            {
              guard: ({ event }) => (event.output as WorkerResult).type === "WORKER_COMPLETED",
              target: "processingReviewResult",
              actions: assign({
                currentMode: () => "review" as WorkerMode,
                workerPid: () => undefined,
                currentResultFile: ({ event }) => (event.output as WorkerResult).resultFile,
                lastVerification: ({ context, event }) =>
                  verifyOrFail((event.output as WorkerResult).resultFile, context.currentItem?.id ?? "unknown", verifyImpl),
                activeIteratePath: ({ context, event }) => {
                  const review = verifyOrFail(
                    (event.output as WorkerResult).resultFile,
                    context.currentItem?.id ?? "unknown",
                    verifyImpl,
                  ).review;
                  return review?.iterateFile ?? context.activeIteratePath;
                },
                issueFingerprint: ({ context, event }) => {
                  const review = verifyOrFail(
                    (event.output as WorkerResult).resultFile,
                    context.currentItem?.id ?? "unknown",
                    verifyImpl,
                  ).review;
                  return review?.issueFingerprint ?? context.issueFingerprint;
                },
                currentItem: ({ context, event }) => {
                  if (!context.currentItem) return null;
                  const next = {
                    ...context.currentItem,
                    workerAttempts: context.currentItem.workerAttempts + 1,
                    lastAttemptAt: new Date().toISOString(),
                    lastResultFile: (event.output as WorkerResult).resultFile,
                  };
                  return replaceCurrentItem(context, next);
                },
              }),
            },
            {
              target: "blockedPhase",
              actions: assign({
                workerPid: () => undefined,
                currentItem: ({ context, event }) => {
                  const reason = nextRepeatedReasonMessage(
                    context.currentItem,
                    (event.output as WorkerResult).error ?? "Review worker failed",
                  );
                  return context.currentItem
                    ? replaceCurrentItem(
                        context,
                        appendBlockReason({ ...context.currentItem, status: "failed" }, reason)!,
                      )
                    : null;
                },
                blockReason: ({ context, event }) =>
                  nextRepeatedReasonMessage(context.currentItem, (event.output as WorkerResult).error ?? "Review worker failed"),
                lastError: ({ context, event }) =>
                  nextRepeatedReasonMessage(context.currentItem, (event.output as WorkerResult).error ?? "Review worker failed"),
              }),
            },
          ],
        },
      },

      processingReviewResult: {
        entry: ({ context }) => persistLifecycleProjection(context, persistImpl),
        always: [
          {
            guard: "reviewBlocked",
            target: "blockedPhase",
            actions: assign({
              currentItem: ({ context }) => {
                const reason = nextRepeatedReasonMessage(context.currentItem, reviewBlockReason(context));
                return context.currentItem
                  ? replaceCurrentItem(
                      context,
                      appendBlockReason({ ...context.currentItem, status: "blocked" }, reason)!,
                    )
                  : null;
              },
              blockReason: ({ context }) => nextRepeatedReasonMessage(context.currentItem, reviewBlockReason(context)),
              lastError: ({ context }) => nextRepeatedReasonMessage(context.currentItem, reviewBlockReason(context)),
            }),
          },
          {
            guard: ({ context }) => context.lastVerification?.review?.outcome === "issues-with-iterate" && !!stagnationReason(context),
            target: "blockedPhase",
            actions: assign({
              currentItem: ({ context }) => {
                const reason = nextRepeatedReasonMessage(context.currentItem, stagnationReason(context) ?? "Stagnation detected");
                return context.currentItem
                  ? replaceCurrentItem(
                      context,
                      appendBlockReason({ ...context.currentItem, status: "blocked" }, reason)!,
                    )
                  : null;
              },
              blockReason: ({ context }) => nextRepeatedReasonMessage(context.currentItem, stagnationReason(context) ?? "Stagnation detected"),
              lastError: ({ context }) => nextRepeatedReasonMessage(context.currentItem, stagnationReason(context) ?? "Stagnation detected"),
            }),
          },
          {
            guard: "reviewNeedsIterate",
            target: "iteratingPhase",
            actions: assign({
              activeIteration: ({ context }) => context.activeIteration + 1,
              currentMode: () => "iterate" as WorkerMode,
              currentResultFile: () => undefined,
              lastVerification: () => null,
              activeIteratePath: ({ context }) =>
                context.lastVerification?.review?.iterateFile ?? context.activeIteratePath,
              issueFingerprint: ({ context }) =>
                context.lastVerification?.review?.issueFingerprint ?? context.issueFingerprint,
              currentItem: ({ context }) => {
                if (!context.currentItem) return null;
                const nextIteration = context.activeIteration + 1;
                const next = {
                  ...context.currentItem,
                  iterations: [
                    ...(context.currentItem.iterations ?? []),
                    {
                      iteration: nextIteration,
                      startedAt: new Date().toISOString(),
                      status: "in-progress",
                      issueFingerprint: context.lastVerification?.review?.issueFingerprint,
                    },
                  ],
                };
                return replaceCurrentItem(context, next);
              },
              activeIterateConflict: ({ context }) => context.activeIterateConflict,
            }),
          },
          {
            guard: "reviewPasses",
            target: "savingPhase",
            actions: assign({
              currentMode: () => "save" as WorkerMode,
              currentResultFile: () => undefined,
              lastVerification: () => null,
              blockReason: () => undefined,
            }),
          },
          {
            target: "blockedPhase",
            actions: assign({
              currentItem: ({ context }) => {
                const reason = nextRepeatedReasonMessage(context.currentItem, "Review returned an unsupported routing outcome");
                return context.currentItem
                  ? replaceCurrentItem(
                      context,
                      appendBlockReason({ ...context.currentItem, status: "blocked" }, reason)!,
                    )
                  : null;
              },
              blockReason: ({ context }) => nextRepeatedReasonMessage(context.currentItem, "Review returned an unsupported routing outcome"),
              lastError: ({ context }) => nextRepeatedReasonMessage(context.currentItem, "Review returned an unsupported routing outcome"),
            }),
          },
        ],
      },

      iteratingPhase: {
        entry: ({ context }) => persistLifecycleProjection(context, persistImpl),
        invoke: {
          src: "runWorker",
          input: ({ context }) => ({
            chunk: context.currentItem!,
            mode: "iterate" as WorkerMode,
            inputPath: context.activeIteratePath,
          }),
          onDone: [
            {
              guard: ({ event }) => (event.output as WorkerResult).type === "WORKER_COMPLETED",
              target: "processingIterateResult",
              actions: assign({
                currentMode: () => "iterate" as WorkerMode,
                workerPid: () => undefined,
                currentResultFile: ({ event }) => (event.output as WorkerResult).resultFile,
                lastVerification: ({ context, event }) =>
                  verifyOrFail((event.output as WorkerResult).resultFile, context.currentItem?.id ?? "unknown", verifyImpl),
                currentItem: ({ context, event }) => {
                  if (!context.currentItem) return null;
                  const verification = verifyOrFail(
                    (event.output as WorkerResult).resultFile,
                    context.currentItem.id,
                    verifyImpl,
                  );
                  const iterations = [...(context.currentItem.iterations ?? [])];
                  if (iterations.length > 0) {
                    iterations[iterations.length - 1] = {
                      ...iterations[iterations.length - 1],
                      completedAt: new Date().toISOString(),
                      resultFile: (event.output as WorkerResult).resultFile,
                      status: verification.status,
                      changedFiles: verification.changedFiles,
                    };
                  }
                  const next = {
                    ...context.currentItem,
                    workerAttempts: context.currentItem.workerAttempts + 1,
                    lastAttemptAt: new Date().toISOString(),
                    lastResultFile: (event.output as WorkerResult).resultFile,
                    iterations,
                  };
                  return replaceCurrentItem(context, next);
                },
              }),
            },
            {
              target: "blockedPhase",
              actions: assign({
                workerPid: () => undefined,
                currentItem: ({ context, event }) => {
                  if (!context.currentItem) return null;
                  const reason = nextRepeatedReasonMessage(
                    context.currentItem,
                    (event.output as WorkerResult).error ?? "Iterate worker failed",
                  );
                  const iterations = [...(context.currentItem.iterations ?? [])];
                  if (iterations.length > 0) {
                    iterations[iterations.length - 1] = {
                      ...iterations[iterations.length - 1],
                      completedAt: new Date().toISOString(),
                      status: "failed",
                    };
                  }
                  return replaceCurrentItem(context, appendBlockReason({
                    ...context.currentItem,
                    status: "failed",
                    iterations,
                  }, reason)!);
                },
                blockReason: ({ context, event }) =>
                  nextRepeatedReasonMessage(context.currentItem, (event.output as WorkerResult).error ?? "Iterate worker failed"),
                lastError: ({ context, event }) =>
                  nextRepeatedReasonMessage(context.currentItem, (event.output as WorkerResult).error ?? "Iterate worker failed"),
              }),
            },
          ],
        },
      },

      processingIterateResult: {
        entry: ({ context }) => persistLifecycleProjection(context, persistImpl),
        always: [
          {
            guard: "iterateBlocked",
            target: "blockedPhase",
            actions: assign({
              currentItem: ({ context }) => {
                const reason = nextRepeatedReasonMessage(
                  context.currentItem,
                  context.lastVerification?.reason ?? "Iterate verification failed",
                );
                return context.currentItem
                  ? replaceCurrentItem(
                      context,
                      appendBlockReason({ ...context.currentItem, status: "blocked" }, reason)!,
                    )
                  : null;
              },
              blockReason: ({ context }) =>
                nextRepeatedReasonMessage(context.currentItem, context.lastVerification?.reason ?? "Iterate verification failed"),
              lastError: ({ context }) =>
                nextRepeatedReasonMessage(context.currentItem, context.lastVerification?.reason ?? "Iterate verification failed"),
            }),
          },
          {
            guard: ({ context }) => activeIterateStatus(context.activeIteratePath) === "active",
            target: "blockedPhase",
            actions: assign({
              currentItem: ({ context }) => {
                const reason = nextRepeatedReasonMessage(
                  context.currentItem,
                  `Iterate artifact did not advance status after worker completion: ${context.activeIteratePath}`,
                );
                return context.currentItem
                  ? replaceCurrentItem(
                      context,
                      appendBlockReason({ ...context.currentItem, status: "blocked" }, reason)!,
                    )
                  : null;
              },
              blockReason: ({ context }) =>
                nextRepeatedReasonMessage(
                  context.currentItem,
                  `Iterate artifact did not advance status after worker completion: ${context.activeIteratePath}`,
                ),
              lastError: ({ context }) =>
                nextRepeatedReasonMessage(
                  context.currentItem,
                  `Iterate artifact did not advance status after worker completion: ${context.activeIteratePath}`,
                ),
            }),
          },
          {
            target: "reviewingPhase",
            actions: assign({
              currentMode: () => "review" as WorkerMode,
              currentResultFile: () => undefined,
              lastVerification: () => null,
              blockReason: () => undefined,
            }),
          },
        ],
      },

      savingPhase: {
        entry: ({ context }) => persistLifecycleProjection(context, persistImpl),
        invoke: {
          src: "runWorker",
          input: ({ context }) => ({
            chunk: context.currentItem!,
            mode: "save" as WorkerMode,
            inputPath: context.currentItem?.path,
          }),
          onDone: [
            {
              guard: ({ event }) => (event.output as WorkerResult).type === "WORKER_COMPLETED",
              target: "processingSaveResult",
              actions: assign({
                currentMode: () => "save" as WorkerMode,
                workerPid: () => undefined,
                currentResultFile: ({ event }) => (event.output as WorkerResult).resultFile,
                lastVerification: ({ context, event }) =>
                  verifyOrFail((event.output as WorkerResult).resultFile, context.currentItem?.id ?? "unknown", verifyImpl),
                currentItem: ({ context, event }) => {
                  if (!context.currentItem) return null;
                  const next = {
                    ...context.currentItem,
                    workerAttempts: context.currentItem.workerAttempts + 1,
                    lastAttemptAt: new Date().toISOString(),
                    lastResultFile: (event.output as WorkerResult).resultFile,
                  };
                  return replaceCurrentItem(context, next);
                },
              }),
            },
            {
              target: "blockedPhase",
              actions: assign({
                workerPid: () => undefined,
                currentItem: ({ context, event }) => {
                  const reason = nextRepeatedReasonMessage(
                    context.currentItem,
                    (event.output as WorkerResult).error ?? "Save worker failed",
                  );
                  return context.currentItem
                    ? replaceCurrentItem(
                        context,
                        appendBlockReason({ ...context.currentItem, status: "failed" }, reason)!,
                      )
                    : null;
                },
                blockReason: ({ context, event }) =>
                  nextRepeatedReasonMessage(context.currentItem, (event.output as WorkerResult).error ?? "Save worker failed"),
                lastError: ({ context, event }) =>
                  nextRepeatedReasonMessage(context.currentItem, (event.output as WorkerResult).error ?? "Save worker failed"),
              }),
            },
          ],
        },
      },

      processingSaveResult: {
        entry: ({ context }) => persistLifecycleProjection(context, persistImpl),
        always: [
          {
            guard: "saveBlocked",
            target: "blockedPhase",
            actions: assign({
              currentItem: ({ context }) => {
                const reason = nextRepeatedReasonMessage(
                  context.currentItem,
                  context.lastVerification?.reason ?? (
                    context.currentItem?.type === "phase" && !phaseCompleted(context.currentItem.path)
                      ? "Save completed but the phase file was not marked completed"
                      : "Save verification failed"
                  ),
                );
                return context.currentItem
                  ? replaceCurrentItem(
                      context,
                      appendBlockReason({ ...context.currentItem, status: "blocked" }, reason)!,
                    )
                  : null;
              },
              blockReason: ({ context }) =>
                nextRepeatedReasonMessage(
                  context.currentItem,
                  context.lastVerification?.reason ?? (
                    context.currentItem?.type === "phase" && !phaseCompleted(context.currentItem.path)
                      ? "Save completed but the phase file was not marked completed"
                      : "Save verification failed"
                  ),
                ),
              lastError: ({ context }) =>
                nextRepeatedReasonMessage(
                  context.currentItem,
                  context.lastVerification?.reason ?? (
                    context.currentItem?.type === "phase" && !phaseCompleted(context.currentItem.path)
                      ? "Save completed but the phase file was not marked completed"
                      : "Save verification failed"
                  ),
                ),
            }),
          },
          {
            target: "phaseComplete",
          },
        ],
      },

      phaseComplete: {
        entry: [
          assign({
            currentItem: ({ context }) =>
              context.currentItem
                ? replaceCurrentItem(context, { ...context.currentItem, status: "completed" })
                : null,
            currentMode: () => null,
            currentResultFile: () => undefined,
            lastVerification: () => null,
            activeIteratePath: () => undefined,
            activeIterateConflict: () => undefined,
            activeIteration: () => 0,
            issueFingerprint: () => undefined,
            workerPid: () => undefined,
            blockReason: () => undefined,
            lastError: () => undefined,
          }),
          ({ context }) => persistLifecycleProjection(context, persistImpl),
        ],
        always: "selectingNext",
      },

      blockedPhase: {
        entry: ({ context }) => persistLifecycleProjection(context, persistImpl),
        type: "final",
        output: ({ context }) => ({
          queue: context.queue,
          blocked: context.currentItem
            ? { chunkId: context.currentItem.id, reason: context.blockReason ?? context.lastError ?? "Blocked" }
            : undefined,
          error: context.lastError,
          active: buildActiveProjection(context),
          lastWorkerStatus: context.currentItem?.status,
        }),
      },

      queueExhausted: {
        entry: ({ context }) => persistLifecycleProjection({ ...context, currentItem: null, currentMode: null }, persistImpl),
        type: "final",
        output: ({ context }) => ({
          queue: context.queue,
          active: undefined,
          lastWorkerStatus: context.currentItem?.status,
        }),
      },
    },
  });
}
