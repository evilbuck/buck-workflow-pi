---
status: pending
phase: 2
order: 2
plan: plan-buck-loop-subject-picker.md
phases_overview: plan-buck-loop-subject-picker-phases.md
difficulty: hard
model_hint: strongest reasoning model available
buck_hint: /b-build-hard
goal: "Wire the ranked picker into the /buck-loop command boundary: no-path start parsing, bounded TUI select, single kickoff, fail-closed cleanup, and wire tests."
omp_execution: none
files:
  - extensions/buck-loop/index.ts
  - extensions/buck-loop/__tests__/wire.test.ts
from_plan_steps: [5, 6, 7]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[ ] Start command variant allows an absent path; `parseArgs(\"\")` returns a start-without-path request."
  - "[ ] Command context extended with optional `sessionManager` and `ui.select`."
  - "[ ] No-path start creates the activity widget with `Choosing a subject`, ranks via the Phase 1 module, and invokes `ui.select` with full bounded dialog options (timeout plus AbortSignal); rows show percentage + subject basename + hint and map back to the untouched basename."
  - "[ ] After selection, activity switches to `Starting <subject>`, the JSONL drain is created with the selected path, and `handleLoop({ command: \"start\", path: <basename> })` is called exactly once."
  - "[ ] On rank failure, missing UI, timeout, or cancel: notify, dispose activity, and create no run log/projection and no model/heuristic fallback."
  - "[ ] Explicit path, `--resume`, `--status`, and `--stop` never discover, rank, or display subjects; existing activity-log and safety-confirmation tests still pass."
  - "[ ] `npx vitest run extensions/buck-loop/__tests__/wire.test.ts` passes: bare-command picker flow, selected-path kickoff with exact basename in `handleLoop` and JSONL invocation, cancel/timeout/headless/Jev-failure no-artifact paths, and explicit-command bypass."
  - "[ ] Full regression `npx vitest run extensions/buck-loop/__tests__` passes."
completed_at: null
completed_by: null
---

# Phase 2: Command Boundary and Kickoff

## Context

Parent plan User Goal: "When I run `/buck-loop` without a path, show me about ten likely subject folders ranked by probability; when I select one, start the loop on that subject."

This phase integrates the Phase 1 ranking module into the `/buck-loop` command handler: empty-argument parsing, the bounded modal selection, exactly-one kickoff, and fail-closed cleanup. It consumes `extensions/buck-loop/subject-choice.ts` exports from Phase 1 (HARD dependency). `scan.ts`, `loop.ts`, `machine.ts`, `persist.ts`, and `choice.ts` are untouched.

## Implementation Details

From plan steps 5–6 (test work from step 7):

1. **Argument and UI boundary** — Allow the start variant's path to be absent; `parseArgs("")` returns start-without-path. Extend command context with optional `sessionManager` and `ui.select`. For no-path start: activity widget `Choosing a subject`, rank candidates, then `select` with full bounded dialog options (timeout + AbortSignal — matches the locked interactive-dialog-safety convention; treat timeout/cancel as denial). Rows: percentage + subject name + hint; selection maps back to the raw basename.
2. **Kickoff and cleanup** — After selection: activity → `Starting <subject>`, create the JSONL drain with the selected path, call `handleLoop({ command: "start", path: subject })` exactly once. On rank failure, no UI, timeout, or cancel: notify, dispose activity, no run log/projection, no fallback. Preserve the existing `try`/`catch`/`finally` after kickoff. Never create the start log before selection (would record an empty path).
3. **Tests** — Wire tests with a fake selector and fake conversation tail; assert consumer-visible behavior (ranked rows, exact kickoff basename, absence of artifacts on denial), preserving all existing explicit-path/flag, scan-no-guess, activity-log, and safety-confirmation tests.

## Risks

- Modal UI can hang RPC/headless callers → bounded dialog options, timeout/cancel = denial.
- Double-start risk → `handleLoop` called exactly once, only after selection.
- Conversation signal can be weak → operator remains the final authority.

## Verification

- `npx vitest run extensions/buck-loop/__tests__/wire.test.ts`
- Regression: `npx vitest run extensions/buck-loop/__tests__`
- Deterministic contract: `npm run guardrails:check` at the coherent post-edit checkpoint.
- Live OMP smoke: discuss a known active subject, run bare `/buck-loop`, verify that subject ranks plausibly near the top, select it, observe `Starting <subject>`, then stop/resume and confirm no second ranking dialog.
