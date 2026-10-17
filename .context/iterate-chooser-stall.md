---
status: completed
date: 2026-09-29
updated: 2026-09-29
subject: 2026-09-16.decision-closure
topics: [review, iteration]
informs: []
addresses: phase-1-chooser-stall.md
completed: 2026-09-29
from_review: b-review
---

# Iteration: chooser stall — ambiguous postcondition judgment

## Source
- Reviewed after: `/b-build-hard` and Phase 1 closeout
- Phase: `phase-1-chooser-stall.md`
- Source plan: `../2026-09-19.chooser-block-determinism/plan-chooser-block-determinism.md`

## Critical Issues

### 1. Production ambiguity judgment loses the required context and audit
- **Files**: `extensions/buck-loop/loop.ts:161-164,445-459`; `extensions/buck-loop/ambiguity.ts:61-98`; `extensions/buck-loop/__tests__/loop.test.ts:583-610`
- **Problem**: The postcondition-ambiguous `retry`/`advance` choice bypasses `choose()` and instead invokes `classifyRepair`. Its default implementation passes only `abs`, `sessionText`, and `why` into `diagnoseAmbiguity`; `askRepairLift` receives only the resulting child/disk diagnosis. It never receives explicit state, distinct plan and phase paths, or bounded review/work facts. Unlike the review fallback, this judgment writes no transition audit of the context and lift; a light/medium retry also loses the lift reason in its transition history. The current test substitutes `classifyRepair` and checks its input snapshot, not what the production Jev call sees or persists. This fails Phase 1 acceptance criteria 2, 4 and source-plan criterion 2 despite the checked boxes and saved evidence.
- **Proposed fix**: Carry a bounded structured context (state, separate plan/phase paths, ambiguity reason, relevant work/review facts and diagnosis) through the actual postcondition classifier to Jev, retaining the diagnosed child/disk facts. Persist its accepted/rejected lift and context as an audit before acting, failing closed if persistence fails; keep heavy/operator and one-retry semantics. Add deterministic tests at the real classifier/`handleLoop` boundary that assert Jev's actual input and the persisted decision for light and heavy paths, rather than only the injected callback's snapshot. Run the focused suite, public-loop smoke and durable guardrails again; correct Phase 1 status/evidence before closing.

## Warnings

None.

## Resolution

- The production classifier now prepends bounded state, separate plan/phase paths, review/work facts and ambiguity reason to its existing bounded child/disk diagnosis. Jev receives that full state.
- Every lift judgment writes its context, raw answer, accepted/rejected status, lift and reason before retry or handoff. An unwritable audit blocks without retry; retry history retains the lift reason.
- Regression tests cover light retry, illegal/heavy handoff and audit-write failure at the real `handleLoop`/Jev boundary. Focused suites: 134 passed, 3 skipped. Durable guardrails v2: pass (87.1% coverage vs 84% baseline; patch advisory, lint/functional skipped).
- Phase status returned to `in-progress` pending independent review and save.
- Supplemental `npx tsc --noEmit` fails on existing repository-wide type errors (including old `loop.test.ts` fixture signatures and Bun-based skill scripts); no errors in changed production `ambiguity.ts` or `loop.ts` were observed. This is not a guardrails gate.

## Recommended Workflow

Start with `/b-iterate` on this phase, then re-run `/b-review` against `phase-1-chooser-stall.md`. The phase cannot be treated as verified-closed until the iteration is completed, review passes, and `/b-save` records corrected durable state.
