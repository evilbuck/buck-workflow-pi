import { assign, setup, type ActorRefFrom } from "xstate";
import {
  MAX_CONFLICT_STEPS,
  MAX_HISTORY,
  attestationsForHead,
  consumePollObservation,
  defaultContext,
  isActiveState,
  nextPollDelayMs,
  noProgressExhausts,
  resetPollState,
  resumeCommand,
  type BlockReason,
  type MachineState,
  type PrManagerContext,
  type PrManagerEvent,
  type ResolvedPr,
  type ValidatorRoleResult,
} from "./types.js";

function pushHistory(
  context: PrManagerContext,
  eventType: string,
  to: MachineState,
): PrManagerContext["history"] {
  const record = {
    at: new Date().toISOString(),
    from: context.currentState,
    event: eventType,
    to,
  };
  const history = [...context.history, record];
  if (history.length <= MAX_HISTORY) return history;
  return history.slice(history.length - MAX_HISTORY);
}

function settle(
  context: PrManagerContext,
  event: PrManagerEvent,
  to: MachineState,
  patch: Partial<PrManagerContext> = {},
): PrManagerContext {
  return {
    ...context,
    ...patch,
    currentState: to,
    lastEvent: event.type,
    history: pushHistory(context, event.type, to),
    updatedAt: new Date().toISOString(),
  };
}

function applyResolvedPr(pr: ResolvedPr): Partial<PrManagerContext> {
  return {
    pr,
    owner: pr.owner,
    repo: pr.repo,
    prNumber: pr.number,
    prUrl: pr.url,
    headRef: pr.headRef,
    baseRef: pr.baseRef,
    localHeadOid: pr.headOid,
  };
}

function applyHeadChange(context: PrManagerContext, headOid: string): Partial<PrManagerContext> {
  return {
    localHeadOid: headOid,
    ...attestationsForHead(context.reviewAttestation, context.verificationAttestation, headOid),
  };
}

function mergeVerdicts(
  existing: PrManagerContext["verdicts"],
  result: ValidatorRoleResult,
): PrManagerContext["verdicts"] {
  const next = { ...existing };
  for (const item of result.classifications) next[item.fingerprint] = item;
  return next;
}

function typedBlock(code: BlockReason["code"], message: string, prNumber: number): BlockReason {
  return {
    schemaVersion: 1,
    code,
    message,
    resumeCommand: resumeCommand(prNumber),
  };
}

const prManagerSetup = setup({
  types: {
    context: {} as PrManagerContext,
    events: {} as PrManagerEvent,
  },
  delays: {
    pollDelay: ({ context }) => nextPollDelayMs(context.poll.observationCount, context.poll.delaysMs),
  },
  guards: {
    isActive: ({ context }) => isActiveState(context.currentState),
    baseMatchesPr: ({ context, event }) =>
      event.type === "BASE_SELECTED" && context.pr?.baseRef === event.base,
    conflictBudgetOpen: ({ context }) => context.conflictSteps < MAX_CONFLICT_STEPS,
    nextPollExhausts: ({ context }) =>
      noProgressExhausts(context.poll.observationCount, context.poll.maxPolls),
  },
});

export function createPrManagerMachine(overrides: Partial<PrManagerContext> = {}) {
  return prManagerSetup.createMachine({
    id: "b-pr-manager",
    initial: "idle",
    context: defaultContext(overrides),
    on: {
      CANCEL: {
        guard: "isActive",
        target: ".paused",
        actions: assign(({ context, event }) =>
          settle(context, event, "paused", {
            pauseReason: `Cancelled. Resume with ${resumeCommand(context.prNumber)}`,
          }),
        ),
      },
      BLOCK: {
        guard: "isActive",
        target: ".blocked",
        actions: assign(({ context, event }) =>
          settle(context, event, "blocked", {
            blockReason: event.type === "BLOCK" ? event.reason : context.blockReason,
          }),
        ),
      },
    },
    states: {
      idle: {
        on: {
          START: {
            target: "resolving_pr",
            actions: assign(({ context, event }) =>
              settle(context, event, "resolving_pr", {
                options: event.options,
                poll: {
                  ...context.poll,
                  initialDelayMs: event.options.initialDelayMs,
                  backoff: event.options.backoff,
                  maxDelayMs: event.options.maxDelayMs,
                  maxPolls: event.options.maxPolls,
                },
                mergeMethod: event.options.mergeMethod ?? context.mergeMethod,
              }),
            ),
          },
        },
      },

      resolving_pr: {
        on: {
          BASE_READY: {
            target: "checking_out",
            actions: assign(({ context, event }) =>
              settle(context, event, "checking_out", {
                ...applyResolvedPr(event.pr),
                cache: event.cache,
                cachedBase: event.cache.branch,
                cacheProvenance: event.cache.provenance,
              }),
            ),
          },
          CACHE_MISSING_OR_MISMATCH: {
            target: "awaiting_base",
            actions: assign(({ context, event }) =>
              settle(context, event, "awaiting_base", {
                ...applyResolvedPr(event.pr),
                cache: event.cache,
                cachedBase: event.cache?.branch ?? null,
                cacheProvenance: event.cache?.provenance ?? null,
              }),
            ),
          },
          GITHUB_STATE_MERGED: {
            target: "merged",
            actions: assign(({ context, event }) =>
              settle(context, event, "merged", {
                mergeGate: event.snapshot,
                mergeCommitOid: event.snapshot.mergeCommitOid,
              }),
            ),
          },
        },
      },

      awaiting_base: {
        on: {
          BASE_SELECTED: [
            {
              guard: "baseMatchesPr",
              target: "checking_out",
              actions: assign(({ context, event }) =>
                settle(context, event, "checking_out", {
                  cache: { branch: event.base, provenance: "selected" },
                  cachedBase: event.base,
                  cacheProvenance: "selected",
                }),
              ),
            },
            {
              target: "blocked",
              actions: assign(({ context, event }) =>
                settle(context, event, "blocked", {
                  blockReason: typedBlock(
                    "base_mismatch",
                    "Selected base does not match the pull request base; the PR is not retargeted.",
                    context.prNumber,
                  ),
                }),
              ),
            },
          ],
        },
      },

      checking_out: {
        on: {
          CHECKOUT_OK: {
            target: "rebasing",
            actions: assign(({ context, event }) =>
              settle(context, event, "rebasing", {
                ...applyHeadChange(context, event.headOid),
                headRef: event.branch,
              }),
            ),
          },
        },
      },

      rebasing: {
        on: {
          CONFLICTS_FOUND: [
            {
              guard: "conflictBudgetOpen",
              target: "resolving_conflicts",
              actions: assign(({ context, event }) =>
                settle(context, event, "resolving_conflicts", {
                  unresolvedConflictPaths: event.paths,
                }),
              ),
            },
            {
              target: "blocked",
              actions: assign(({ context, event }) =>
                settle(context, event, "blocked", {
                  unresolvedConflictPaths: event.paths,
                  blockReason: typedBlock(
                    "conflict_limit",
                    `Conflict resolution exceeded ${MAX_CONFLICT_STEPS} steps.`,
                    context.prNumber,
                  ),
                }),
              ),
            },
          ],
          REBASE_OK: {
            target: "fetching_feedback",
            actions: assign(({ context, event }) =>
              settle(context, event, "fetching_feedback", {
                ...applyHeadChange(context, event.headOid),
                rewrittenPublished: event.rewrittenPublished,
                unresolvedConflictPaths: [],
              }),
            ),
          },
        },
      },

      resolving_conflicts: {
        on: {
          CONFLICT_STEP_DONE: {
            target: "rebasing",
            actions: assign(({ context, event }) =>
              settle(context, event, "rebasing", {
                ...applyHeadChange(context, event.headOid),
                conflictSteps: context.conflictSteps + 1,
                unresolvedConflictPaths: event.result.remainingMarkers
                  ? context.unresolvedConflictPaths
                  : [],
              }),
            ),
          },
        },
      },

      fetching_feedback: {
        on: {
          FEEDBACK_DELTA: {
            target: "validating_feedback",
            actions: assign(({ context, event }) =>
              settle(context, event, "validating_feedback", {
                feedback: event.versions,
              }),
            ),
          },
          NO_ACTIONABLE_DELTA: {
            target: "buck_review",
            actions: assign(({ context, event }) => settle(context, event, "buck_review")),
          },
        },
      },

      validating_feedback: {
        on: {
          ACTIONABLE: {
            target: "planning_fix",
            actions: assign(({ context, event }) =>
              settle(context, event, "planning_fix", {
                verdicts: mergeVerdicts(context.verdicts, event.result),
              }),
            ),
          },
          NOTHING_ACTIONABLE: {
            target: "buck_review",
            actions: assign(({ context, event }) =>
              settle(context, event, "buck_review", {
                verdicts: mergeVerdicts(context.verdicts, event.result),
              }),
            ),
          },
          UNSURE_OR_SCOPE_DECISION: {
            target: "blocked",
            actions: assign(({ context, event }) =>
              settle(context, event, "blocked", {
                verdicts: mergeVerdicts(context.verdicts, event.result),
                blockReason: typedBlock(
                  "unsure_or_scope",
                  "Feedback requires a product or scope decision.",
                  context.prNumber,
                ),
              }),
            ),
          },
        },
      },

      planning_fix: {
        on: {
          PLAN_READY: {
            target: "building",
            actions: assign(({ context, event }) =>
              settle(context, event, "building", {
                iterationArtifactPath: event.result.artifactPath,
              }),
            ),
          },
        },
      },

      building: {
        on: {
          BUILD_DONE: {
            target: "reviewing",
            actions: assign(({ context, event }) =>
              settle(context, event, "reviewing", {
                buildAttestation: {
                  headOid: context.localHeadOid ?? "",
                  expectedPaths: event.result.expectedPaths,
                  actualPaths: event.result.actualPaths,
                },
                ownedDirtyPaths: event.result.actualPaths,
              }),
            ),
          },
        },
      },

      reviewing: {
        on: {
          REVIEW_ITERATE: {
            target: "planning_fix",
            actions: assign(({ context, event }) =>
              settle(context, event, "planning_fix", {
                reviewAttestation: {
                  headOid: event.result.headOid,
                  diffDigest: event.result.diffDigest,
                  verdict: event.result.verdict,
                },
              }),
            ),
          },
          REVIEW_BLOCK: {
            target: "blocked",
            actions: assign(({ context, event }) =>
              settle(context, event, "blocked", {
                reviewAttestation: {
                  headOid: event.result.headOid,
                  diffDigest: event.result.diffDigest,
                  verdict: event.result.verdict,
                },
                blockReason: typedBlock(
                  "review_block",
                  "Independent review blocked the round.",
                  context.prNumber,
                ),
              }),
            ),
          },
          REVIEW_PASS: {
            target: "verifying",
            actions: assign(({ context, event }) =>
              settle(context, event, "verifying", {
                reviewAttestation: {
                  headOid: event.result.headOid,
                  diffDigest: event.result.diffDigest,
                  verdict: event.result.verdict,
                },
                diffDigest: event.result.diffDigest,
              }),
            ),
          },
        },
      },

      buck_review: {
        on: {
          REVIEW_ITERATE: {
            target: "planning_fix",
            actions: assign(({ context, event }) =>
              settle(context, event, "planning_fix", {
                reviewAttestation: {
                  headOid: event.result.headOid,
                  diffDigest: event.result.diffDigest,
                  verdict: event.result.verdict,
                },
              }),
            ),
          },
          REVIEW_BLOCK: {
            target: "blocked",
            actions: assign(({ context, event }) =>
              settle(context, event, "blocked", {
                reviewAttestation: {
                  headOid: event.result.headOid,
                  diffDigest: event.result.diffDigest,
                  verdict: event.result.verdict,
                },
                blockReason: typedBlock(
                  "review_block",
                  "Holistic Buck review blocked the run.",
                  context.prNumber,
                ),
              }),
            ),
          },
          REVIEW_PASS: {
            target: "verifying",
            actions: assign(({ context, event }) =>
              settle(context, event, "verifying", {
                reviewAttestation: {
                  headOid: event.result.headOid,
                  diffDigest: event.result.diffDigest,
                  verdict: event.result.verdict,
                },
                diffDigest: event.result.diffDigest,
              }),
            ),
          },
        },
      },

      verifying: {
        on: {
          HEAD_OR_DIFF_DRIFTED: {
            target: "reviewing",
            actions: assign(({ context, event }) =>
              settle(context, event, "reviewing", {
                ...applyHeadChange(context, event.headOid),
                diffDigest: event.diffDigest,
                reviewAttestation: null,
                verificationAttestation: null,
              }),
            ),
          },
          LOCAL_GATE_FAIL: {
            target: "blocked",
            actions: assign(({ context, event }) =>
              settle(context, event, "blocked", {
                verificationAttestation: event.verification,
                blockReason: typedBlock(
                  "local_gate_fail",
                  "Deterministic local checks failed.",
                  context.prNumber,
                ),
              }),
            ),
          },
          DIRTY_VERIFIED: {
            target: "committing",
            actions: assign(({ context, event }) =>
              settle(context, event, "committing", {
                verificationAttestation: event.verification,
                diffDigest: event.verification.diffDigest,
              }),
            ),
          },
          REWRITTEN_OR_AHEAD: {
            target: "pushing",
            actions: assign(({ context, event }) =>
              settle(context, event, "pushing", {
                verificationAttestation: event.verification,
              }),
            ),
          },
          CLEAN_AND_SYNCED: {
            target: "checking_merge_gate",
            actions: assign(({ context, event }) =>
              settle(context, event, "checking_merge_gate", {
                verificationAttestation: event.verification,
              }),
            ),
          },
        },
      },

      committing: {
        on: {
          COMMIT_OK: {
            target: "pushing",
            actions: assign(({ context, event }) =>
              settle(context, event, "pushing", {
                ...applyHeadChange(context, event.sha),
                createdCommitShas: [...context.createdCommitShas, event.sha],
              }),
            ),
          },
        },
      },

      pushing: {
        on: {
          REMOTE_HEAD_CONFIRMED: {
            target: "refreshing",
            actions: assign(({ context, event }) =>
              settle(context, event, "refreshing", {
                remoteHeadOid: event.remoteHeadOid,
                verifiedPushOid: event.remoteHeadOid,
                poll: resetPollState(context.poll),
              }),
            ),
          },
        },
      },

      refreshing: {
        on: {
          NEW_FEEDBACK: {
            target: "validating_feedback",
            actions: assign(({ context, event }) =>
              settle(context, event, "validating_feedback", {
                feedback: event.versions,
                poll: resetPollState(context.poll),
              }),
            ),
          },
          NO_NEW_FEEDBACK: {
            target: "checking_merge_gate",
            actions: assign(({ context, event }) =>
              settle(context, event, "checking_merge_gate"),
            ),
          },
          GITHUB_STATE_MERGED: {
            target: "merged",
            actions: assign(({ context, event }) =>
              settle(context, event, "merged", {
                mergeGate: event.snapshot,
                mergeCommitOid: event.snapshot.mergeCommitOid,
              }),
            ),
          },
        },
      },

      checking_merge_gate: {
        entry: assign({
          currentState: () => "checking_merge_gate" as const,
        }),
        on: {
          BASE_ADVANCED_OR_CONFLICT: {
            target: "rebasing",
            actions: assign(({ context, event }) =>
              settle(context, event, "rebasing", {
                mergeGate: event.snapshot,
                baseHeadOid: event.snapshot.baseOid,
                poll: resetPollState(context.poll),
                ...attestationsForHead(null, null, event.snapshot.headOid),
              }),
            ),
          },
          NEW_FEEDBACK: {
            target: "validating_feedback",
            actions: assign(({ context, event }) =>
              settle(context, event, "validating_feedback", {
                feedback: event.versions,
                poll: resetPollState(context.poll),
              }),
            ),
          },
          REMOTE_GATE_PENDING: [
            {
              guard: "nextPollExhausts",
              target: "exhausted",
              actions: assign(({ context, event }) =>
                settle(context, event, "exhausted", {
                  mergeGate: event.snapshot,
                  poll: consumePollObservation(context.poll, Date.now()),
                  exhaustReason: "No merge-gate progress after the configured poll budget.",
                }),
              ),
            },
            {
              target: "waiting",
              actions: assign(({ context, event }) =>
                settle(context, event, "waiting", {
                  mergeGate: event.snapshot,
                  poll: consumePollObservation(context.poll, Date.now()),
                }),
              ),
            },
          ],
          ALL_GATES_PASS: {
            target: "enabling_auto_merge",
            actions: assign(({ context, event }) =>
              settle(context, event, "enabling_auto_merge", {
                mergeGate: event.snapshot,
                poll: resetPollState(context.poll),
              }),
            ),
          },
          HARD_GATE_FAIL: {
            target: "blocked",
            actions: assign(({ context, event }) =>
              settle(context, event, "blocked", {
                mergeGate: event.snapshot,
                blockReason: event.reason,
              }),
            ),
          },
          GITHUB_STATE_MERGED: {
            target: "merged",
            actions: assign(({ context, event }) =>
              settle(context, event, "merged", {
                mergeGate: event.snapshot,
                mergeCommitOid: event.snapshot.mergeCommitOid,
              }),
            ),
          },
        },
      },

      enabling_auto_merge: {
        on: {
          GITHUB_STATE_MERGED: {
            target: "merged",
            actions: assign(({ context, event }) =>
              settle(context, event, "merged", {
                mergeGate: event.snapshot,
                mergeCommitOid: event.snapshot.mergeCommitOid,
                autoMergeRequested: true,
              }),
            ),
          },
          AUTO_MERGE_ACCEPTED: {
            target: "waiting",
            actions: assign(({ context, event }) =>
              settle(context, event, "waiting", {
                mergeGate: event.snapshot,
                autoMergeRequested: true,
                poll: resetPollState(context.poll),
              }),
            ),
          },
        },
      },

      waiting: {
        after: {
          pollDelay: { target: "checking_merge_gate" },
        },
        on: {
          POLL_DUE: {
            target: "checking_merge_gate",
            actions: assign(({ context, event }) =>
              settle(context, event, "checking_merge_gate"),
            ),
          },
          POLL_LIMIT: {
            target: "exhausted",
            actions: assign(({ context, event }) =>
              settle(context, event, "exhausted", {
                exhaustReason: "No merge-gate progress after the configured poll budget.",
              }),
            ),
          },
        },
      },

      blocked: {
        on: {
          RESUME_AND_RECONCILE: {
            target: "resolving_pr",
            actions: assign(({ context, event }) =>
              settle(context, event, "resolving_pr", {
                blockReason: null,
                pauseReason: null,
                exhaustReason: null,
              }),
            ),
          },
        },
      },

      exhausted: {
        on: {
          RESUME_AND_RECONCILE: {
            target: "resolving_pr",
            actions: assign(({ context, event }) =>
              settle(context, event, "resolving_pr", {
                blockReason: null,
                pauseReason: null,
                exhaustReason: null,
                poll: resetPollState(context.poll),
              }),
            ),
          },
        },
      },

      paused: {
        on: {
          RESUME_AND_RECONCILE: {
            target: "resolving_pr",
            actions: assign(({ context, event }) =>
              settle(context, event, "resolving_pr", {
                pauseReason: null,
                blockReason: null,
                exhaustReason: null,
              }),
            ),
          },
        },
      },

      merged: {},
    },
  });
}

export const prManagerMachine = createPrManagerMachine();
export type PrManagerActor = ActorRefFrom<typeof prManagerMachine>;
