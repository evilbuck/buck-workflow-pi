# `/b-loop` Runner Contract (OMP 18.x)

`/b-loop <subject>` executes a single named subject's discrete phased plan inside Oh My Pi (`omp`) without extension-based background supervision (`extensions/buck-loop/` is unwired).

## Invocation & Pre-Flight Scope

```text
/b-loop <subject>
```

- **Explicit installed module import**: `prompts/b-loop.md` (and symlink `commands/b-loop.md`) resolves installed `skills/b-loop/scripts/eval-buck-loop.ts` (from `BUCK_LOOP_RUNNER`, OMP plugin/agent skills paths, or local checkout) and invokes `runBuckLoop({ args, cwd, bridges })` inside `eval` (`language: "js"`, `timeout: 0`).
- **Supported target**: one valid subject ID matching an existing discrete phased plan under `repo-files` storage without `integration_ref`, running on a named local Git branch with a resolved `HEAD` commit.
- **Removed flags and paths**: legacy control/profile flags (status, resume, stop, profile), automatic subject discovery, unphased plans, review ranking (`judgeBatch`), and automatic `b-iterate` repair loops are unsupported and rejected before any stage runs.

## Shared Four-Milestone Progress & Private Checkpoints

- **Stages & phases**: every stage (`b-build`, `b-review`, `b-save`, `b-commit`) and enclosing phase advances through the same four milestones:
  1. `starting`
  2. `working`
  3. `finished`
  4. `verified`
- **Status & log formatting**: OMP status displays `Phase <N> · starting|working|finished|verified` while logs emit `Phase <N> · b-<stage> starting|working|finished|verified` (with `· blocked` and `reason`, `nextSafeAction`, and optional `attemptId` when halted).
- **Private binding & writer lock**: one versioned `FileStorageStore` checkpoint (`b-loop/checkpoint.json` via `skills/b-loop/scripts/checkpoint-cli.ts`) binds strictly to `(subject, branch, worktree)` with CAS + SHA-256 readback checks and a PID/liveness-checked writer lock (`state: "yielded"` if another writer owns the lock).

## Per-Stage Execution & Safety Boundaries

- **Restricted tool allowlists (`STAGE_TOOLS`)**:
  - `build`: `read`, `edit`, `write`, `grep`, `find`, `ls`, `bash`, `workflow_state`
  - `review`: `read`, `grep`, `find`, `ls`, `workflow_state` (read-only code inspection; no `edit`, `write`, or `bash`)
  - `save`: `read`, `edit`, `write`, `grep`, `find`, `ls`, `workflow_state` (no `bash`)
  - `commit`: `read`, `grep`, `find`, `ls` (drafts Conventional Commits message only; coordinator validates index/tree and executes Git commands)
- **`build` & native `judge()`**: preserves partial worktree edits across crashes and evaluates acceptance criteria with keyed OMP `judge(state, questions)` (`bool >= 0.7`, reading `result.answers`).
- **`review` freshness**: binds to `BuildStageProof.worktreeFingerprint` (tracking tracked files, untracked non-ignored files, symlinks, file permissions, staged diffs, and deletions while ignoring `.context/workflow/` and review/iterate reports). Clean reviews are reused across matching restarts; actionable findings write `review-*.md`/`iterate-*.md` and block `save` at `b-review finished · blocked`.
- **`save` journal & receipt binding**: writes `no-fact` `"attempted"` receipt + private `run-state` journal before dispatching `b-save` (falling back cleanly to `skills/_shared/scripts/workflow-state-cli.ts` when `workflow_state` uses `write` role), verifies saved revision readback, seals `"rows"` `"complete"` with `metadataDuties`, requires strict post-seal `read-receipt` confirmation, and blocks `save` if the worktree drifted since clean review.
- **Scoped `commit`, `close-verified`, and `done`**: refuses pre-existing staged changes (including `.context/workflow/`) and unrelated dirty/untracked paths outside `.context/<subject>/`, `.context/memory/`, `.context/backlog/`, and declared phase `files:` (exact paths or trailing-slash directory prefixes); pins phase/overview SHAs to the checkpoint prior to `workflow_state` writes; folds `subject-lifecycle.ts close-verified` into the final commit; pins `(baselineHead, expectedTree)` before committing; adopts single-parent commits matching that pin after crashes; and derives `done` strictly from reachable verified phase commits plus canonical closeout (`state === "completed"`, `canonical === true`, `verifiedClosed === true`, zero blockers).

## Recovery

To continue after an interruption or blocker, inspect the logged `reason`, `nextSafeAction`, and `attemptId` (see [Recover a blocked `/b-loop` run](howto/recover-buck-loop.md)), resolve the reported cause, and re-run the same `/b-loop <subject>` command in that branch and worktree.
