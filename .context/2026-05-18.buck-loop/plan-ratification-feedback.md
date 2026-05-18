---
status: active
date: 2026-05-18
subject: 2026-05-18.buck-loop
topics: [buck-loop, b-flow, autonomous, planning-review]
research: []
iterations: []
spec:
memory: []
---

# Plan: Buck Loop Ratification Feedback

## Goal

Assess `brainstorm-buck-loop.md` before ratification and identify missing decisions, risks, and amendments needed to make the implementation plan bounded and safe.

## Context used / assumptions

- User-provided context: `.context/2026-05-18.buck-loop/brainstorm-buck-loop.md`.
- Session context: Buck workflow plan mode; source edits are out of scope for this pass.
- Code inspected: `extensions/b-flow/machine.ts`, `extensions/b-flow/chunk-queue-machine.ts`, `extensions/b-flow/classifier.ts`, `extensions/b-flow/types.ts`, `extensions/b-flow/scan-context.ts`, `extensions/b-flow/worker.ts`, `extensions/b-flow/queue-builder.ts`, `extensions/b-flow/index.ts`, `extensions/b-flow/ui.ts`, `extensions/tmux-window-status.ts`, and relevant tests.
- GitNexus evidence: `createBuckMachine` is only called by `ensureActor`/`wire`, so core-machine blast radius is contained, but `createBuckMachine → createChunkQueueMachine → runWorker/verifyResult/buildQueue` is the critical execution path.
- Recommendation: do not ratify the brainstorm exactly as written; ratify it with the amendments below.

## Ratification verdict

The two-phase direction is sound: build an autonomous inner loop before any outer loop. The biggest correction is architectural: current b-flow already has a nested `chunk-queue-machine` under `executingChunks`, but that child currently runs generic workers over queued artifacts and only returns a final queue to the parent. The ratified plan should decide whether the autonomous build/review/iterate/save loop lives:

1. inside the parent `executingChunks` nested state, replacing the promise-style child queue invocation; or
2. inside `chunk-queue-machine`, with explicit progress projection streaming back to `orchestration.json`.

Do not add a second competing inner-loop machine without resolving that ownership boundary.

## Amendments to add before build

### 1. Define the single owner of phase lifecycle state

Current state:
- `createBuckMachine` invokes `chunkQueue` as a promise actor while in `executingChunks`.
- `chunk-queue-machine` already has `buildingQueue → selectingNext → spawningWorker → readingResult → verifyingChunk → completedChunk/blockedChunk`.
- The parent cannot observe child intermediate states except when the promise resolves.

Required decision:
- Either fold `buildingPhase/reviewingPhase/iteratingPhase/savingPhase` into parent `executingChunks` as real nested states, or evolve `chunk-queue-machine` into the autonomous phase-lifecycle machine and persist status after every child transition.

Why it matters:
- Dashboard, compaction summaries, recovery, max iteration guards, and `before_agent_start` digests all need intermediate state visibility.

### 2. Replace “generic worker” with command-specific worker modes

Current state:
- `runWorker()` always spawns `pi -p --no-session @promptFile`.
- `buildWorkerPrompt()` says “execute exactly one chunk” but does not load `/b-build`, `/b-review`, `/b-iterate`, or `/b-save`.
- `RouteAction.spawn-worker.mode` supports only `build | review | save`; it lacks `iterate`.

Required decision:
- Define one worker contract per mode:
  - build: load/follow `b-build` or `b-build-hard` based on phase difficulty.
  - review: load/follow `b-review` with the phase/plan path as acceptance contract.
  - iterate: load/follow `b-iterate` with the active iterate artifact.
  - save: load/follow `b-save` or the current save equivalent.
- Extend types to include `iterate` and record mode in worker audits/results.

### 3. Specify the review/iterate artifact contract

Current state:
- `TransitionContext.artifacts.activeIterate` exists in types but `scan-context.ts` does not populate it.
- `queue-builder.ts` queues every `iterate-*.md` file without checking status or phase association.
- There is no deterministic `review.passed` parser.

Required decision:
- Define how b-review signals pass/fail:
  - preferred: review worker result frontmatter has `review_passed`, `issues_found`, and `iterate_file` fields;
  - and/or b-review creates a phase-scoped `iterate-<phase>-<n>.md` with `status: active` only when issues exist.
- Define stale iterate handling: completed iterate artifacts must not be re-queued; active iterate must be scoped to the current phase and latest review pass.

### 4. Define source of truth for phase completion

Current state:
- `buildQueue()` skips phases only when the phase file frontmatter says `status: completed`.
- Worker verification marks the in-memory queue item completed but does not update the phase artifact.
- On resume/rebuild, a completed queue can be lost if the phase file remains active.

Required decision:
- Decide whether phase status is derived from phase file frontmatter, `orchestration.json`, worker result files, or `b-save` side effects.
- Recommended: artifacts win on recovery, but `savingPhase` must explicitly mark the phase artifact completed and persist the updated queue/projection.

### 5. Reframe git safety so it does not block normal build/review flow

Current brainstorm guard says “block if uncommitted changes across phases.” That is too coarse because build/iterate naturally create uncommitted source diffs before review/save.

Recommended guard:
- Before starting a new phase: block if there are source changes not attributed to the just-completed phase/save result.
- Within a phase: allow source diffs during build/review/iterate/save.
- After save: require a clean handoff condition, or explicitly record dirty state in memory/projection if commits are out of scope.

### 6. Define stagnation with fingerprints

Current brainstorm says “no phase progress” but does not define progress.

Recommended fingerprint:
- `phaseId`
- current step
- review issue set hash
- git diff hash or changed file list hash
- active iterate artifact path/status
- last worker result status

Stagnation examples:
- same review issue hash appears after N iterate passes;
- iterate worker reports completed but `changed_files` is empty twice;
- active iterate artifact status never changes;
- same worker failure reason repeats.

### 7. Add cancellation and recovery requirements

Current state:
- `STOP` can abort the XState actor, but `runWorker()` does not expose an abort signal to kill the spawned `pi` child.
- `readWorkerContext()` always returns `{ active: false }`.
- `activeWorkerPid` exists in context but is not populated.

Required features:
- Worker subprocess audit should include pid/session metadata.
- STOP/PAUSE should terminate or detach intentionally.
- Recovery should detect an in-flight audit/result mismatch and block or reconcile.

### 8. Clarify Phase 1 vs Phase 2 boundary

The brainstorm says Phase 1 continues to the next phase automatically, while Phase 2 is “outer orchestration across all phases.” These overlap.

Recommended boundary:
- Phase 1: autonomous lifecycle for exactly one active phase, then stop at `phaseComplete` unless `--all-phases` or `--loop` is passed.
- Phase 2: repeated phase advancement, dashboard/history across phases, stop/resume loop controls.

Alternative:
- If `--autonomous` should process all queued phases now, Phase 2 becomes mostly dashboard/cancellation polish and should be renamed/de-scoped.

### 9. Keep guided mode behavior explicit

Current `confirmTransition()` exists but is not clearly in the b-flow command path for autonomous/guided transitions. The plan should state whether guided mode remains manual at the parent states or also gets per-step confirmations in the inner loop.

### 10. Update status/dashboard scope

Current `tmux-window-status.ts` is generic pi status icons, not b-flow-specific. It can be extended, but there is also a b-flow TUI status widget in `extensions/b-flow/ui.ts`.

Recommended:
- First persist `currentPhase`, `currentStep`, `iterationIndex`, and queue summary in `orchestration.json`.
- Then make both `/b-flow status` and compaction read that same projection.
- Treat tmux naming as best-effort display, not the source of truth.

## Scope for amended implementation plan

1. Normalize types and artifact contracts.
2. Add scan support for active phase-scoped iterate artifacts and review pass/fail data.
3. Refactor lifecycle ownership around either parent nested states or a streaming child queue actor.
4. Add command-specific worker prompts/modes.
5. Persist inner-loop status and iteration history.
6. Add guards: max iterations, stagnation fingerprint, worker task cap, and phase-transition git safety.
7. Extend `/b-flow run --autonomous` only after the underlying machine can progress deterministically.
8. Add focused tests before UI/dashboard polish.

## Out of scope for first ratified build

- Full outer Buck Loop dashboard.
- `/b-flow stop --loop` semantics beyond stopping the active autonomous run.
- Cross-session multi-plan orchestration.
- Model-based routing; deterministic routing is enough for this phase.

## Affected files

Likely affected:
- `extensions/b-flow/types.ts`
- `extensions/b-flow/scan-context.ts`
- `extensions/b-flow/classifier.ts`
- `extensions/b-flow/machine.ts`
- `extensions/b-flow/chunk-queue-machine.ts`
- `extensions/b-flow/worker.ts`
- `extensions/b-flow/queue-builder.ts`
- `extensions/b-flow/persistence.ts`
- `extensions/b-flow/index.ts`
- `extensions/b-flow/ui.ts`
- `extensions/tmux-window-status.ts` only after projection fields exist
- `extensions/b-flow/__tests__/*`

## Verification

Minimum tests before ratification build is considered done:
- classifier/router chooses build → review → save when review passes;
- classifier/router chooses build → review → iterate → review when issues exist;
- stale/completed iterate artifacts are ignored;
- max iterations blocks with a useful reason;
- repeated issue fingerprint blocks as stagnation;
- source diff is allowed within a phase but checked before next phase;
- worker prompts use the correct Buck skill per mode;
- persisted projection exposes phase/step/iteration for status and compaction;
- STOP during a worker does not leave an untracked child process.

## Risks

- Duplicating logic between parent machine and `chunk-queue-machine` will make recovery and tests brittle.
- Artifact status ambiguity can create infinite loops or rerun stale iterate files.
- Current generic worker prompt may bypass the intended Buck skills if not changed.
- Git safety can deadlock normal workflow if applied before review/save.
- Autonomous execution without child-process cancellation risks runaway subprocesses.

## Recommended next step

Amend the brainstorm into a ratified implementation plan that first answers the lifecycle-owner and artifact-contract decisions. This is large enough to benefit from phasing after amendment; run `/skill:b-phase` once the amended plan is accepted.
