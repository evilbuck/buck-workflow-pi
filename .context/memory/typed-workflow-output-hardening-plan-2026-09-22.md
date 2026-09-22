---
date: 2026-09-22
domains: [planning, workflow, extensions, skills]
topics: [b-review, buck-loop, typesafe, typed-output, fix-or-continue]
related:
  - .context/2026-09-21.jev-decision-opportunities/plan-jev-buck-loop-chooser.md
  - .context/2026-09-21.jev-decision-opportunities/plan-jev-buck-loop-chooser-phases.md
  - .context/2026-09-22.buck-loop-block-warning-diagnosis/research-buck-loop-block-warning.md
priority: high
status: completed
subject: 2026-09-21.jev-decision-opportunities
artifacts:
  - plan-jev-buck-loop-chooser.md
  - plan-jev-buck-loop-chooser-phases.md
  - phase-1-shared-typed-output-contract.md
  - phase-2-review-contract-and-routing.md
  - phase-3-fix-or-continue-recovery.md
  - phase-4-core-closed-set-migration.md
  - phase-5-documentation-and-live-proof.md
---

# Typed workflow output hardening plan

## Outcome

Updated the existing Jev/buck-loop chooser plan into a five-phase plan covering the full failure chain: b-review output completeness, typed review routing, `fix | continue` recovery, TypeSafe verification of core closed-set outputs, and live proof.

## Decisions

- Every model-authored binary/enum that routes core work or presents a closed-set recommendation gets deterministic shape validation plus TypeSafe semantic verification.
- `b-review` gains a mandatory `buck.review/v1` JSON control block; code derives routing instead of trusting prose headings.
- Recoverable model choices expose only `fix | continue`; `block` remains only for deterministic hard safety guards.
- TypeSafe provider disagreement/unavailability drives conservative repair first and is never recorded as a successful verification.
- The Jev tool and buck-loop share one evaluator rather than duplicating SDK calls.
- Human confirmations remain authoritative for b-plan execution-mode recommendations and b-triage tracker actions.

## Validation

Evidence was checked against current `b-review`, buck-loop scanner/machine/chooser, Jev tool, b-plan, b-phase, b-grill, and b-triage contracts. Marksman diagnostics passed for the parent plan, overview, and all five phase files. Subject lifecycle reports the five pending phases as the only blockers.

## Important

HEAD was `07a48a8`. Uncommitted Jev Phase 2 and buck-loop implementation work already existed and was left untouched. Phase 1 must start only after that work is committed or reconciled.

Docs-only planning checkpoint; deterministic code guardrails do not apply.