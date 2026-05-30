# Research: b-flow SDK Redesign

**Subject**: b-flow-sdk-redesign  
**Date**: 2026-05-30  
**Status**: active  

## Goal
Redesign b-flow to use Pi SDK for isolated worker contexts instead of spawning `pi -p` subprocesses.

## Artifacts

| File | Type | Description |
|------|------|-------------|
| `research-pi-sdk-worker-architecture.md` | Research | Pi SDK capabilities, current worker analysis |
| `architecture-review-sdk-worker.md` | Architecture Review | Diagrams, code sketches, file changes, migration plan |
| `plan-b-flow-sdk-redesign.md` | Plan | Bounded implementation plan with scope, steps, verification, and phasing recommendation |

## Backlog Item
- [b-flow-sdk-redesign](../../backlog/items/b-flow-sdk-redesign.md) — Redesign b-flow to use Pi SDK for isolated worker contexts

## Current State
Research + architecture review complete. Plan written (see plan-b-flow-sdk-redesign.md). Key decisions: sequential execution for Phase 1, internal dispatch in worker.ts for zero-blast-radius migration, continue writing result files for full compat with XState/verify layer.

## Current State
- Phase 1 (Types & Dual Dispatch, easy): **completed** 2026-05-30 via /b-build standard, then hardened via /b-iterate after review. Dual dispatch lives behind `BFLOW_USE_SDK_WORKER=1` with structured `WORKER_FAILED` stub behavior; tests are green and the closeout is saved.
- Phases 2 (hard) and 3 (medium) pending.

## Next Step
Phase 1 is reviewed and saved. Next up: run `/b-build-hard .context/2026-05-30.b-flow-sdk-redesign/phase-2-sdk-worker-core.md` for the SDK Worker Core implementation, then keep Phase 3 queued for the follow-up test/verification pass.
