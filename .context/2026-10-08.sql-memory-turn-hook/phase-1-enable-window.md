---
status: completed
phase: 1
order: 1
plan: plan-sql-memory-turn-hook.md
phases_overview: plan-sql-memory-turn-hook-phases.md
difficulty: medium
model_hint: Capable general model; moderate cross-file state and secret-redaction reasoning.
buck_hint: /b-build
goal: Establish tested opt-out resolution and replay-safe three-prompt window selection.
omp_execution: none
files: [extensions/turn-memory/enable.ts, extensions/turn-memory/window.ts, extensions/turn-memory/__tests__/enable.test.ts, extensions/turn-memory/__tests__/window.test.ts]
from_plan_steps: [1, 2, 7]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] Enablement precedence matches plan for missing/set URL, environment overrides, settings precedence, and invalid JSON."
  - "[x] Three unticked completed prompts yield one redacted capped window; continuation/replay and tool payloads do not produce capture text."
completed_at: 2026-10-08
completed_by: null
---

# Phase 1: Enablement and Window

## Context

The person running OMP gets durable session facts saved to SQL memory without a manual `/b-save`; capture is on when SQL is configured, with an opt-out. This phase creates the pure gates used by later writing code.

## Implementation Details

Implement enablement with the plan's URL/env/settings precedence and window selection from persisted custom entries. Exclude `willContinue` events and tool results, cap text, redact bearer tokens, obvious key assignments, and `SQL_MEMORY_URL`. Use focused vitest tests through the public functions.

## Risks

Window logic must never expose credential-bearing input to Jev or SQL. Replay must not increment the durable counter twice.

## Verification

Run `npx vitest run extensions/turn-memory/__tests__/enable.test.ts extensions/turn-memory/__tests__/window.test.ts` and directly inspect boundary cases for continuation, replay, redaction, and cap.
