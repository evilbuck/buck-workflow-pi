---
status: completed
date: 2026-10-16
completed: 2026-10-16
addresses: phase-6-publication-recovery.md
---
# Phase 6 repair

Technical chore — in-plan defect repair for `phase-6-publication-recovery.md`, which carries the `## User Goal` section.

1. Keep adapter checkpoint persistence; expose selected-project checkpoint enumeration and verify immutable Git binding.
2. Persist integration views, proof history, exact checkpoint rewrite mappings and logical-artifact conflict resolutions through adapter immutable revisions with compare-and-swap. Internal run-state scope never participates in publication.
3. Reconcile configured integration refs before ordinary reads; seal current exact branch snapshot before commit and bind only the verified resulting commit. Failed bind retains the seal.
4. Add selection-bound orphan export/rebind including workspace-private scopes, preserving provenance and no automatic promotion.
5. Exercise real Git/store fixtures, restore bundle inventory/parity, run unchanged guardrails, close the iterate artifact and stage only assignment changes.

Use existing immutable-revision/CAS primitives rather than a second SQL transaction framework. Prior supervisor recall is available; current review and phase govern scope. Session pointer refers to an older phase and will not be rewritten. Supervisor retains phase/lifecycle/loop ownership.

## Conflict independence

Code ancestry alone cannot establish knowledge correction ancestry across
branches: a branch can merge another branch's code while retaining an
independent artifact draft. Reconciliation must use the adapters' existing
scoped correction records for cross-branch supersession. Retain tombstone
result IDs in that metadata while preserving the public null deletion result.
Use the existing columns, not a new schema or parallel lineage journal.
Exercise a code-ancestor/independent-draft conflict through native correction
and ordinary retrieval. Same-branch sealed successors may still advance on
their proven checkpoint order.

## Verification

- All four adapters: 125 publication/conformance tests passed.
- Actual configured runtime: code ancestry preserved two independent conflict
  candidates and baseline; explicit resolution selected the requested revision.
- Durable v2 unit/ratchet/complexity gates passed; 89.4% coverage versus 84%.
- Canonical/bundle parity and shipped publication module inspection passed.
- No phase lifecycle, save, commit or supervisor routing decision performed.
