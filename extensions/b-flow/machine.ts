import { assign, setup, type ActorRefFrom } from "xstate";
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

export function createBuckMachine(projectRoot: string) {
  return setup({
    types: {
      context: {} as BuckMachineContext,
      events: {} as BuckMachineEvent,
    },
    actors: {
      scanContext: ({ input }: { input: { current: string; goal: string; subject: string | null } }) =>
        scanContext(projectRoot, input.current as string, input.goal, input.subject),
      evaluateModelGuard: ({ input }: { input: TransitionContext }) =>
        Promise.resolve(evaluateModelGuard(input)),
      chunkQueue: ({ input }: { input: { subject: string | null; goal: string } }) =>
        createChunkQueueMachine(projectRoot, input.subject, input.goal),
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
            actions: assign({
              transitionContext: ({ event }) =>
                event.output.type === "SCAN_COMPLETE"
                  ? event.output.context!
                  : null,
            }),
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
              guard: "hasPhasesOverview",
              target: "decomposing",
              actions: assign({
                transitionContext: ({ event }) =>
                  event.output.type === "SCAN_COMPLETE"
                    ? event.output.context!
                    : null,
              }),
            },
            {
              guard: "hasActivePhase",
              target: "executingChunks",
              actions: assign({
                transitionContext: ({ event }) =>
                  event.output.type === "SCAN_COMPLETE"
                    ? event.output.context!
                    : null,
              }),
            },
            {
              target: "decomposing",
              actions: assign({
                transitionContext: ({ event }) =>
                  event.output.type === "SCAN_COMPLETE"
                    ? event.output.context!
                    : null,
              }),
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
                projection: ({ context, event }) => ({
                  ...context.projection,
                  queue: (event.output as ChunkQueueOutput).queue,
                }),
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
                projection: ({ context, event }) => ({
                  ...context.projection,
                  queue: (event.output as ChunkQueueOutput).queue,
                }),
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
