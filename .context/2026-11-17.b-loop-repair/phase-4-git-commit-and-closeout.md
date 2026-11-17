---
status: completed
phase: 4
order: 4
plan: plan-b-loop-repair.md
phases_overview: plan-b-loop-repair-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Enforce fail-closed Git probing, scoped staging with baseline/tree pinning, crash-safe commit adoption, final-phase close-verified integration, and verified done derivation."
omp_execution: none
files:
  - skills/b-loop/scripts/git-commit.ts
  - skills/b-loop/scripts/eval-buck-loop.ts
  - skills/b-loop/scripts/eval-buck-loop.test.ts
from_plan_steps: [4]
depends_on: [2, 3]
dependency_type: HARD
acceptance_criteria:
  - "[x] `sh` command runner fails closed on non-zero exit / `ShellError` (never swallows thrown command errors as exit 0) and failed Git probes halt advancement."
  - "[x] Fresh commit prep refuses unrelated dirty working tree changes outside verified metadata + declared phase `files:`, and refuses pre-existing staged index changes before staging."
  - "[x] Staging includes only verified Buck metadata for the subject/backlog/memory and declared phase `files:`; baseline `HEAD` before staging and `git write-tree` before commit are persisted in the checkpoint prior to executing `commit`."
  - "[x] On the final phase (after verifying earlier phase commits and final save), commit preparation runs `subject-lifecycle.ts close-verified` (resolved via `import.meta.url`), verifies clean closeout, and includes resulting index changes in the pinned staged tree."
  - "[x] Post-commit verification confirms `HEAD^ === baselineHead` and `HEAD^{tree} === expectedTree`, persists commit proof ID in checkpoint, and marks stage + phase `verified`."
  - "[x] Commit recovery handles interruptions: continues matching staged baseline+tree when `HEAD === baselineHead`; adopts single commit matching `(baselineHead, expectedTree)` if already landed; blocks on unexpected `HEAD`, index, or tree; re-running `/b-loop <subject>` after verified completion makes zero new commits."
  - "[x] `done` is derived strictly from verified Git commits for every phase AND verified subject closeout (`subject-lifecycle.ts inspect` / closeout proof)."
completed_at: 2026-11-17
completed_by: claude-opus-4-6
---

# Phase 4: Scoped Git Staging, Tree-Pinning Commit & Closeout

## Context

Parent plan User Goal: When a phase fails or gets interrupted, Buck operators and their agents can see what finished and continue by running the same `/b-loop <subject>` command.

Audit `1f02867` found `eval-buck-loop.ts` swallowed `sh` failures (treating undefined exit as 0) and returned `done` even when Git commits or subject closeout disagreed. This phase fixes Git probe error handling, adds fail-closed index/worktree hygiene checks, pins baseline `HEAD` and `git write-tree` before committing, folds `subject-lifecycle.ts close-verified` into the final phase commit, makes commit crash recovery idempotent without adopting wrong trees, and derives `done` strictly from Git + lifecycle proof.

## Implementation Details

1. **Fix `sh` / probe error handling**:
   - Inspect exact OMP `ShellError` (`error.exitCode`, `error.output`, non-zero exit throws) so every shell/Git failure returns/throws an explicit error with exit code and output. Never treat a thrown error as exit 0.
2. **Pre-commit cleanliness & scoped staging**:
   - On a fresh commit attempt (not recovering an interrupted commit checkpoint), inspect `git status --porcelain` and `git diff --cached --name-only`:
     - Block if any pre-existing staged changes exist in the index.
     - Block if any dirty/untracked files exist outside the allowed verified metadata (subject `.context/<subject>/`, active memory/backlog updates from `save`) and the phase's declared `files:`.
   - Record current `baselineHead` (`git rev-parse HEAD`) before modifying the index.
   - Stage only allowed verified metadata paths + declared phase `files:`.
   - Compute `expectedTree` via `git write-tree` and persist `(baselineHead, expectedTree)` in checkpoint BEFORE invoking commit execution (`starting`/`working`).
3. **Final-phase closeout folding**:
   - Before staging/pinning the final phase commit:
     - Verify every earlier phase has a valid recorded commit proof reachable in history (matching phase order).
     - Verify the final `save` stage is `verified`.
     - Run `bun <resolved-via-import.meta.url>/../../_shared/scripts/subject-lifecycle.ts close-verified --subject <subjectDir> --json`. Block on non-zero exit or failure JSON.
     - Include updated subject `index.md` / lifecycle revision files in the staged tree before pinning `git write-tree`.
   - When recovering after an interruption occurring AFTER `close-verified` updated `index.md` to `completed`, enter through the saved commit checkpoint (not checkbox scanning!) so closeout changes still land cleanly in the final commit.
4. **Post-commit proof & crash recovery**:
   - After commit executes, verify `git rev-parse HEAD` !== `baselineHead`, `git rev-parse HEAD^` === `baselineHead`, and `git rev-parse HEAD^{tree}` === `expectedTree`. Persist resulting commit SHA and mark `commit` + phase `verified`.
   - On re-entry during `commit` stage (`starting`/`working`/`finished`):
     - If `HEAD === baselineHead` and current `git write-tree` equals `expectedTree` (or working files match staging scope cleanly to produce `expectedTree`), resume/complete commit cleanly.
     - If `HEAD !== baselineHead` and `HEAD^ === baselineHead` and `HEAD^{tree} === expectedTree`, adopt `HEAD` as the verified commit proof without creating a duplicate commit.
     - Otherwise (moved `HEAD` to different branch/parent, modified tree, unexpected index diff), block immediately preserving state with failing comparison details.
5. **Derived `done` invariant**:
   - Compute final loop completion (`done`) strictly from:
     1. Every phase in pinned order has a verified commit ID reachable in current branch history with verified tree/parent proof.
     2. Verified subject closeout (`subject-lifecycle.ts` confirms `completed` / `verifiedClosed: true`).
   - Invoking `/b-loop <subject>` on an already-`done` subject verifies those proofs and returns `done` without making any commit or side effect.

## Risks

- **Race / manual index edit during interrupted commit**: Adopting a modified commit or committing wrong index contents causes silent history corruption.
  - *Mitigation*: Compare both `HEAD^ === baselineHead` AND `HEAD^{tree} === expectedTree` strictly; any mismatch stops with exact expected vs observed SHAs.

## Verification

- Tests using real temporary Git repos verifying: failed Git command stops loop (`sh` throw propagation); unrelated dirty file rejection; pre-existing staged file rejection; baseline + `write-tree` pinning; interruption after `git commit` before checkpoint writeback adopts the matching commit cleanly; mismatched parent/tree/branch blocks adoption; final phase executes `close-verified`, includes it in final commit tree, and re-run makes zero new commits.
- `npm run guardrails:check` and `npm run subject-lifecycle:check`.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
