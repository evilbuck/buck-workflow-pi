---
status: active
date: 2026-05-30
subject: 2026-05-30.b-flow-sdk-redesign
topics: [b-flow, sdk-worker, phasing, phases]
source_plan: plan-b-flow-sdk-redesign.md
memory: ["b-flow-sdk-phase1-build-2026-05-30.md"]
phases: 3
format: discrete
---

# Phased Plan: b-flow SDK Worker Redesign

> Derived from [plan-b-flow-sdk-redesign.md](plan-b-flow-sdk-redesign.md)

## Overview

- **Total phases**: 3
- **Rationale**: 8-step plan creating a new core abstraction (SDK session management) across 2 new files + 3 modified. High uncertainty around SDK API behavior and resource lifecycle requires incremental, independently-verifiable phases.
- **Estimated total effort**: 3 sessions (1 per phase)
- **Difficulty mix**: 1 easy, 1 hard, 1 medium

## Phase Summary

| Phase | Status | Difficulty | File |
|-------|--------|------------|------|
| 1: Types & Dual Dispatch | completed | easy | [phase-1-types-dispatch.md](phase-1-types-dispatch.md) |
| 2: SDK Worker Core | completed | hard | [phase-2-sdk-worker-core.md](phase-2-sdk-worker-core.md) |
| 3: Test Coverage & Verification | completed | medium | [phase-3-test-coverage.md](phase-3-test-coverage.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | Phase 2 imports `runSDKWorker` type and uses `WorkerResult` extended fields from Phase 1 |
| Phase 2 → Phase 3 | HARD | Phase 3 tests the implementation created in Phase 2 |

## Dependency Diagram

```
Phase 1 ──→ Phase 2 ──→ Phase 3
```

**Legend:**
- `──→` = HARD dependency (blocking)

**Dependency details:**
- Phase 2 HARD-depends on Phase 1: `sdk-worker.ts` returns `WorkerResult` (extended in Phase 1) and is imported by the dispatch in `worker.ts` (set up in Phase 1)
- Phase 3 HARD-depends on Phase 2: tests target the `runSDKWorker` function implemented in Phase 2

## Parallel Opportunities

> None — all phases are strictly sequential.

## Execution Order

1. Complete Phase 1, verify acceptance criteria (existing tests still pass)
2. Update phase file: `status: completed`, check acceptance criteria
3. Update this overview: change status to `completed` in summary table
4. Queue Phase 2, repeat...

## Ralph Workflow Instructions

Use this overview as Ralph's durable navigation map. For each phase:
1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. Run `/b-review` against the phase file after implementation.
4. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`.
5. Run `/b-save` before `ralph_done` so memory, draft commits, phase state, and review/iteration artifacts are durable.
6. If interrupted mid-cycle, leave the phase file `status: in-progress`; the next Ralph iteration resumes from that phase and any active `iterate-*.md` artifact.

## Ralph Execution Checklist

- [x] Phase 1: Types & Dual Dispatch — completed 2026-05-30 via /b-build (standard)
- [x] Phase 2: SDK Worker Core — completed 2026-05-30 via /b-build (standard)
- [x] Phase 3: Test Coverage & Verification — completed 2026-05-30 via /b-build (standard)

## Notes

- Phase 2 is the highest-risk phase (SDK API unknowns, resource lifecycle). If surprises arise, escalate to `/b-build-hard`.
- The plan's steps 6 (cross-reference hygiene) and 8 (handoff) are trivial and should be done organically during each phase's closeout — not as separate phases.
- Step 7 (typecheck/lint) is folded into Phase 3 since it requires all code to be in place.
- Phase 1 creates a minimal stub for `sdk-worker.ts` so that `worker.ts` can import it without type errors. Phase 2 replaces the stub with the real implementation.

## Phase 1 Completion (2026-05-30)

**Executed via**: /b-build (standard difficulty)

**Changes**:
- `extensions/b-flow/worker.ts`: extended WorkerResult with @alpha SDK telemetry fields; added dual dispatch on BFLOW_USE_SDK_WORKER; renamed impl to internal runSubprocessWorker
- `extensions/b-flow/sdk-worker.ts`: new stub exporting runSDKWorker that throws "not implemented (Phase 2)"

**Verification**:
- All 60 existing b-flow vitest tests pass (flag=0 or unset)
- Direct invocation with flag=1 rejects with expected "runSDKWorker not implemented"
- npx tsc --noEmit: 0 new errors (3 pre-existing elsewhere in project)

**Next**: Phase 2 (hard) — implement real runSDKWorker using createAgentSession. Consider /b-build-hard for that phase.

**Recommendation**: Run `/b-review .context/2026-05-30.b-flow-sdk-redesign/phase-1-types-dispatch.md` then `/b-save` before proceeding to Phase 2.
