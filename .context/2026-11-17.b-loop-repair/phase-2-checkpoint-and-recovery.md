---
status: completed
phase: 2
order: 2
plan: plan-b-loop-repair.md
phases_overview: plan-b-loop-repair-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Implement one versioned private checkpoint per (subject, branch, worktree) with writer serialization, shared four-stage/phase milestones, blockers, progress labels, and proof-driven recovery."
omp_execution: none
files:
  - skills/b-loop/scripts/types.ts
  - skills/b-loop/scripts/validation.ts
  - skills/b-loop/scripts/checkpoint-cli.ts
  - skills/b-loop/scripts/checkpoint.ts
  - skills/b-loop/scripts/recovery.ts
  - skills/b-loop/scripts/eval-buck-loop.ts
  - skills/b-loop/scripts/checkpoint.test.ts
  - skills/b-loop/scripts/eval-buck-loop.test.ts
from_plan_steps: [2]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[x] One versioned private checkpoint per `(subject, branch, worktree)` is persisted and read back via `workflow_state` CAS (`expectedRevision` / revision verification), and any checkpoint write or readback mismatch blocks further side effects."
  - "[x] Checkpoint schema stores pinned plan & phase identity, completed phase commit IDs, current phase/stage/milestone, `attemptId`, `updatedAt`, stage proof references, and optional structured blocker (`reason`, `nextSafeAction`)."
  - "[x] Shared 4 milestones (`starting`, `working`, `finished`, `verified`) are persisted and emitted for every stage, alongside derived phase milestones (`starting`, `working`, `finished`, `verified`), matching format `Phase N · <stage> <milestone>` and `· blocked` when blocked."
  - "[x] Concurrent invocations in the same `(subject, branch, worktree)` serialize via trusted writer ownership/lock check so a second live invocation yields to the active writer rather than mutating checkpoint or stages."
  - "[x] Recovery reads the private checkpoint before plan completion markers: detects Git-proof gaps when a plan already marks a phase complete, preserves existing work, reloads the first stage with missing/invalid proof, checks attempt acceptance/effects at `starting`/`working`, verifies `finished` results before `verified`, and reuses `verified` proofs."
completed_at: 2026-11-17
completed_by: Antigravity
---

# Phase 2: Private Checkpoint, Locking, Milestones & Recovery

## Context

Parent plan User Goal: When a phase fails or gets interrupted, Buck operators and their agents can see what finished and continue by running the same `/b-loop <subject>` command.

Phase 1 validated entry resolution and pre-flight inputs. Currently `eval-buck-loop.ts` persists `.context/workflow/buck-loop.json` instead of a versioned private adapter checkpoint, has no writer serialization, lacks uniform milestone transitions, and relies on plan markers rather than verified proofs. This phase implements the trusted `(subject, branch, worktree)` private checkpoint seam, shared milestone model, derived phase progress output, concurrent writer yielding, and stage-agnostic recovery skeleton.

## Implementation Details

1. **Private versioned checkpoint seam (`workflow_state`)**:
   - Store one versioned private checkpoint artifact in `workflow_state` bound to `(subject, branch, worktree)` (note `workflow_state` binds branch/worktree/run privacy automatically per repo-files policy; use revision CAS `expectedRevision` and read-after-write verification).
   - Fail closed immediately (before dispatching or advancing side effects) if checkpoint read, write, or readback verification fails.
2. **Checkpoint payload & blocker model**:
   - Store schema version, `(subject, branch, worktree)` binding, pinned plan revision/phase order, completed phase commit ID map, current phase order/ID, current stage (`build | review | save | commit`), current milestone (`starting | working | finished | verified`), `attemptId`, job handle metadata (when available), `updatedAt`, stage proof records, and optional blocker (`lastMilestone`, `reason`, `nextSafeAction`).
   - Derive phase milestone from checkpoint state:
     - `starting`: phase inputs pinned
     - `working`: from `build` dispatch through `commit` work
     - `finished`: when `commit` records its terminal outcome (`finished`)
     - `verified`: when commit proof (plus subject closeout on final phase) is verified
3. **Live progress emission**:
   - Emit both phase and stage milestones via OMP `phase()` and `log()` on every transition and blocker, preserving last milestone on block (e.g., `Phase 2 · b-review finished · blocked: <reason>; next: <action>`).
4. **Concurrent writer serialization**:
   - Establish writer lock / active owner tracking (bound to `(subject, branch, worktree)` with liveness check such as process/lockfile in trusted runtime state + `attemptId`) so a second invocation sees an active writer, emits a clear status/yield message, and exits without colliding or overwriting checkpoints.
   - Stale locks whose writer process is confirmed dead recover safely via the recorded `starting`/`working`/`finished` milestone recovery rules; if liveness is uncertain, block with `attemptId`.
5. **Checkpoint-first recovery & completion-gap detection**:
   - Always inspect the private checkpoint before trusting phase/plan completion checkboxes.
   - If the plan or phase frontmatter marks a phase complete without a matching verified Git commit proof in checkpoint/Git, stop and report the gap while preserving working tree state.
   - On restart at `starting`: inspect whether `attemptId` already landed or was accepted before generating a new `attemptId`.
   - On restart at `working`: wait/check live writer; if dead, inspect durable effects/results before retrying or block if uncertain.
   - On restart at `finished`: run verifier against recorded result before transitioning to `verified` or reloading stage on missing/stale proof.
   - On `verified`: reuse stored proof and advance cleanly to next stage/phase.

## Risks

- **Crash between durable write and revision update**: Readback mismatch or lost CAS revision could cause silent state divergence.
  - *Mitigation*: Always pass `expectedRevision`, read back via `workflow_state` to confirm exact bytes/revision, and abort before any downstream stage effect on mismatch.
- **Ambiguous writer liveness after SIGKILL**: Reclaiming an actually-live writer corrupts state; refusing dead locks wedges recovery.
  - *Mitigation*: Store PID/starttime or exclusive flock/lease in worktree-private lock location where OS kernel releases flock automatically on crash, plus heartbeat/attemptId check when lock cannot be taken.

## Verification

- Unit/integration tests simulating checkpoint read/write/readback failure, concurrent writer yield, `starting`→`working`→`finished`→`verified` milestone persistence, derived phase milestones, blocker preservation, completion-marker vs Git-proof gap detection, and recovery entry from each milestone.
- Zero bare npm specifiers check (`eval-buck-loop.test.ts` import audit) + OMP worker import verification.
- `npm run guardrails:check` and `npm run subject-lifecycle:check`.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
