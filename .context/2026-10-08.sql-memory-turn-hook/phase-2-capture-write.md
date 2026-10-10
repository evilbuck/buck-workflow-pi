---
status: completed
phase: 2
order: 2
plan: plan-sql-memory-turn-hook.md
phases_overview: plan-sql-memory-turn-hook-phases.md
difficulty: hard
model_hint: Strong reasoning; trust-boundary and cancellation-sensitive SQL write path.
buck_hint: /b-build-hard
goal: Capture at most one durable fact per eligible prompt window through the existing SQL memory writer.
omp_execution: none
files: [extensions/turn-memory/capture.ts, extensions/turn-memory/__tests__/capture.test.ts]
from_plan_steps: [3, 7]
depends_on: [1]
dependency_type: HARD
acceptance_criteria:
  - "[x] A consumed marker is persisted before judgment/extraction/write and replay causes no second attempt."
  - "[x] Only Jev yes >= 0.70 plus a valid one-sentence fact reaches remember; all failure/timeout/secret paths skip safely."
  - "[x] Successful write delegates subject, phase, category, and cwd to the existing remember writer."
completed_at: 2026-10-08
completed_by: null
---

# Phase 2: Capture and Durable Write

## Context

The person running OMP gets durable session facts saved to SQL memory without a manual `/b-save`; capture is on when SQL is configured, with an opt-out. This phase adds the trust boundary over the verified Phase 1 window contract.

## Implementation Details

Inject Jev, bounded extraction, and the `rememberSqlMemory` wrapper. Persist consumption before slow calls. Enforce the 30-second handler budget using narrower per-operation deadlines, with extraction capped at 8 seconds. Skip failures without escaping; do not introduce a chat-model fallback or SQL statements.

## Risks

A timeout after a write begins can be ambiguous; stable window phase/source-key idempotence must delegate dedupe to the existing writer. Never send unredacted text or store multi-paragraph output.

## Verification

Run the capture tests, including thrown Jev/SQL, hung extraction, replay, below-threshold judgment, secret-bearing output, and exactly-once calls.
