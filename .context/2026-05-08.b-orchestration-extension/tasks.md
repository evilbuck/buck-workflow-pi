# Tasks: Buck Workflow Orchestration Extension

**Created**: 2026-05-08
**Status**: in-progress

## Tasks

- [x] Refine brainstorm into a structured extension design
- [x] Capture MVP plan in subject folder
- [x] Decide command name (`/b-flow` primary, `/b-orchestrate` possible alias)
- [x] Decide default automation mode (guided/manual-visible by default; autonomous explicit opt-in)
- [x] Research XState applicability
- [x] Draft state-machine spec
- [x] Decide worker transport (`pi` subprocess spawn with prompt file)
- [x] Define worker result file contract (drafted; exact parser pending)
- [x] Implement MVP XState supervisor machine
- [x] Implement one-at-a-time external worker loop over phase/task chunks
- [x] Add transition/persistence/worker-result tests
- [ ] Document `/b-flow` in README/docs after implementation

## Phased Implementation

See [plan-b-flow-mvp-phases.md](plan-b-flow-mvp-phases.md) for the full phased plan.

- [x] **Phase 1: Foundation & Types** (easy) — [phase-1-foundation-types.md](phase-1-foundation-types.md)
- [x] **Phase 2: State Machine Core** (medium) — [phase-2-state-machine-core.md](phase-2-state-machine-core.md)
- [x] **Phase 3: Worker Loop & Verification** (hard) — [phase-3-worker-loop.md](phase-3-worker-loop.md)
- [ ] **Phase 4: UI, Commands & Tests** (medium) — partial: compaction hook, tests done; confirmation UI, footer widget pending

## Notes

Initial recommendation: use `/b-flow` as the primary command and keep `/b-orchestrate` as a possible alias. Use XState v5 for the supervisor engine. MVP should keep the main Pi session as supervisor only and run decomposed chunks through one external worker subagent at a time.
