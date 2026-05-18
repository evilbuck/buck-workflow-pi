---
status: completed
phase: 4
order: 4
plan: plan-autonomous-b-flow-loop.md
phases_overview: plan-autonomous-b-flow-loop-phases.md
difficulty: hard
model_hint: "Strongest reasoning model available; safety, cancellation, and recovery behavior are failure-sensitive."
buck_hint: /b-build-hard
goal: "Add blocking guardrails, recovery/cancellation behavior, and conservative phase-boundary safety to the autonomous lifecycle."
files: ["extensions/b-flow/guards.ts", "extensions/b-flow/chunk-queue-machine.ts", "extensions/b-flow/machine.ts", "extensions/b-flow/persistence.ts", "extensions/b-flow/scan-context.ts", "extensions/b-flow/__tests__/machine.test.ts", "extensions/b-flow/__tests__/integration.test.ts"]
from_plan_steps: [7, 8, 9, 11]
depends_on: [3]
dependency_type: HARD
acceptance_criteria:
  - "[x] Max iterations defaults to 5 per phase and blocks when exceeded."
  - "[x] Stagnation checks block repeated issue fingerprints, repeated no-change iterate completions, repeated failure/block reasons, and non-advancing active iterate status."
  - "[x] Multiple active iterate artifacts and parser ambiguity block with actionable messages."
  - "[x] Phase-boundary git safety blocks only before starting a new phase when unattributed source changes remain."
  - "[x] STOP aborts parent and kills or records reconciliation state for an active worker when possible."
  - "[x] PAUSE does not start new workers and has documented behavior while a worker is active."
  - "[x] Guardrail, recovery, and cancellation tests cover blocking cases."
completed_at: 2026-05-18
completed_by: b-build
---

# Phase 4: Guardrails, Recovery, and Cancellation

## Context

Once the lifecycle actor exists, autonomous execution needs safety rails. This phase adds conservative blocking behavior for ambiguity, repeated failures, runaway iteration, phase-boundary git safety, and process cancellation/recovery.

## Implementation Details

1. Add pure guard helpers where possible, likely in `extensions/b-flow/guards.ts` or a lifecycle helper module.
2. Implement max-iteration blocking with default 5 iterations per phase.
3. Implement stagnation checks for:
   - same issue fingerprint after 3 iterate passes;
   - two iterate completions with no changed files;
   - same failure/block reason 3 times;
   - active iterate status not advancing after a completed iterate worker.
4. Ensure parser ambiguity and multiple active iterate artifacts block instead of continuing.
5. Add phase-boundary git safety:
   - allow source diffs during build/review/iterate/save;
   - before starting a new phase, block if source changes cannot be attributed to the just-completed phase/save result.
6. Implement STOP behavior that aborts the parent and kills/reconciles the active worker if possible.
7. Implement PAUSE behavior that does not start new workers. The simplest acceptable behavior is "finish current worker, then pause" or block while a worker is active.
8. Add tests for max iterations, stagnation, phase-boundary git safety, STOP with active worker, and orphaned audit without result.

## Risks

- Git safety attribution can be approximate. Prefer conservative blocks with clear resume instructions over false confidence.
- Process killing can leave orphaned `pi` subprocesses if pid tracking is incomplete. Ensure audit metadata is sufficient before relying on kill behavior.
- Guardrails that fire too early can make guided use frustrating. Keep guard messages specific and actionable.

## Verification

Run guardrail/recovery tests first, then the b-flow suite:

```bash
npm test -- extensions/b-flow/__tests__/machine.test.ts
npm test -- extensions/b-flow/__tests__/integration.test.ts
npm test -- extensions/b-flow
```

Manually inspect blocked-state messages in fixtures or snapshots to ensure they explain the reason and next action.
