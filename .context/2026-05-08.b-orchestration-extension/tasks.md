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
- [ ] Decide worker transport (`pi --mode rpc` vs print/json subprocess)
- [x] Define worker result file contract (drafted; exact parser pending)
- [ ] Implement MVP XState supervisor machine
- [ ] Implement one-at-a-time external worker loop over phase/task chunks
- [x] Add transition/persistence/worker-result tests
- [ ] Document `/b-flow` in README/docs after implementation

## Phased Implementation

See [plan-b-flow-mvp-phases.md](plan-b-flow-mvp-phases.md) for the full phased plan.

- [ ] **Phase 1: Foundation & Types** (easy) — [phase-1-foundation-types.md](phase-1-foundation-types.md)
- [ ] **Phase 2: State Machine Core** (medium) — [phase-2-state-machine-core.md](phase-2-state-machine-core.md)
- [ ] **Phase 3: Worker Loop & Verification** (hard) — [phase-3-worker-loop.md](phase-3-worker-loop.md)
- [ ] **Phase 4: UI, Commands & Tests** (medium) — [phase-4-ui-commands-tests.md](phase-4-ui-commands-tests.md)

## Notes

Initial recommendation: use `/b-flow` as the primary command and keep `/b-orchestrate` as a possible alias. Use XState v5 for the supervisor engine. MVP should keep the main Pi session as supervisor only and run decomposed chunks through one external worker subagent at a time.
