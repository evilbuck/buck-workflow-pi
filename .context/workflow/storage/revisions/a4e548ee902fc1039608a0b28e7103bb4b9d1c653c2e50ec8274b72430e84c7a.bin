---
status: in-progress
phase: 4
order: 4
plan: plan-extension-activity-progress.md
phases_overview: plan-extension-activity-progress-phases.md
difficulty: medium
model_hint: capable general model
buck_hint: /b-build-hard
goal: "Migrate every currently shipped long-running command to the shared activity handle, delete `extensions/command-progress.ts`, and document the convention."
omp_execution: none
files:
  - extensions/b-pr-improved/index.ts
  - extensions/b-pr-improved/__tests__/wire.test.ts
  - extensions/b-commit-improved/index.ts
  - extensions/b-commit-improved/__tests__/wire.test.ts
  - extensions/b-save-improved/index.ts
  - extensions/b-save-improved/__tests__/handler.test.ts
  - extensions/b-save-improved/__tests__/wire.test.ts
  - extensions/b-kamal-release/index.ts
  - extensions/b-kamal-release/__tests__/wire.test.ts
  - extensions/extension-activity.ts
  - extensions/extension-activity.test.ts
  - extensions/subprocess.ts
  - extensions/subprocess.test.ts
  - extensions/omp-models.ts
  - extensions/omp-models.test.ts
from_plan_steps: [6, 7, 8]
depends_on: [3]
dependency_type: HARD
acceptance_criteria:
  - "`b-pr-improved`, `b-commit-improved`, `b-save-improved`, and `b-kamal-release` each create exactly one activity handle per command invocation and dispose it from the outermost `finally`."
  - "Each command forwards model events through the runner's `onActivity` callback (for `b-pr-improved`, `b-commit-improved`, and `b-save-improved`) and uses semantic phase updates for Kamal's non-LLM steps."
  - "Existing handler/wiring tests assert each command starts activity before its first awaited operation, forwards model events, and clears UI on success and every early/error path."
  - "Kamal success does not render raw deployment output; Kamal failure keeps the bounded failure-tail policy."
  - "No command retains a private progress renderer; `extensions/command-progress.ts` and `extensions/command-progress.test.ts` are deleted after every caller migrates with no compatibility alias or duplicate convention."
  - "`docs/oh-my-pi.md` documents the OMP activity surface and the rule that future long-running extension commands use the shared module."
  - "Backlog item `deterministic-extension-progress` is retargeted to the new subject in `.context/backlog/items/deterministic-extension-progress.md` and `.context/backlog/todo.md` instead of duplicating."
  - "`npm test` passes; `/b-guardrails-check` reports `status: pass` with no new complexity violations."
completed_at: null
completed_by: null
---

# Phase 4: Command migration + docs

## Context

The parent plan's User Goal is: animated status plus a small live window of observable model activity, consistently across all extensions. Phase 4 closes the loop by migrating every currently shipped long-running command, removing the legacy mixed module, and documenting the convention so future commands cannot drift.

## Status note (2026-09-12)

Implementation, migration, `command-progress.ts` deletion, docs, and backlog retargeting are done. Two acceptance gates remain open with no recorded override: patch coverage is 89.9% (gate: 90%) and the OMP TUI smoke has not been run (see `iterate-extension-activity-progress.md` Critical Issue 4). The phase stays `in-progress` until both are recorded or an approved durable override exists.

This phase uses `/b-build-hard` because the work spans four command implementations and touches the deletion of the mixed module; ambiguity may surface during cleanup of duplicated progress paths and Kamal's failure-tail policy. Each command's wiring test must verify the new activity lifecycle explicitly.

## Implementation Details

1. Migrate `b-pr-improved` to one activity handle per invocation; pass the handle's event sink through `runModelSession` for preflight, each conflict-resolution attempt, push, description synthesis, and PR creation. Dispose in the outermost `finally`.
2. Migrate `b-commit-improved` to the same handle for preflight, model drafting, fallback, and commit.
3. Migrate `b-save-improved` to the same handle for preflight, scribe, fallback, auditor, apply, and the retain handoff.
4. Migrate `b-kamal-release` to the same handle for animated phase progress; keep the existing bounded failure-tail policy; do not expose raw deployment output on success.
5. Update each command's wiring tests to assert that activity starts before the first awaited operation, model events are forwarded, and UI is cleared on success and every early/error path.
6. After every caller migrates, delete `extensions/command-progress.ts` and `extensions/command-progress.test.ts`; remove any compatibility re-export.
7. Update `docs/oh-my-pi.md` to document the OMP activity surface and the rule that future long-running extension commands use the shared module.
8. Retarget `.context/backlog/items/deterministic-extension-progress.md` and `.context/backlog/todo.md` to point at the new subject instead of duplicating the active progress item.
9. Run `npm test`, `/b-guardrails-check`, and OMP TUI smoke scenarios from the plan's verification section.

## Risks

- Caller drift: any command that still imports a UI helper from `command-progress.js` will break at cutover; verify no such imports remain before deleting the file.
- Kamal raw output: Kamal's current success path includes stdout/stderr in error branches; the migration must not surface raw success output.
- Documentation drift: future extensions that don't use the shared module will re-introduce the original drift. The new `docs/oh-my-pi.md` rule is the durable guardrail.

## Verification

- `git status` shows no `extensions/command-progress.ts` or `extensions/command-progress.test.ts` after the cutover.
- `git grep "command-progress"` returns nothing outside deleted files.
- Each command's `__tests__/wire.test.ts` (and `handler.test.ts` for `b-save-improved`) asserts activity lifecycle.
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
