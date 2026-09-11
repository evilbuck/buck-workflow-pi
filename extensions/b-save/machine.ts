import { assign, setup } from "xstate";

export type BSaveEvent =
  | { type: "AMBIGUOUS_SUBJECT" }
  | { type: "SUBJECT_CHOSEN"; subject: string }
  | { type: "SNAPSHOT_DONE" }
  | { type: "NEEDS_JUDGMENT" }
  | { type: "JUDGMENT_DONE" }
  | { type: "MODEL_FAILED" }
  | { type: "NEEDS_POLICY" }
  | { type: "POLICY_DECIDED" }
  | { type: "EVAL_DONE" }
  | { type: "APPLY_DONE" }
  | { type: "APPLY_FAILED" }
  | { type: "EFFECTS_DONE" }
  | { type: "ABORT" };

export type BSaveContext = {
  runId: string;
  subject: string | null;
  modelAttempts: number;
};

export function createBSaveMachine() {
  return setup({
    types: {
      context: {} as BSaveContext,
      events: {} as BSaveEvent,
      input: {} as { runId: string; subject?: string | null },
    },
    guards: {
      canRetryModel: ({ context }) => context.modelAttempts < 1,
    },
  }).createMachine({
    id: "b-save",
    initial: "snapshotting",
    context: ({ input }) => ({
      runId: input.runId,
      subject: input.subject ?? null,
      modelAttempts: 0,
    }),
    on: {
      ABORT: { target: ".aborted" },
    },
    states: {
      snapshotting: {
        on: {
          AMBIGUOUS_SUBJECT: "awaiting_subject_choice",
          SNAPSHOT_DONE: "evaluating",
        },
      },
      awaiting_subject_choice: {
        on: {
          SUBJECT_CHOSEN: {
            target: "snapshotting",
            actions: assign(({ event }) => ({ subject: event.subject })),
          },
        },
      },
      evaluating: {
        on: {
          NEEDS_JUDGMENT: "judging",
          NEEDS_POLICY: "awaiting_policy",
          EVAL_DONE: "applying",
        },
      },
      judging: {
        on: {
          JUDGMENT_DONE: {
            target: "evaluating",
            actions: assign({ modelAttempts: 0 }),
          },
          MODEL_FAILED: [
            {
              guard: "canRetryModel",
              target: "judging",
              actions: assign(({ context }) => ({ modelAttempts: context.modelAttempts + 1 })),
              reenter: true,
            },
            { target: "failed_model" },
          ],
        },
      },
      awaiting_policy: {
        on: {
          POLICY_DECIDED: "applying",
        },
      },
      applying: {
        on: {
          APPLY_DONE: "effecting",
          APPLY_FAILED: "failed_apply",
        },
      },
      effecting: {
        on: {
          EFFECTS_DONE: "completed",
        },
      },
      failed_model: { type: "final" },
      failed_apply: { type: "final" },
      completed: { type: "final" },
      aborted: { type: "final" },
    },
  });
}
