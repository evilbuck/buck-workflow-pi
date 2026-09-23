---
status: active
lifecycle_schema: 1
lifecycle_revision: 2
lifecycle_last_transition: activate
---

# Jev decision opportunities

Research and phased implementation plan for typed Buck Workflow outputs, TypeSafe semantic verification, and fix-or-continue recovery.

## Artifacts

- [research-jev-decision-opportunities.md](research-jev-decision-opportunities.md) — canonical opportunity research
- [research/notes-jev.md](research/notes-jev.md) — TypeSafe and scout notes
- [research/sources-jev.md](research/sources-jev.md) — citations
- [plan-jev-buck-loop-chooser.md](plan-jev-buck-loop-chooser.md) — updated implementation plan
- [plan-jev-buck-loop-chooser-phases.md](plan-jev-buck-loop-chooser-phases.md) — five-phase execution overview
- [phase-1-shared-typed-output-contract.md](phase-1-shared-typed-output-contract.md)
- [phase-2-review-contract-and-routing.md](phase-2-review-contract-and-routing.md)
- [phase-3-fix-or-continue-recovery.md](phase-3-fix-or-continue-recovery.md)
- [phase-4-core-closed-set-migration.md](phase-4-core-closed-set-migration.md)
- [phase-5-documentation-and-live-proof.md](phase-5-documentation-and-live-proof.md)

## Headline

Harden `b-review` with a typed control block, route buck-loop from validated facts, restrict recoverable model decisions to `fix | continue`, and TypeSafe-verify core model-authored closed-set outputs before use.

Deterministic hard safety guards remain blocked; they are not recovery choices.
