---
status: pending
phase: 2
order: 2
plan: plan-b-pr-manager.md
phases_overview: plan-b-pr-manager-phases.md
difficulty: hard
model_hint: strongest available model; blast radius is existing /b-pr-improved behavior
buck_hint: /b-build-hard
goal: "Extract shared PR git primitives from /b-pr-improved and migrate every caller without changing that command's external behavior."
files:
  - extensions/pr-git.ts
  - extensions/b-pr-improved/index.ts
  - skills/b-pr/scripts/pr-preflight.ts
  - extensions/b-pr-improved/__tests__/wire.test.ts
from_plan_steps: [2]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[ ] `extensions/pr-git.ts` owns base-cache access, rebase detect/continue, conflict enumeration, safe push selection, and remote OID verification"
  - "[ ] `.git/b-pr-base` cache contract is unchanged"
  - "[ ] `/b-pr-improved` calls only the shared primitives; duplicated git helpers are deleted, not aliased"
  - "[ ] `pushBranchIfAhead` (or its extracted equivalent) still refuses overwrite unless rebase rewrote published commits, and never emits `--force`"
  - "[ ] `pr-preflight.ts` exposes machine-readable cache/base/rebase results, treats an active rebase as resumable, and keeps its existing CLI contract"
  - "[ ] Existing b-pr-improved wire tests pass without weakening assertions"
  - "[ ] Temporary-git coverage exists for cache hit/miss/mismatch, dirty start, clean rebase, conflict enumeration, active-rebase resume, normal push, lease-protected push, lease rejection, and remote OID match"
  - "[ ] No git mutation occurs before a missing-base selection"
completed_at: null
completed_by: null
---

# Phase 2: Extract shared PR git primitives

## Context

Parent user goal: a developer can run one OMP command on an open pull request and have valid review feedback fixed, verified, rebased, pushed, and merged without babysitting.

This phase fails fast on the highest blast-radius shared code: git safety currently embedded in `/b-pr-improved`. It does not implement `/b-pr-manager`. It can run in parallel with Phase 1 (no shared files).

## Implementation Details

1. Read `extensions/b-pr-improved/index.ts` and `skills/b-pr/scripts/pr-preflight.ts`. Extract, do not rewrite policy.
2. Create `extensions/pr-git.ts` with the primitives the plan names:
   - Read/write `.git/b-pr-base`; compare cached base to PR `baseRefName`.
   - Base-candidate listing (PR base first, then `main/master/dev/develop`).
   - Rebase start, in-progress detection, `--continue`, never auto-abort/reset.
   - Conflict path enumeration (`diff --diff-filter=U`).
   - Remote OID read; push: fast-forwardable → ordinary `git push`; rewritten published history → `--force-with-lease` only.
   - A grep/static check that `--force` without lease cannot be produced.
3. Migrate every `/b-pr-improved` caller in the same change. `pushBranchIfAhead` currently lives in `index.ts` and is tested in `wire.test.ts` — move it (or its replacement) and update imports.
4. `pr-preflight.ts`: keep CLI output/exit codes; add/confirm machine-readable JSON for cache presence, chosen base, rebase-in-progress, behind count, and conflict list. An active rebase is resumable state, not an error.
5. Preserve dirty-tree `--autostash` rebase behavior already covered by `wire.test.ts`.
6. Do not add `extensions/b-pr-manager/git.ts` here (Phase 6 wraps these primitives for manager ownership/reconcile).
7. Do not change `/b-pr-improved` flags, progress copy, or `gh pr create` flow except via the extraction.

## Risks

- Silent behavior drift in `/b-pr-improved`. Mitigation: same tests, same exit semantics, no new flags.
- `--force` sneaking in through a helper. Mitigation: unit test plus a source assertion that the shared module never passes `--force` alone.
- Auto-abort on unexpected rebase state. Mitigation: block/return typed error; never `rebase --abort` or `reset --hard`.

## Verification

- `vitest` `extensions/b-pr-improved/__tests__/wire.test.ts` (dirty-tree rebase + `pushBranchIfAhead` lease cases).
- New temp-repo tests on `pr-git.ts` for the acceptance list above.
- Confirm `/b-pr-improved` still registers as `b-pr-improved` only.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run `/b-build-hard` for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan issues go to a separate `/b-plan` → `/b-build`; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If incomplete, leave `status: in-progress`.

`omp_execution` is omitted (`none`). No first-turn keyword or `/goal set`.
