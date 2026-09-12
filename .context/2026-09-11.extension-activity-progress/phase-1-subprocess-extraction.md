---
status: completed
phase: 1
order: 1
plan: plan-extension-activity-progress.md
phases_overview: plan-extension-activity-progress-phases.md
difficulty: easy
model_hint: capable general model
buck_hint: /b-build
goal: "Move subprocess capture out of `extensions/command-progress.ts` into a new `extensions/subprocess.ts` so the UI lifecycle work can land in isolation."
omp_execution: none
files:
  - extensions/command-progress.ts
  - extensions/command-progress.test.ts
  - extensions/subprocess.ts
  - extensions/subprocess.test.ts
from_plan_steps: [4]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "`extensions/subprocess.ts` exports `execFileCaptured`, `execFileCapturedWithStdin`, `createLineRing`, `KAMAL_TAIL_LINES`, and `recordCommandError` (the non-UI helpers currently in `extensions/command-progress.ts`)."
  - "`extensions/command-progress.ts` keeps its UI types (`ProgressUI`, `ProgressCtx`, `Progress`, `ProgressLevel`, `createProgress`) and imports the subprocess helpers from `subprocess.js`."
  - "All existing tests in `extensions/command-progress.test.ts` keep passing with zero source changes outside of import paths."
  - "A new `extensions/subprocess.test.ts` covers `execFileCaptured`, `execFileCapturedWithStdin`, `createLineRing`, and `recordCommandError` with the same behavioral assertions previously kept in `command-progress.test.ts`."
  - "`npm test` passes; `/b-guardrails-check` reports `status: pass` with no new complexity violations."
completed_at: 2026-09-11
completed_by: goal-mode-session
---

# Phase 1: Subprocess extraction

## Context

The parent plan's User Goal is: animated status plus a small live window of observable model activity, consistently across all extensions. This phase does not change any user-visible behavior; it removes subprocess helpers from the mixed `command-progress.ts` module so the UI module can be designed and migrated without also touching subprocess semantics.

The current `extensions/command-progress.ts` mixes two unrelated responsibilities: child-process capture (`execFileCaptured`, `execFileCapturedWithStdin`, `createLineRing`, `KAMAL_TAIL_LINES`, `recordCommandError`) and UI lifecycle (`ProgressUI`, `ProgressCtx`, `Progress`, `ProgressLevel`, `createProgress`). Separating them keeps the depth of each module high and the seam between UI and subprocess clear. Phase 4 will delete `command-progress.ts` after caller migrations; phase 1 is the precondition that makes that cutover safe.

## Implementation Details

1. Create `extensions/subprocess.ts` with the existing subprocess helpers copied verbatim from `extensions/command-progress.ts` (`execFileCaptured`, `execFileCapturedWithStdin`, `createLineRing`, `KAMAL_TAIL_LINES`, `recordCommandError`).
2. Import the subprocess helpers back into `extensions/command-progress.ts` via relative imports so the rest of the codebase continues to work unchanged.
3. Create `extensions/subprocess.test.ts` with the test cases that currently cover subprocess behavior in `extensions/command-progress.test.ts`; keep `command-progress.test.ts` focused on UI lifecycle.
4. Run `npm test` and `/b-guardrails-check` to confirm the move is observationally a no-op.

## Risks

- Import path drift: any caller that imports a subprocess helper from `command-progress.js` will silently break. Verify there are no such callers — the helpers are only used inside `extensions/b-pr-improved`, `extensions/b-commit-improved`, `extensions/b-save-improved`, and `extensions/b-kamal-release`, and each already imports `createProgress` alongside the subprocess helpers. Phase 1 should not change any caller imports.
- Test bleed: if a test exercises both UI and subprocess behavior, splitting tests requires care to avoid double coverage or lost assertions.

## Verification

- `git diff` on `extensions/command-progress.ts` shows only the import statements for subprocess helpers plus the deletion of their original definitions.
- `git diff` on `extensions/command-progress.test.ts` shows only the removal of subprocess test cases.
- `extensions/subprocess.test.ts` exists with the original assertions moved over.
- `npm test` exits 0.
- `/b-guardrails-check` returns `status: pass`.

## Per-Phase Execution Loop

If executing this phase inside an OMP execution session:
1. Run the indicated Buck build command (`buck_hint`) for this phase only.
2. Run `/b-review` against this phase file.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save` to consolidate memory, draft commits, and phase state.
5. Run `/b-commit` to checkpoint durable state.
6. If the phase is incomplete, leave `status: in-progress` so the session resumes here next turn.
