---
name: b-loop
description: Run unattended Buck phase loops for one named subject in OMP via installed module import using native agent(), judge(), sh(), and workflow_state.
---

# /b-loop: Autonomous Buck Phase Loop Runner (OMP 18.x)

`/b-loop <subject>` runs one named subject's discrete phased Buck workflow plan in Oh My Pi (OMP 18.x). Each phase runs `build -> review -> save -> commit` on a named local Git branch with the `repo-files` store and no `integration_ref`.

## Syntax

```bash
/b-loop <subject>
```

### Arguments

- `<subject>`: Required subject identifier for an existing discrete phased plan (for example `2026-11-17.b-loop-repair`). Automatic subject discovery, unphased plans, review candidate ranking, automatic `b-iterate` repair loops, and removed control or profile flags (status, resume, stop, profile) are unsupported and rejected before dispatching any stage.

## Invocation Contract

When `/b-loop <subject>` is triggered, `prompts/b-loop.md` (and symlink `commands/b-loop.md`) resolves the installed `skills/b-loop/scripts/eval-buck-loop.ts` module path, imports it via `import()`, and calls `runBuckLoop` once inside `eval` (`language: "js"`, `timeout: 0`) with `{ args, cwd, bridges }`:

- **Fail-closed bridge check**: `agent`, `wait`, `judge`, `sh`, `phase`, `log`, and `tool.workflow_state` must all be present; the runner never substitutes mock bridges.
- **Pre-flight checks**: verifies a named Git branch with a valid `HEAD` commit (rejecting detached `HEAD` and unborn branches), checks effective storage configuration (`repo-files` only, no `integration_ref`), and pins the ordered discrete `phase-*.md` artifacts via `workflow_state`.
- **Single-writer lock & private checkpoint**: stores one versioned private checkpoint per `(subject, branch, worktree)` using `FileStorageStore` (`b-loop/checkpoint.json`) with CAS + readback verification and an atomic writer lock (`state: "yielded"` if another live writer owns that binding).
- **Non-OMP harnesses**: standalone Pi and Claude Code do not expose OMP's `eval` bridges; run `/b-build` → `/b-review` → `/b-save` → `/b-commit` manually per phase.

## Shared Milestones & Stage Boundaries

Every stage (`build`, `review`, `save`, `commit`) and every phase reports the same four milestones in order:

- **Stages**: `Phase N · b-build|b-review|b-save|b-commit starting|working|finished|verified` (logged with `· blocked` + `reason`, `nextSafeAction`, and optional `attemptId` on failure)
- **Phases (derived)**: `Phase N · starting|working|finished|verified` (emitted via `phase()` for the status bar)

Per-stage rules:

- **`build`**: invokes `b-build` or `b-build-hard` (`STAGE_TOOLS.build`), preserves partial worktree edits on interruption, and checks each phase acceptance criterion via keyed native `judge()` (`bool >= 0.7`, reading direct OMP answers cleanly).
- **`review`**: strictly read-only plus `workflow_state` (`STAGE_TOOLS.review` excludes `edit`, `write`, `bash`); binds to the verified build worktree fingerprint (including file permissions, symlinks, staged diffs, and deletions); preserves `review-*.md`/`iterate-*.md` and halts `save` at `b-review finished · blocked` if actionable findings exist (`MAX_PHASE_REWINDS = 3` on stale worktree drift).
- **`save`**: binds `attemptId` (`write-receipt` `no-fact` `"attempted"` + private `run-state` journal, falling back cleanly to `workflow-state-cli.ts` when `workflow_state` uses `write` role) before saving, seals `"rows"` `complete` with `metadataDuties` + strict post-seal readback, and halts with `attemptId` if stale or ambiguous.
- **`commit` & closeout**: refuses pre-existing staged index entries (including `.context/workflow/`) and unrelated dirty/untracked files outside `.context/<subject>/`, `.context/memory/`, `.context/backlog/`, and declared phase `files:`; pins deterministic phase/overview SHAs to the checkpoint before `workflow_state` writes; folds `subject-lifecycle.ts close-verified` into the final phase commit; pins `(baselineHead, expectedTree)` prior to committing; adopts single-parent commits matching that pin after crashes; and derives `done` strictly from reachable verified commits across all phases plus verified closeout.

## Recovery

Re-running `/b-loop <subject>` in the same branch/worktree loads the private checkpoint first, verifies plan/branch/worktree binding, adopts already-finished save/commit work when proofs match, or resumes cleanly once the reported blocker is fixed. See `docs/buck-loop.md` and `docs/howto/recover-buck-loop.md`.
