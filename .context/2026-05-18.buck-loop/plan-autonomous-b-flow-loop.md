---
status: active
date: 2026-05-18
subject: 2026-05-18.buck-loop
topics: [buck-loop, b-flow, autonomous, xstate, orchestration]
research: []
iterations: [iterate-buck-loop.md]
spec:
memory: [buck-loop-phase-3-lifecycle-2026-05-18.md]
---

# Plan: Autonomous b-flow Inner Loop

## Goal

Implement Phase 1 of Buck Loop: make `/b-flow run --autonomous` execute the current b-flow queue through a deterministic autonomous lifecycle for each phase:

```text
select phase → build → review → iterate as needed → re-review → save → next phase
```

The autonomous loop must be artifact-driven, recoverable, cancellable, and safe by default. It should reuse the existing b-flow architecture rather than introduce a second competing orchestration layer.

## Context used / assumptions

- User-provided context:
  - `.context/2026-05-18.buck-loop/brainstorm-buck-loop.md`
  - `.context/2026-05-18.buck-loop/plan-resolved-decisions.md`
- Session context:
  - Buck workflow mode and plan mode are active.
  - Source edits are deferred until `/b-build` or `/b-build-hard`.
- Relevant code inspected:
  - `extensions/b-flow/machine.ts`
  - `extensions/b-flow/chunk-queue-machine.ts`
  - `extensions/b-flow/classifier.ts`
  - `extensions/b-flow/types.ts`
  - `extensions/b-flow/scan-context.ts`
  - `extensions/b-flow/worker.ts`
  - `extensions/b-flow/queue-builder.ts`
  - `extensions/b-flow/persistence.ts`
  - `extensions/b-flow/index.ts`
  - `extensions/b-flow/ui.ts`
  - `extensions/tmux-window-status.ts`
  - existing b-flow tests
- Key resolved assumptions:
  - The child queue/lifecycle actor owns queue selection and per-phase build/review/iterate/save lifecycle.
  - Parent `createBuckMachine` remains the coarse workflow owner.
  - `orchestration.json` is live runtime state; phase file frontmatter is canonical on recovery.
  - Phase 1 runs one pass over the current queue. Phase 2 adds richer outer-loop behavior.

## Scope

Implement autonomous Phase 1 only:

- add explicit worker modes: `build`, `review`, `iterate`, `save`;
- make review results machine-readable;
- make iterate artifacts phase-scoped and status-aware;
- refactor/evolve `chunk-queue-machine.ts` into the per-phase lifecycle owner;
- persist active step/iteration progress to `orchestration.json`;
- add guardrails for max iterations, stagnation, worker failures, and phase-boundary git safety;
- wire `/b-flow run --autonomous` to execute without routine confirmations while preserving blocking guardrails;
- update `/b-flow status`, compaction summary, and best-effort display from projection state;
- add focused unit/integration tests.

## Out of scope

- Full Phase 2 Buck Loop wrapper.
- Dynamic queue rebuilds after the first autonomous queue pass.
- Rich web/dashboard UI.
- Cross-plan or cross-session orchestration beyond recovery of the active b-flow run.
- Model-based classifier/routing. Routing should be deterministic for this phase.
- Reworking unrelated Buck skills.

## Affected files

Primary implementation files:

- `extensions/b-flow/types.ts`
- `extensions/b-flow/scan-context.ts`
- `extensions/b-flow/verify-result.ts`
- `extensions/b-flow/worker.ts`
- `extensions/b-flow/queue-builder.ts`
- `extensions/b-flow/chunk-queue-machine.ts`
- `extensions/b-flow/machine.ts`
- `extensions/b-flow/persistence.ts`
- `extensions/b-flow/index.ts`
- `extensions/b-flow/ui.ts`

Likely test files:

- `extensions/b-flow/__tests__/scan-context.test.ts`
- `extensions/b-flow/__tests__/machine.test.ts`
- `extensions/b-flow/__tests__/integration.test.ts`
- new tests as needed for worker prompts/result parsing/recovery

Optional/polish:

- `extensions/tmux-window-status.ts`
- `extensions/tmux-window-status.test.ts`

## Implementation steps

### 1. Update core types and projection schema

In `extensions/b-flow/types.ts`:

- Add `WorkerMode = "build" | "review" | "iterate" | "save"`.
- Extend `RouteAction.spawn-worker.mode` to use `WorkerMode`.
- Add per-queue-item `iterations[]` history.
- Add `OrchestrationState.active` with:
  - `chunkId`
  - `phasePath`
  - `step`
  - `iteration`
  - `maxIterations`
  - `workerPid?`
  - `lastResultFile?`
  - `issueFingerprint?`
- Add result/scan types for review outcomes and active iterate metadata.

Keep schema migration tolerant: existing `orchestration.json` files without new fields must still load.

### 2. Define machine-readable result parsing

In `extensions/b-flow/verify-result.ts` or a small adjacent parser module:

- Parse existing worker result fields as today.
- Add review-specific fields:
  - `mode`
  - `review_passed`
  - `issues_found`
  - `requires_replan`
  - `iterate_file`
  - `issue_fingerprint`
- Treat missing/inconsistent review fields as a blocking parse result, not as success.
- Preserve existing behavior for non-review worker results.

### 3. Implement active iterate scanning

In `extensions/b-flow/scan-context.ts`:

- Find latest active phase as today.
- Scan subject folder for `iterate-*.md` files.
- Parse frontmatter for:
  - `status`
  - `phase`
  - `iteration`
  - `source_review_result`
  - `issue_fingerprint`
- Populate `artifacts.activeIterate` only when exactly one `status: active` iterate file matches the active phase.
- If multiple active iterate files match, record enough conflict metadata for the lifecycle actor to block.
- Ignore completed iterate files for routing.

### 4. Stop queueing stale iterate files as independent work

In `extensions/b-flow/queue-builder.ts`:

- Remove or narrow the current “queue all `iterate-*.md` files” behavior.
- Completed iterate files must never become fresh pending queue items.
- Active iterate files should be consumed by the current phase lifecycle, not selected as independent queue chunks unless an explicit future policy requires it.

### 5. Add command-specific worker modes

In `extensions/b-flow/worker.ts`:

- Change `runWorker(chunk, options)` to accept a `mode` and any mode-specific input path.
- Build prompts that explicitly load/follow the appropriate Buck skill:
  - build: `skills/b-build/SKILL.md` or hard variant behavior for difficult phases;
  - review: `skills/b-review/SKILL.md` with phase/plan acceptance contract;
  - iterate: `skills/b-iterate/SKILL.md` with active iterate artifact;
  - save: `b-save` equivalent/current save workflow instructions.
- Include expected result frontmatter per mode.
- Record mode, child pid, chunk id, started time, and result path in worker audit files.
- Expose enough process metadata for STOP/recovery handling.

### 6. Evolve `chunk-queue-machine` into the lifecycle owner

In `extensions/b-flow/chunk-queue-machine.ts`:

- Replace the generic `spawningWorker → readingResult → verifyingChunk → completedChunk` flow with explicit per-phase lifecycle states:
  - `selectingNext`
  - `checkingPhaseBoundarySafety`
  - `buildingPhase`
  - `reviewingPhase`
  - `iteratingPhase`
  - `savingPhase`
  - `phaseComplete`
  - `blockedPhase`
  - `queueExhausted`
- Increment iteration count on `review → iterate → review` cycles.
- Route deterministically:
  - build success → review;
  - review passed → save;
  - review requires replan → block;
  - review issues + active iterate → iterate;
  - iterate success → review;
  - save success → mark phase completed → next phase.
- Persist active step/iteration/progress after each transition.

### 7. Persist and reconcile runtime projection

In `extensions/b-flow/persistence.ts`, `machine.ts`, and the child lifecycle actor:

- Ensure every meaningful lifecycle transition updates `orchestration.json`.
- Keep parent `executingChunks` as the coarse state while child `active.step` shows build/review/iterate/save.
- On child completion, parent receives the final queue and transitions as today.
- On recovery, reconcile:
  - phase file frontmatter wins for completed/not-completed;
  - worker result files reconcile completed attempts;
  - orphaned worker audits block with useful reasons;
  - stale projection without matching artifacts is corrected or blocked.

### 8. Implement guardrails

Add pure helpers where possible, likely in `extensions/b-flow/guards.ts` or a lifecycle helper module:

- Max iterations: default 5 per phase.
- Stagnation:
  - same issue fingerprint after 3 iterate passes;
  - two iterate completions with no changed files;
  - same failure/block reason 3 times;
  - active iterate status not advancing after completed iterate worker.
- Phase-boundary git safety:
  - allow source diffs inside build/review/iterate/save;
  - before starting a new phase, block if source changes cannot be attributed to just-completed phase/save result.
- Parser ambiguity and multiple active iterate artifacts block.

### 9. Wire autonomous/guided behavior

In `extensions/b-flow/index.ts` and `extensions/b-flow/ui.ts`:

- `/b-flow run --autonomous` sets autonomous mode and starts the lifecycle actor.
- Autonomous skips routine step confirmations.
- Guided mode confirms build, review, iterate, save, and next-phase transition.
- Both modes block on guardrails.
- STOP aborts parent and kills/reconciles active worker if possible.
- PAUSE does not start new workers; simplest acceptable behavior is “finish current worker, then pause” or block while worker active.

### 10. Update status, compaction, and display

In `extensions/b-flow/index.ts` and `extensions/b-flow/ui.ts`:

- `/b-flow status` shows:
  - current parent state;
  - active phase/chunk;
  - active step;
  - iteration `n/5`;
  - last result file;
  - blocked reason if any.
- `before_agent_start` digest includes active step/iteration and links to phase, iterate, and result files.
- `session_before_compact` summarizes active lifecycle progress.
- Tmux naming is optional polish after projection fields exist.

### 11. Add tests first around contracts, then machine flow

Minimum test coverage:

- Result parser:
  - review pass;
  - review issues with iterate file;
  - review requires replan;
  - malformed review result blocks.
- Scan context:
  - active iterate detected;
  - completed iterate ignored;
  - multiple active iterates conflict.
- Queue builder:
  - stale iterate artifacts are not queued as independent chunks.
- Worker prompt:
  - each mode loads the correct Buck skill/instructions.
- Lifecycle machine:
  - build → review pass → save → next phase;
  - build → review issues → iterate → review pass → save;
  - max iterations blocks;
  - stagnation blocks;
  - phase-boundary git safety blocks only at boundaries.
- Recovery/cancellation:
  - STOP with active worker kills or records reconciliation state;
  - orphaned audit without result blocks.

## Verification

Run narrow tests first, then full suite:

```bash
npm test -- extensions/b-flow
npm test
```

If test filtering differs under Vitest, use the closest supported pattern, e.g. targeted test files under `extensions/b-flow/__tests__/`.

Manual smoke verification after tests:

1. Create a tiny phased subject folder with one phase that should pass review.
2. Run `/b-flow start <goal>`.
3. Run `/b-flow run --autonomous`.
4. Confirm projection shows build/review/save and then completion.
5. Repeat with a review-result fixture that creates an active iterate artifact.
6. Confirm iterate → re-review → save happens or blocks with the expected guardrail.

## Risks

- XState actor persistence can become fragile if child lifecycle state and parent projection disagree.
- Worker subprocess cancellation may need careful process handling to avoid orphaned `pi` processes.
- b-review/b-iterate skills may need prompt-contract updates if they do not reliably emit the needed artifacts.
- Save-mode behavior may expose a missing `b-save` skill/command contract and require a minimal save-equivalent implementation.
- Git safety attribution can be approximate at first; guard messages should be conservative and explain how to resume.

## Recommended phasing

This plan exceeds the normal single-pass threshold: it touches more than five files, changes the orchestration state machine, alters worker contracts, and requires substantial tests.

Run `/skill:b-phase` before implementation. Suggested phases:

1. Types/contracts/parsers/scanners.
2. Worker modes and prompt/audit contracts.
3. Lifecycle actor refactor and projection persistence.
4. Guardrails and recovery/cancellation.
5. Status/compaction/display polish.
6. Full integration tests and smoke verification.
