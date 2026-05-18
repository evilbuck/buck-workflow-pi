import { relative } from "node:path";
import { assign, createActor, fromPromise, setup, type ActorRefFrom } from "xstate";
import type {
  BuckMachineContext,
  BuckMachineEvent,
  TransitionContext,
  RouteAction,
  OrchestrationState,
} from "./types.js";
import {
  hasGoal,
  hasPhasesOverview,
  hasActivePhase,
  requiresReview,
  requiresReplan,
} from "./guards.js";
import { scanContext } from "./scan-context.js";
import { evaluateModelGuard } from "./classifier.js";
import {
  readProjection,
  writeProjection,
  writeSnapshot,
} from "./persistence.js";
import { createChunkQueueMachine, type ChunkQueueOutput } from "./chunk-queue-machine.js";

export type BuckMachine = ReturnType<typeof createBuckMachine>;
export type BuckActor = ActorRefFrom<BuckMachine>;

function defaultContext(projectRoot: string): BuckMachineContext {
  const saved = readProjection(projectRoot);
  if (saved) {
    return {
      goal: saved.goal,
      subject: saved.subject,
      projection: saved,
      transitionContext: null,
      routeAction: null,
      activeWorkerPid: null,
      activeWorkerSessionId: null,
    };
  }
  return {
    goal: "",
    subject: null,
    projection: {
      version: 1,
      goal: "",
      currentState: "idle",
      subject: null,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [],
      queue: [],
      workerAttemptCount: 0,
    },
    transitionContext: null,
    routeAction: null,
    activeWorkerPid: null,
    activeWorkerSessionId: null,
  };
}

function nextProjection(
  state: OrchestrationState,
  to: OrchestrationState["currentState"],
  reason: string,
): OrchestrationState {
  return {
    ...state,
    currentState: to,
    updatedAt: new Date().toISOString(),
    history: [
      ...state.history,
      {
        from: state.currentState,
        to,
        at: new Date().toISOString(),
        reason,
      },
    ],
  };
}

function persistAction(projectRoot: string) {
  return ({ context }: { context: BuckMachineContext }) => {
    writeProjection(projectRoot, context.projection);
  };
}

type ScanDoneEvent = { output?: Awaited<ReturnType<typeof scanContext>> };

function scanOutput(event: ScanDoneEvent): TransitionContext | null {
  return event.output?.type === "SCAN_COMPLETE" ? event.output.context ?? null : null;
}

function inferSubjectFromScan(projectRoot: string, scan: TransitionContext | null): string | null {
  if (!scan) return null;
  if (scan.subject) return scan.subject;

  const paths = [
    scan.artifacts.activePhase?.path,
    scan.artifacts.phasesOverview?.path,
    scan.artifacts.latestPlan?.path,
    scan.artifacts.tasksMd?.path,
    scan.artifacts.workerResults[0]?.path,
  ].filter((p): p is string => !!p);

  for (const path of paths) {
    const rel = relative(`${projectRoot}/.context`, path).replaceAll("\\", "/");
    const first = rel.split("/")[0];
    if (first?.match(/^\d{4}-\d{2}-\d{2}\./)) return first;
  }

  return null;
}

function subjectFromScanEvent(
  projectRoot: string,
  context: BuckMachineContext,
  event: ScanDoneEvent,
): string | null {
  return inferSubjectFromScan(projectRoot, scanOutput(event)) ?? context.subject;
}

function projectionWithScannedSubject(
  projectRoot: string,
  context: BuckMachineContext,
  event: ScanDoneEvent,
): OrchestrationState {
  const subject = subjectFromScanEvent(projectRoot, context, event);
  if (!subject || subject === context.projection.subject) return context.projection;
  return { ...context.projection, subject };
}

function assignScanResult(projectRoot: string) {
  return assign({
    transitionContext: ({ event }) => scanOutput(event as ScanDoneEvent),
    subject: ({ context, event }) =>
      subjectFromScanEvent(projectRoot, context as BuckMachineContext, event as ScanDoneEvent),
    projection: ({ context, event }) =>
      projectionWithScannedSubject(projectRoot, context as BuckMachineContext, event as ScanDoneEvent),
  }) as any;
}

export function createBuckMachine(projectRoot: string) {
  return setup({
    types: {
      context: {} as BuckMachineContext,
      events: {} as BuckMachineEvent,
    },
    actors: {
      scanContext: fromPromise(({ input }: { input: { current: string; goal: string; subject: string | null } }) =>
        scanContext(projectRoot, input.current as any, input.goal, input.subject)),
      evaluateModelGuard: fromPromise(({ input }: { input: TransitionContext }) =>
        Promise.resolve(evaluateModelGuard(input))),
      chunkQueue: fromPromise(({ input }: { input: { subject: string | null; goal: string } }) =>
        new Promise<ChunkQueueOutput>((resolve, reject) => {
          const child = createActor(createChunkQueueMachine(projectRoot, input.subject, input.goal));
          let subscription: { unsubscribe: () => void } | undefined;
          subscription = child.subscribe({
            next: (snapshot) => {
              if (snapshot.status === "done") {
                subscription?.unsubscribe();
                const context = snapshot.context as unknown as {
                  queue: ChunkQueueOutput["queue"];
                  currentItem?: { id: string } | null;
                  blockReason?: string;
                  lastError?: string;
                };
                resolve((snapshot.output as ChunkQueueOutput | undefined) ?? {
                  queue: context.queue,
                  blocked: String(snapshot.value) === "failed" && context.currentItem
                    ? {
                        chunkId: context.currentItem.id,
                        reason: context.blockReason ?? context.lastError ?? "Failed",
                      }
                    : undefined,
                  error: context.lastError,
                });
              } else if (snapshot.status === "error") {
                subscription?.unsubscribe();
                reject(snapshot.error);
              }
            },
            error: reject,
          });
          child.start();
        })),
    },
    guards: {
      hasGoal: ({ context }) =>
        context.transitionContext !== null && hasGoal(context.transitionContext),
      hasPhasesOverview: ({ context }) =>
        context.transitionContext !== null && hasPhasesOverview(context.transitionContext),
      hasActivePhase: ({ context }) =>
        context.transitionContext !== null && hasActivePhase(context.transitionContext),
      requiresReview: ({ context }) =>
        context.transitionContext !== null && requiresReview(context.transitionContext),
      requiresReplan: ({ context }) =>
        context.transitionContext !== null && requiresReplan(context.transitionContext),
    },
  }).createMachine({
    id: "buck-flow",
    initial: "idle",
    context: defaultContext(projectRoot),
    states: {
      idle: {
        on: {
          START: {
            target: "recovering",
            actions: assign({
              goal: ({ event }) => event.goal,
              projection: ({ context, event }) =>
                nextProjection(
                  { ...context.projection, goal: event.goal },
                  "recovering",
                  "Starting flow",
                ),
            }),
          },
        },
      },

      recovering: {
        entry: assign({
          projection: ({ context }) =>
            nextProjection(context.projection, "recovering", "Starting or resuming flow"),
        }),
        invoke: {
          src: "scanContext",
          input: ({ context }) => ({
            current: context.projection.currentState,
            goal: context.goal,
            subject: context.subject,
          }),
          onDone: {
            target: "planning",
            actions: assignScanResult(projectRoot),
          },
          onError: {
            target: "blocked",
            actions: assign({
              routeAction: () => ({ type: "block", reason: "Scan failed" }),
            }),
          },
        },
        exit: persistAction(projectRoot),
      },

      planning: {
        entry: assign({
          projection: ({ context }) =>
            nextProjection(context.projection, "planning", "Plan needed or active"),
        }),
        invoke: {
          src: "scanContext",
          input: ({ context }) => ({
            current: context.projection.currentState,
            goal: context.goal,
            subject: context.subject,
          }),
          onDone: [
            {
              guard: "hasActivePhase",
              target: "executingChunks",
              actions: assignScanResult(projectRoot),
            },
            {
              guard: "hasPhasesOverview",
              target: "decomposing",
              actions: assignScanResult(projectRoot),
            },
            {
              target: "decomposing",
              actions: assignScanResult(projectRoot),
            },
          ],
        },
        exit: persistAction(projectRoot),
      },

      decomposing: {
        entry: assign({
          projection: ({ context }) =>
            nextProjection(context.projection, "decomposing", "Decomposing plan into chunks"),
        }),
        on: {
          CONTINUE: {
            target: "executingChunks",
          },
        },
        exit: persistAction(projectRoot),
      },

      executingChunks: {
        entry: assign({
          projection: ({ context }) =>
            nextProjection(context.projection, "executingChunks", "Executing chunks"),
        }),
        invoke: {
          src: "chunkQueue",
          input: ({ context }) => ({
            subject: context.subject,
            goal: context.goal,
          }),
          onDone: [
            {
              guard: ({ event }) => !!(event.output as ChunkQueueOutput).blocked,
              target: "blocked",
              actions: assign({
                projection: ({ context, event }) => {
                  const out = event.output as ChunkQueueOutput;
                  return {
                    ...context.projection,
                    queue: out.queue,
                    active: out.active,
                    lastWorkerStatus: out.lastWorkerStatus,
                  };
                },
                routeAction: ({ event }) => {
                  const out = event.output as ChunkQueueOutput;
                  return {
                    type: "block" as const,
                    reason: out.blocked
                      ? `Chunk ${out.blocked.chunkId} blocked: ${out.blocked.reason}`
                      : "Chunk queue blocked",
                  };
                },
              }),
            },
            {
              target: "reviewing",
              actions: assign({
                projection: ({ context, event }) => {
                  const out = event.output as ChunkQueueOutput;
                  return {
                    ...context.projection,
                    queue: out.queue,
                    active: out.active,
                    lastWorkerStatus: out.lastWorkerStatus,
                  };
                },
              }),
            },
          ],
          onError: {
            target: "blocked",
            actions: assign({
              routeAction: () => ({
                type: "block",
                reason: "Chunk queue failed",
              }),
            }),
          },
        },
        exit: persistAction(projectRoot),
      },

      reviewing: {
        entry: assign({
          projection: ({ context }) =>
            nextProjection(context.projection, "reviewing", "Reviewing results"),
        }),
        on: {
          REVIEW_COMPLETE: [
            {
              guard: "requiresReplan",
              target: "planning",
            },
            {
              target: "saving",
            },
          ],
        },
        exit: persistAction(projectRoot),
      },

      saving: {
        entry: assign({
          projection: ({ context }) =>
            nextProjection(context.projection, "saving", "Saving state"),
        }),
        on: {
          SAVE_COMPLETE: {
            target: "done",
          },
        },
        exit: persistAction(projectRoot),
      },

      blocked: {
        entry: assign({
          projection: ({ context }) =>
            nextProjection(context.projection, "blocked", "Blocked — user input required"),
        }),
        on: {
          USER_CONFIRMED: {
            target: "recovering",
          },
        },
        exit: persistAction(projectRoot),
      },

      paused: {
        entry: assign({
          projection: ({ context }) =>
            nextProjection(context.projection, "paused", "Paused by user"),
        }),
        on: {
          RESUME: {
            target: "recovering",
          },
        },
        exit: persistAction(projectRoot),
      },

      done: {
        type: "final",
        entry: assign({
          projection: ({ context }) =>
            nextProjection(context.projection, "done", "Flow completed"),
        }),
        exit: persistAction(projectRoot),
      },

      aborted: {
        type: "final",
        entry: assign({
          projection: ({ context }) =>
            nextProjection(context.projection, "aborted", "Flow aborted"),
        }),
        exit: persistAction(projectRoot),
      },
    },

    on: {
      PAUSE: {
        target: ".paused",
      },
      STOP: {
        target: ".aborted",
      },
    },
  });
}
