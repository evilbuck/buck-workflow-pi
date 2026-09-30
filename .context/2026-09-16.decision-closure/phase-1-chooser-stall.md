---
status: completed
completed_at: 2026-09-30
phase: 1
order: 1
plan: plan-decision-closure-protocol.md
phases_overview: plan-decision-closure-protocol-phases.md
source_plan: ../2026-09-19.chooser-block-determinism/plan-chooser-block-determinism.md
difficulty: hard
model_hint: strongest reasoning model available — verify a failure-sensitive runtime incident against evolved code before proposing repairs
buck_hint: /b-build-hard
goal: "Verify and close the recorded chooser/review stall, repairing only proven gaps before broader decision-closure work starts."
files:
  - extensions/buck-loop/scan.ts
  - extensions/buck-loop/choice.ts
  - extensions/buck-loop/loop.ts
  - extensions/buck-loop/__tests__/fixtures.ts
  - extensions/buck-loop/__tests__/scan.test.ts
  - extensions/buck-loop/__tests__/choice.test.ts
  - extensions/buck-loop/__tests__/loop.test.ts
from_plan_steps: [1]
depends_on: []
dependency_type: NONE
acceptance_criteria:
  - "[x] Realistic H2 and canonical H3 review impact sections produce identical parseable review facts; H4 and section-boundary handling preserve the original contract."
  - "[x] Review fallback and postcondition-ambiguous choices receive bounded state, plan/phase paths, ambiguity reason and relevant facts; correction retries preserve context and transition audits record it."
  - "[x] Public handleLoop incident reproduction proves a clean H2-heading review reaches save rather than block when no iteration or documentation work is required."
  - "[x] The original incident scan or disposable in-repo fixture equivalent reports parseable=true."
  - "[x] Genuinely unparseable reports retain safe fallback; illegal choices are rejected and legal sets/block semantics remain unchanged."
  - "[x] Existing native Jev judgment and deterministic safety stops are preserved; no historical smol path is restored."
  - "[x] Fresh exercised evidence is recorded for every source-plan criterion; any actual runtime/test repair passes the required deterministic check contract."
---

# Phase 1: Chooser Stall Verification and Repair

## Context

Combined parent goal: make Buck-loop decisions reliable, then expose material decisions, assumptions and rollback posture without slowing routine work.

Source incident and original acceptance criteria: [chooser-block-determinism plan](../2026-09-19.chooser-block-determinism/plan-chooser-block-determinism.md). This phase is the user-requested bugs-first gate. Phase 2 cannot begin until this phase is verified and closed. The dependency is priority policy, not a shared-code build dependency.

The current checkout already contains level-tolerant impact parsing, decision context injection/audit and native Jev selection. These are source observations, not completion evidence. Verify before editing; reuse shipped fixes. The separate typed-review/fix-or-continue plan remains outside this combined scope.

## Implementation Details

1. Read the source plan, current scanner, chooser, public-loop routing and existing incident fixtures. Separate historical implementation instructions from current behavior. Map each original acceptance criterion to an exercised scenario.
2. Run the real scanner against disposable equivalent reports at H2, H3 and H4, including nested section boundaries. Prove equivalent facts and parseable=true. Use the original incident checkout only if it exists and can be inspected without mutating unrelated work.
3. Exercise the public loop on the clean H2 review with no iteration work: it reaches save, not block. A genuinely unparseable report still enters the safe chooser path rather than being treated as a clean review.
4. Exercise both review-fallback and postcondition-ambiguous judgment paths. Verify bounded state, separate plan/phase identity when both exist, ambiguity reason, relevant facts, correction retry preservation and persisted audit evidence. Exercise illegal-choice rejection and unchanged safety stops. Use deterministic injected decisions for routing/contract checks, then exercise the real runtime judgment path when available; report unavailable provider prerequisites explicitly rather than claiming live judgment proof.
5. If a consumer-visible criterion fails, reproduce that gap before making the smallest incident-scoped repair. Keep a deterministic behavioral regression using existing suite conventions. Reuse already-covering tests; do not add source-text, prompt-copy or forwarding-only tests.
6. Run the existing focused scan/choice/loop suites using the repository's actual runner. If runtime or test code changes, run the authoritative guardrails contract. Record smoke output, gap repairs if any, safety evidence and all source-plan acceptance mappings in the phase review/save artifacts.
7. Close this phase only after all criteria are exercised. Record chooser-plan closeout evidence through the existing lifecycle protocol when its separate source subject can be verified closed; this does not close the combined subject. Begin the shared protocol only afterward.

Iteration checkpoint (2026-09-29): review found the production ambiguity lift lacked bounded context and an audit. The classifier now receives the decision snapshot plus bounded diagnosis, persists every judgment before acting, and blocks if auditing fails. Focused tests and guardrails pass; Phase 1 awaits fresh `/b-review` and `/b-save` before verified closure.

## Risks

- Reimplementing shipped fixes: source verification precedes changes; no rewrite merely to match historical file/line references.
- Weak context despite existing plumbing: exercise both decision contexts and audit contents, not only the presence of a context parameter.
- Scope creep into typed-output redesign: keep the larger typed-review and recovery roadmap separate.
- Native provider unavailable: retain deterministic boundary evidence and explicitly record the missing live prerequisite; do not substitute prompted chat judgment or mark that criterion passed.

## Verification

Prove all five source-plan acceptance outcomes plus genuinely unparseable fallback and native-judgment safety preservation. Tests support evidence; a disposable real scanner/public-loop smoke proves the changed or already-shipped path. No passing-by-reading. Record exact commands/results with any remaining blockers.

## Per-Phase Execution Loop

1. Run `/b-build-hard` for this phase only, verification-first.
2. Run `/b-review` against this phase and the source incident criteria.
3. Resolve in-plan defects via `/b-iterate` and re-review; route new scope to a separate plan. Update living docs/changelog only for actual behavioral repairs.
4. Run `/b-save` to record evidence and phase state.
5. Run `/b-commit` for the verified phase checkpoint before closure feature work.
6. If incomplete, retain the resumable phase state and exact missing evidence; do not advance to Phase 2.
