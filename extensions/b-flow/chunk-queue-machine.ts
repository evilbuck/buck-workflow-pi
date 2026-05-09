import { assign, setup } from "xstate";
import type { ChunkQueueItem } from "./types.js";
import { buildQueue } from "./queue-builder.js";
import { runWorker, type WorkerResult } from "./worker.js";
import { verifyResult } from "./verify-result.js";

interface ChunkQueueContext {
  projectRoot: string;
  subject: string | null;
  goal: string;
  queue: ChunkQueueItem[];
  currentIndex: number;
  currentItem: ChunkQueueItem | null;
  attemptCount: number;
  lastError?: string;
  blockReason?: string;
}

type ChunkQueueEvent =
  | { type: "START_QUEUE" }
  | { type: "QUEUE_BUILT"; queue: ChunkQueueItem[] }
  | { type: "QUEUE_EMPTY" }
  | { type: "WORKER_COMPLETED"; resultFile: string; status: string }
  | { type: "WORKER_FAILED"; error: string; exitCode?: number }
  | { type: "CHUNK_VERIFIED"; chunkId: string; status: string }
  | { type: "CHUNK_WARNINGS"; chunkId: string; warnings: string[] }
  | { type: "CHUNK_BLOCKED"; chunkId: string; reason: string }
  | { type: "CHUNK_FAILED"; chunkId: string; reason: string }
  | { type: "TIMEOUT" };

export interface ChunkQueueOutput {
  queue: ChunkQueueItem[];
  blocked?: { chunkId: string; reason: string };
  error?: string;
}

export function createChunkQueueMachine(
  projectRoot: string,
  subject: string | null,
  goal: string,
) {
  return setup({
    types: {
      context: {} as ChunkQueueContext,
      events: {} as ChunkQueueEvent,
      output: {} as ChunkQueueOutput,
    },
    actors: {
      buildQueue: () => Promise.resolve(buildQueue(projectRoot, subject)),
      runWorker: ({ input }: { input: { chunk: ChunkQueueItem } }) =>
        runWorker(input.chunk, { projectRoot, subject, goal }),
      verifyResult: ({ input }: { input: { resultFile: string } }) =>
        Promise.resolve(verifyResult(input.resultFile)),
    },
    guards: {
      hasNextPending: ({ context }) =>
        context.queue.some((q) => q.status === "pending"),
      maxRetriesReached: ({ context }) =>
        (context.currentItem?.workerAttempts ?? 0) >= 2,
      requiresImmediateReview: ({ context }) =>
        context.currentItem?.difficulty === "hard",
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
      attemptCount: 0,
    },
    states: {
      idle: {
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
                queue: ({ event }) => event.output as ChunkQueueItem[],
              }),
            },
            {
              target: "queueExhausted",
            },
          ],
          onError: {
            target: "failed",
            actions: assign({
              lastError: ({ event }) =>
                event.error instanceof Error ? event.error.message : String(event.error),
            }),
          },
        },
      },

      selectingNext: {
        always: [
          {
            guard: "hasNextPending",
            target: "spawningWorker",
            actions: assign({
              currentItem: ({ context }) => {
                const idx = context.queue.findIndex((q) => q.status === "pending");
                if (idx >= 0) {
                  const item = { ...context.queue[idx], status: "in-progress" as const };
                  context.queue[idx] = item;
                  return item;
                }
                return null;
              },
              currentIndex: ({ context }) =>
                context.queue.findIndex((q) => q.status === "in-progress"),
            }),
          },
          {
            target: "queueExhausted",
          },
        ],
      },

      spawningWorker: {
        invoke: {
          src: "runWorker",
          input: ({ context }) => ({
            chunk: context.currentItem!,
          }),
          onDone: [
            {
              guard: ({ event }) => (event.output as WorkerResult).type === "WORKER_COMPLETED",
              target: "readingResult",
              actions: assign({
                currentItem: ({ context, event }) => {
                  const result = event.output as WorkerResult;
                  if (context.currentItem) {
                    return {
                      ...context.currentItem,
                      workerAttempts: context.currentItem.workerAttempts + 1,
                      lastAttemptAt: new Date().toISOString(),
                      lastResultFile: result.resultFile,
                    };
                  }
                  return context.currentItem;
                },
              }),
            },
            {
              target: "failed",
              guard: "maxRetriesReached",
              actions: assign({
                currentItem: ({ context }) =>
                  context.currentItem
                    ? { ...context.currentItem, status: "failed" as const }
                    : null,
                lastError: ({ event }) =>
                  (event.output as WorkerResult).error ?? "Worker failed (max retries)",
              }),
            },
            {
              target: "spawningWorker",
              actions: assign({
                currentItem: ({ context }) =>
                  context.currentItem
                    ? { ...context.currentItem, workerAttempts: context.currentItem.workerAttempts + 1 }
                    : null,
              }),
            },
          ],
        },
      },

      readingResult: {
        invoke: {
          src: "verifyResult",
          input: ({ context }) => ({
            resultFile: context.currentItem?.lastResultFile ?? "",
          }),
          onDone: [
            {
              guard: ({ event }) => (event.output as ReturnType<typeof verifyResult>).type === "CHUNK_VERIFIED",
              target: "verifyingChunk",
              actions: assign({
                currentItem: ({ context, event }) => {
                  const vr = event.output as ReturnType<typeof verifyResult>;
                  if (context.currentItem) {
                    return { ...context.currentItem, status: vr.status };
                  }
                  return context.currentItem;
                },
              }),
            },
            {
              guard: ({ event }) => (event.output as ReturnType<typeof verifyResult>).type === "CHUNK_WARNINGS",
              target: "verifyingChunk",
              actions: assign({
                currentItem: ({ context, event }) => {
                  const vr = event.output as ReturnType<typeof verifyResult>;
                  if (context.currentItem) {
                    return { ...context.currentItem, status: vr.status };
                  }
                  return context.currentItem;
                },
              }),
            },
            {
              guard: ({ event }) => (event.output as ReturnType<typeof verifyResult>).type === "CHUNK_BLOCKED",
              target: "blockedChunk",
              actions: assign({
                currentItem: ({ context, event }) => {
                  const vr = event.output as ReturnType<typeof verifyResult>;
                  if (context.currentItem) {
                    return { ...context.currentItem, status: vr.status };
                  }
                  return context.currentItem;
                },
                blockReason: ({ event }) =>
                  (event.output as ReturnType<typeof verifyResult>).reason ?? "Blocked",
              }),
            },
            {
              target: "blockedChunk",
              actions: assign({
                currentItem: ({ context }) =>
                  context.currentItem
                    ? { ...context.currentItem, status: "failed" as const }
                    : null,
              }),
            },
          ],
        },
      },

      verifyingChunk: {
        always: [
          {
            guard: ({ context }) => context.currentItem?.status === "completed",
            target: "completedChunk",
          },
          {
            guard: ({ context }) =>
              context.currentItem?.status === "completed_with_warnings" &&
              context.currentItem?.difficulty === "hard",
            target: "blockedChunk",
            actions: assign({
              blockReason: () => "Hard chunk completed with warnings — requires review",
            }),
          },
          {
            guard: ({ context }) =>
              context.currentItem?.status === "completed_with_warnings",
            target: "completedWithWarnings",
          },
          {
            target: "blockedChunk",
            actions: assign({
              blockReason: () => "Verification returned unexpected status",
            }),
          },
        ],
      },

      completedChunk: {
        entry: assign({
          currentItem: ({ context }) => {
            if (context.currentItem && context.currentIndex >= 0) {
              context.queue[context.currentIndex] = context.currentItem;
            }
            return context.currentItem;
          },
        }),
        always: "selectingNext",
      },

      completedWithWarnings: {
        entry: assign({
          currentItem: ({ context }) => {
            if (context.currentItem && context.currentIndex >= 0) {
              context.queue[context.currentIndex] = context.currentItem;
            }
            return context.currentItem;
          },
        }),
        always: "selectingNext",
      },

      blockedChunk: {
        entry: assign({
          currentItem: ({ context }) => {
            if (context.currentItem && context.currentIndex >= 0) {
              context.queue[context.currentIndex] = context.currentItem;
            }
            return context.currentItem;
          },
        }),
        always: {
          target: "failed",
          actions: assign({
            lastError: ({ context }) =>
              context.blockReason ?? `Chunk ${context.currentItem?.id} blocked`,
          }),
        },
      },

      queueExhausted: {
        type: "final",
        output: ({ context }) => ({ queue: context.queue }),
      },

      failed: {
        type: "final",
        output: ({ context }) => ({
          queue: context.queue,
          blocked: context.currentItem
            ? { chunkId: context.currentItem.id, reason: context.blockReason ?? "Failed" }
            : undefined,
          error: context.lastError,
        }),
      },
    },
  });
}
