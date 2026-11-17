---
status: active
date: 2026-11-17
updated: 2026-11-17
subject: 2026-11-17.b-loop-repair
topics: [b-loop, omp, checkpoints, recovery]
research: []
iterations: [iterate-phase-1-entry-and-validation.md]
memory: [b-loop-phase-1-2026-11-17.md]
---

# Repair and simplify `/b-loop`

## User Goal

When a phase fails or gets interrupted, Buck operators and their agents can see what finished and continue by running the same `/b-loop <subject>` command.

## Goal

Run one named subject's discrete phases in OMP. Each phase follows build → review → save → commit. Advance on verified evidence, and keep enough state to recover from an interrupted stage.

## Context used / assumptions

- The audit at `1f02867` reproduced an OMP 18.22.0 startup error from `%load`, invalid judge arguments, stale review selection, and a `done` result even when Git and subject closeout disagreed. Direct module import worked in the same runtime.
- The user asked to drop optional controls and keep progress and recovery within the normal invocation. The progress labels should show when each stage and phase starts, is working, finishes, and is verified. A new subject records this repair separately from the [eval cutover plan](../2026-11-16.omp-eval-loop-research/plan-omp-eval-loop.md).
- This checkout selects `repo-files` and has no publication integration ref. Start with that configuration and a named Git branch.

## Scope

Require a subject ID for one existing discrete plan. Resolve its phase artifacts through `workflow_state` and pin the order and execution inputs. Start a fresh run on a clean worktree. Use the existing Buck build, review, save, commit, and subject lifecycle procedures for the phase. OMP reports the current phase, stage, milestone, and any blocker.

## Out of scope

Separate `--stop`, `--resume`, `--status`, or profile controls. Automatic subject selection, review ranking, automatic fix loops, and activity history. Support for unphased plans, other storage configurations, and integration publication is outside this first repair. Reject those configurations before dispatching a stage.

## Progress and recovery

Keep one versioned, private checkpoint for the subject in its bound Git branch and worktree. Reuse the workflow adapter's checkpoint and revision readback pattern. Store the pinned plan and phase identity, completed phase commit IDs, current stage and milestone, stage attempt ID, last update time, and the proof references below.

Use the same four milestones for build, review, save, and commit.

| Milestone | What to persist | What recovery does |
| --- | --- | --- |
| `starting` | Persist the attempt ID and any required input or baseline before dispatch. | Check whether this attempt was accepted or produced an effect before dispatching again. |
| `working` | Record that execution began and keep the job handle when available. | Wait for a live attempt. If its writer has stopped, check its result and durable effects before retrying. If liveness is uncertain, block with the attempt ID. |
| `finished` | Record the terminal outcome or recovered result of this attempt. | Verify that result first. Use the stage-specific recovery rule if proof is missing or stale. |
| `verified` | Persist the proof that the stage's required result matches the pinned inputs. | Reuse matching proof and advance to the next stage. |

Record a blocker alongside the last milestone, with a short reason and the next safe action. For example, `Phase 2 · b-review finished · blocked` can represent a completed review with actionable findings.

Derive the phase milestones from the same checkpoint. The phase is `starting` after its inputs are pinned, `working` from the build dispatch through commit work, `finished` when the commit stage records its outcome, and `verified` when the commit proof is recorded. The final phase's commit proof includes subject closeout. Recover by checking the checkpoint before advancing to another phase.

| Stage | Record | Pick up here |
| --- | --- | --- |
| Build | Phase revision, acceptance evidence, and a fingerprint of the resulting work | Keep partial changes. If the accepted build evidence is missing or stale, rerun the build and its checks against the current worktree. |
| Review | A fresh verdict and evidence tied to the exact build and worktree fingerprint | Reuse the review when its evidence still matches. Retry an interrupted review. For actionable findings, keep the report and block save. After the fix, revalidate the changed build and run a fresh review. |
| Save | Save attempt or run ID before apply, then the verified save result and exact artifact revisions | Read back the same attempt. Accept a completed save or recover its existing apply journal. If its outcome is ambiguous, surface the blocker before starting another save. |
| Commit | Starting `HEAD` before staging, the expected staged tree before commit, and the verified resulting commit ID | If `HEAD` is still at the baseline and the recorded changes match, continue the checkpoint. If one commit with the recorded parent and tree already landed, adopt it. An unexpected index, tree, or `HEAD` blocks recovery. |

Read an existing checkpoint before using completion markers to choose a phase. If a plan already marks a phase complete and its Git proof is missing, report the gap and preserve the existing work. Reload the first stage whose proof is missing or invalid. Verify a matching stage result before dispatching the next stage. A second invocation in the same worktree must yield to a live writer. A checkpoint write or readback failure blocks the next side effect.

Fold final subject closeout into the final commit preparation. After verifying earlier phase commits and the last save, use `close-verified` to update the subject and include the resulting revision in the staged tree. Treat `done` as a derived result of verified Git checkpoints for every phase and verified subject closeout. If interrupted after the lifecycle update, the saved commit checkpoint remains the entry point even when the index already says completed.

## Affected files

- `prompts/b-loop.md` and `skills/b-loop/SKILL.md` for the invocation contract.
- `skills/b-loop/scripts/` for the runner, its trusted checkpoint seam, and regression tests. Reuse the existing workflow adapter and stage boundaries.
- `README.md`, `docs/buck-workflow.md`, and the loop and recovery docs for current command usage.

## Implementation steps

1. Use an explicit module import from the installed skill's resolved path and call the runner once with the subject and required OMP bridges. Validate the named branch, target plan, and supported storage config before work.
2. Persist and read back each milestone transition. Bind the checkpoint to the trusted worktree and branch and serialize writers. Recover using the recorded attempt and evidence. Derive the phase milestones and emit both phase and stage progress from this checkpoint.
3. Use the existing build acceptance process, including native judgment when the skill requires it. Use a fresh review tied to the accepted build. Remove the runner's separate judge and ranking path. Keep restricted stage tools and bind each save to its existing journal or receipt before apply.
4. Stage verified metadata and declared phase paths. Refuse unrelated changes and existing staged changes on a fresh run. Pin the index tree before commit, confirm the parent and tree after commit, and record the proof before moving on.
5. Replace the import-only smoke test with a real OMP command-path test and update the user-facing docs.

## Acceptance criteria

- [ ] The packaged `/b-loop <subject>` prompt starts in OMP from a separate project checkout and executes a two-phase fixture in order.
- [ ] The normal path exposes `starting`, `working`, `finished`, and `verified` for each stage and phase. A blocker preserves the last milestone. Re-entry checks a finished stage's proof before retrying it and dispatches the next stage only after verification.
- [ ] Failed acceptance, actionable or stale review, missing or unverified save, failed Git probes, and failed closeout each prevent advancement at the applicable boundary.
- [ ] Interruptions after durable save and after Git commit reuse the recorded effects. A changed branch, stale input, or mismatched committed tree cannot be adopted.
- [ ] The final commit contains the verified subject closeout, and invoking the same finished subject again makes no new commit.

## Verification

Use a disposable feature worktree and repo-files store. Drive the actual OMP entry with local fixture agents and real Git. Assert the normal phase and stage milestone order. Interrupt before dispatch, after dispatch, and between `finished` and `verified`. Include crashes after save apply and after commit but before checkpoint writeback. Cover concurrent invocation, wrong-subject selection, and unrelated staged files. Run the focused runner tests, `npm run guardrails:check` for the code changes, and `npm run subject-lifecycle:check`.

## Decision Closure

Use one normal invocation and one private checkpoint. The audit proved the import-based entry works and a stage label alone cannot prove completion. The prior cutover record remains linked above. First prove command startup and target binding in the fixture, then add checkpoint transitions and test their recovery before enabling commit.

## Assumptions Ledger

| ID | Statement | Status | Blocking | Evidence or validation path |
| --- | --- | --- | --- | --- |
| A-1 | OMP 18.22.0 can load the TypeScript runner through its module import path. | validated | false | The audit imported the module and read the fixture snapshot through installed OMP. |
| A-4 | The packaged command can resolve the installed runner from a separate target worktree. | deferred | false | In step 1, exercise the entry with the installed package and a fixture worktree that lacks Buck's source files before enabling any stage effects. |

## Material Risks

| Failure mode and impact | Mitigation and recovery validation |
| --- | --- |
| A save or commit lands just before its success marker and replay could duplicate it. | Pin the effect identity first. Re-enter after the effect in a fresh process and verify exactly one save and one commit. |
| A changed ref, index, or review input makes saved evidence unsafe. | Preserve the working state and print the failing comparison. Change each input in a fixture and verify that the loop stops before further writes. |
| The packaged OMP entry or required bridge fails. | Validate before dispatch. Verify the failure launches no phase, and prove the existing manual build → review → save → commit path still works on the fixture. |

## Revision Log

### 2026-11-17 — Define phase and stage milestones

- Added shared milestones and derived phase progress.
- Refined checkpoint recovery, progress output, implementation, and verification.
- Used the user's build and phase examples and the existing recovery plan.
