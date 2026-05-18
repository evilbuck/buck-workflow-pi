---
status: active
date: 2026-05-18
subject: 2026-05-18.buck-loop
topics: [buck-loop, b-flow, resolved-decisions, autonomous]
research: []
iterations: []
spec:
memory: []
---

# Plan Addendum: Resolved Decisions for Autonomous Buck Loop

## Summary

This document resolves the open questions from `plan-ratification-feedback.md` with recommended defaults. These are intended as ratified implementation decisions unless explicitly changed.

## Resolved decisions

### 1. Lifecycle owner

**Decision:** The child queue/lifecycle actor owns autonomous phase execution. The parent `createBuckMachine` remains the coarse workflow owner.

- Parent `executingChunks` means “the queue/lifecycle actor is running.”
- The current promise-style `chunkQueue` actor must be changed so intermediate progress is persisted/observable, not only returned when complete.
- Implementation may either evolve `chunk-queue-machine.ts` directly or rename/split it later, but there must be one lifecycle owner for queue selection plus build/review/iterate/save steps.

**Rationale:** The project already has `chunk-queue-machine.ts`; adding a separate parent sub-loop would duplicate queue/current-item state and make recovery brittle.

### 2. Worker modes

**Decision:** Replace the generic worker prompt with command-specific worker modes.

Worker modes:

| Mode | Command/skill to invoke | Input |
| --- | --- | --- |
| `build` | `b-build` or `b-build-hard` based on phase difficulty | active phase path |
| `review` | `b-review` | active phase path plus plan/phase overview context |
| `iterate` | `b-iterate` | active iterate artifact path |
| `save` | `b-save` or current save-equivalent workflow | active phase path plus result summary |

Required type changes:
- Extend `RouteAction.spawn-worker.mode` to include `iterate`.
- Record worker `mode` in audit/result files.
- Worker prompt must explicitly load/follow the relevant skill, not just say “execute one chunk.”

### 3. Review result contract

**Decision:** `b-review` pass/fail is determined from review worker result frontmatter. Iterate artifacts are created only when review finds issues.

Review worker result frontmatter should include:

```yaml
chunk_id: <phase chunk id>
chunk_type: phase
mode: review
status: completed | completed_with_warnings | failed | blocked
review_passed: true | false
issues_found: true | false
requires_replan: true | false
iterate_file: .context/<subject>/iterate-<phase-slug>-<n>.md | null
issue_fingerprint: <stable hash of issue list>
```

Routing rule:
- `review_passed: true` and no `issues_found` → `savingPhase`.
- `requires_replan: true` → block/replan, not iterate.
- `issues_found: true` with `iterate_file` → `iteratingPhase`.
- missing/inconsistent fields → `blockedPhase` with a clear parser error.

### 4. Iterate artifact contract

**Decision:** Iterate artifacts are phase-scoped, status-aware, and single-active-per-phase.

Iterate frontmatter should include:

```yaml
status: active | completed | blocked
phase: phase-<n>-<slug>.md
iteration: <number>
source_review_result: .context/<subject>/worker-results/<review-result>.md
issue_fingerprint: <same hash from review>
completed_at: null | <ISO timestamp>
```

Scanner rule:
- `scan-context.ts` populates `artifacts.activeIterate` with the latest `status: active` iterate file for the active phase.
- Completed iterate artifacts are ignored by routing and queue building.
- If more than one active iterate exists for a phase, block and ask for reconciliation.

### 5. Phase completion source of truth

**Decision:** Runtime projection tracks progress, but phase file frontmatter is canonical for completed/not-completed on recovery.

Rules:
- During a run, `orchestration.json` is the live projection.
- On recovery, artifacts win over stale projection.
- `savingPhase` must update the phase file frontmatter to `status: completed` after successful build/review/iterate cycle.
- Worker result files are audit evidence, not the canonical phase state.

### 6. Git safety

**Decision:** Source diffs are allowed inside a phase. Git safety is checked only at phase boundaries and recovery boundaries.

Rules:
- Before starting a new phase: block if source changes exist that are not attributable to the just-completed phase/save result.
- During build/review/iterate/save for a phase: source diffs are expected and allowed.
- After `savingPhase`: record changed files in the save/memory artifact; if a clean tree is required by future policy, enforce it there.

### 7. Stagnation detection

**Decision:** Stagnation is detected by repeated fingerprints, not by vague “no progress.”

Fingerprint fields:
- `phaseId`
- current step
- `issue_fingerprint`
- changed-file list hash or git diff hash
- active iterate artifact path/status
- last worker result status and block/failure reason

Block when any of these occur:
- same `issue_fingerprint` appears after 3 iterate passes;
- iterate completes twice with no changed files;
- same worker failure/block reason repeats 3 times;
- active iterate status does not advance after a completed iterate worker.

### 8. Max iterations

**Decision:** Keep default max at 5 iterations per phase.

Behavior:
- Iteration count increments on each `review → iterate → review` cycle.
- At 5, block with a summary of issue fingerprints, changed files, and iterate artifacts.
- User can resume after manual intervention with an explicit `USER_CONFIRMED`/continue action.

### 9. Cancellation and recovery

**Decision:** Autonomous mode must track and control worker subprocesses.

Required behavior:
- `runWorker()` records child pid, mode, started time, chunk id, and result path in the audit file and projection.
- `STOP` kills the active worker process if still running, then marks the run aborted.
- `PAUSE` should not start new workers; if a worker is active, either let it finish then pause, or block with “worker active” depending on implementation simplicity.
- Recovery scans worker audit/result files:
  - audit started + no result + process alive → block as active worker;
  - audit started + no result + process dead → block as orphaned/failed worker;
  - result exists → reconcile projection from result.

### 10. Phase 1 vs Phase 2 boundary

**Decision:** Phase 1 runs one pass over the currently built queue. Phase 2 is the richer outer loop.

Phase 1:
- `/b-flow run --autonomous` builds the current queue once and can advance through all queued phase files.
- It does not dynamically rebuild the plan/phase queue after completion except via explicit resume/recovery.
- It owns build/review/iterate/save for each queued phase.

Phase 2:
- Adds true “Buck Loop” wrapper behavior: repeated queue rebuilds, cross-run stagnation, richer dashboard, loop-specific stop/resume controls, and long-lived orchestration across compactions/sessions.

### 11. Guided vs autonomous behavior

**Decision:** Guided mode remains safe/manual; autonomous mode skips normal confirmations but still blocks on guardrails.

Guided mode:
- Confirms before build, review, iterate, save, and next-phase transition.
- Useful for testing and high-risk plans.

Autonomous mode:
- Runs build/review/iterate/re-review/save without confirmations.
- Blocks on max iterations, stagnation, parser ambiguity, requires-replan, worker failure, active-worker recovery conflict, or unsafe phase-boundary git state.

### 12. Status/dashboard source of truth

**Decision:** `orchestration.json` is the status source of truth; tmux/TUI are projections.

Add projection fields similar to:

```ts
active?: {
  chunkId: string;
  phasePath: string;
  step: "build" | "review" | "iterate" | "save";
  iteration: number;
  maxIterations: number;
  workerPid?: number;
  lastResultFile?: string;
  issueFingerprint?: string;
};
```

Add per-queue-item iteration history:

```ts
iterations?: Array<{
  iteration: number;
  reviewResultFile?: string;
  iterateFile?: string;
  iterateResultFile?: string;
  issueFingerprint?: string;
  changedFiles?: string[];
  status: "active" | "resolved" | "blocked";
}>;
```

Then:
- `/b-flow status` reads projection.
- `session_before_compact` summarizes projection.
- tmux window status may display `buck: phase N review i2/5`, but only as best-effort UI.

## Implementation order

1. Type/schema updates for worker modes, active state, and iteration history.
2. Review/iterate artifact scanning and parser helpers.
3. Worker prompt modes and audit pid tracking.
4. Queue/lifecycle actor refactor with build/review/iterate/save states.
5. Persistence/recovery reconciliation.
6. Guardrails: max iterations, stagnation, phase-boundary git safety.
7. `/b-flow run --autonomous` wiring.
8. Status/compaction updates.
9. tmux/TUI polish.

## Acceptance tests

- Build → review pass → save → next phase.
- Build → review issues → iterate → review pass → save.
- Review requires replan → block, not iterate.
- Completed iterate artifacts are ignored.
- Multiple active iterate artifacts block.
- Max iterations blocks at 5.
- Repeated issue fingerprint blocks as stagnation.
- Source diff is allowed inside a phase but checked before next phase.
- STOP kills or reconciles active worker.
- Recovery handles stale audit/result mismatch.
