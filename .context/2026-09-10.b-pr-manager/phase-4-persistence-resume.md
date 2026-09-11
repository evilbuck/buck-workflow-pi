---
status: completed
phase: 4
order: 4
plan: plan-b-pr-manager.md
phases_overview: plan-b-pr-manager-phases.md
difficulty: medium
model_hint: capable general model; atomic files, locks, and reconcile-vs-replay are the risk
buck_hint: /b-build
goal: "Persist resumable run state under the worktree gitdir with atomic checkpoints, per-PR locks, and reconcile-on-resume that never replays mutations."
files:
  - extensions/b-pr-manager/persistence.ts
  - extensions/b-pr-manager/__tests__/persistence.test.ts
from_plan_steps: [4]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[x] Paths resolve to `<git-dir>/b-pr-manager/pr-<number>.json`, `.lock`, and optional `config.json` — never the working tree"
  - "[x] Checkpoints write temp → flush/close → rename after every successful transition and immediately before sleep or external mutation"
  - "[x] Per-PR lock is acquired before reconcile; stale locks require PID/session validation, not blind deletion"
  - "[x] Schema version is stored; known versions migrate; unknown versions block"
  - "[x] Resume treats the file as a checkpoint: re-read identities/OIDs, detect active rebase, unknown dirty paths, and stale exact-head attestations"
  - "[x] Resume never replays commit, push, or auto-merge solely because the snapshot said the call was pending"
  - "[x] Cancellation path can mark `paused` and persist without deleting rebase/edits"
  - "[x] Optional `config.json` is schema-validated and limited to timing, merge method, and model selection"
completed_at: 2026-09-10
completed_by: b-build
---

# Phase 4: Atomic persistence and resume

## Context

Parent user goal: a developer can run one OMP command on an open pull request and have valid review feedback fixed, verified, rebased, pushed, and merged without babysitting.

Builds on Phase 1 `RunState`. Full git/GitHub reconcile actors land in Phase 6; this phase must still implement the checkpoint/lock/migrate API and prove resume does not replay side effects, using injected git/GitHub snapshots.

Can run in parallel with Phase 3 after Phase 1.

## Implementation Details

1. Implement `persistence.ts`:
   - Resolve gitdir from the worktree (linked worktrees included). Refuse to write under the project working tree.
   - Atomic `save(runState)` and `load(prNumber)`.
   - `acquireLock` / `releaseLock` with PID + session identity; stale lock = validate then steal or block.
   - `migrate(raw)` for known schema versions.
   - `reconcile(saved, observed)`: compare repo identity, PR number, worktree, local/remote/base OIDs, active rebase, manager-owned dirty paths vs unknown dirt. Invalidate attestations when head/diff digest drifted. Emit the safest legal event (`RESUME_AND_RECONCILE` outcome), never a mutation command.
2. CLI/config precedence is encoded in types here (`flags > saved run > git-local config > defaults`) even if the parser lands in Phase 6.
3. Tests:
   - Atomic replace survives crash-between-temp-and-rename (leave a temp file; load still returns last good state).
   - Lock: second acquirer blocks; dead PID can be stolen; live PID cannot.
   - Migration of a vN-1 fixture.
   - Resume with pending-push snapshot but remote already matching → no second push instruction.
   - Resume with pending-auto-merge snapshot but GitHub already MERGED → `merged`, not another merge call.
   - Unknown dirty path → block; only recorded manager-owned paths are acceptable on resume.
   - Cancel → `paused` snapshot includes exact resume command string.
4. Do not start the XState actor. Do not register the command.

## Risks

- Checkpoint replay duplicates commits/pushes/merges. Reconcile inspects actual OIDs/GitHub state first.
- Writing state into the PR worktree dirties the diff. gitdir only.
- Blind lock deletion races two OMP sessions. PID/session check required.

## Verification

- `vitest` `extensions/b-pr-manager/__tests__/persistence.test.ts`.
- Assert saved files live under a fake gitdir, not the temp worktree root.
- Phase 1 machine tests still pass.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues go to a separate `/b-plan` → `/b-build`; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If incomplete, leave `status: in-progress`.

`omp_execution` is omitted (`none`). No first-turn keyword or `/goal set`.
