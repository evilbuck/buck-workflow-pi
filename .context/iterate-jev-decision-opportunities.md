---
status: completed
date: 2026-09-22
updated: 2026-09-22
subject: 2026-09-21.jev-decision-opportunities
topics: [review, iteration, typed-output, semantic-verification]
informs: []
addresses: phase-1-shared-typed-output-contract.md
completed: 2026-09-22
from_review: b-review
---

# Iteration: jev-decision-opportunities

## Source
- Reviewed after: `/b-build-hard` (Phase 1 — Shared Typed-Output Contract, commit `7bbb864`)
- Phase: `phase-1-shared-typed-output-contract.md`
- Plan: `plan-jev-buck-loop-chooser.md`

## Critical Issues

### 1. Empty semantic-verification batch reports `verified`
- **File**: `extensions/typed-output/semantic.ts`
- **Problem**: `assessSemanticVerification([], evaluation)` with a successful evaluation returns `{"comparisons":[],"status":"verified"}` (reproduced 2026-09-22 via direct invocation). Every guard is `comparisons.some(...)`, so an empty expectation set vacuously passes and certifies a control output without checking any declared field. This contradicts the plan's fail-closed posture ("never pretends verification passed") and the phase's purpose of establishing trustworthy verification before phases 2–3 route work on `status: "verified"`.
- **Proposed fix**: Reject an empty `expectations` array up front — either return `status: "unavailable"` with a message ("semantic verification requires at least one expectation") or throw `invalid_request`; pick the return-shape option to stay within the `SemanticVerificationResult` contract. Add a fixture + test pinning the empty-batch outcome alongside the existing boundary tests in `__tests__/semantic.test.ts`.

## Warnings

### 1. Evaluator widens SDK request types and hides the mismatch behind an unsafe cast
- **File**: `extensions/typed-output/evaluator.ts:3-9`, `evaluator.ts:131-133`
- **Problem**: `TypeSafeRequest`/`TypeSafeQuestionInput` widen SDK fields to `unknown`, and `defaultCreateClient` casts via `as unknown as TypeSafeClientLike`. Values the SDK rejects (e.g. bigint `state`) type-check, pass local validation, then die in the SDK's serialization and get misreported as `provider_unavailable` instead of `invalid_request`.
- **Suggested approach**: Reuse the SDK's exported request/result types where available, or validate/narrow `state`, `instructions`, and `criteria` (JSON-serializable check) inside `validateRequest` before dispatch. Keep the single-wrapper constraint intact.

### 2. Three validator diagnostic codes have no test pin
- **File**: `extensions/typed-output/__tests__/fixtures.ts:65-98`
- **Problem**: The invalid-control corpus exercises `missing_field`, `not_object`, and `invariant_violation`, but not `invalid_enum` (bad verdict string), `invalid_boolean` (non-boolean field), or `invalid_schema` (wrong schema value). Those branches exist in `contracts.ts:114-151` and would fail silently if regressed.
- **Suggested approach**: Add three rows to `invalidReviewControls` — one per uncovered code.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against `phase-1-shared-typed-output-contract.md`.
For larger rework, use `/b-build` or `/b-build-hard`.

## Resolution

- Empty semantic-expectation batches now return `unavailable` rather than `verified`.
- The evaluator rejects non-JSON-compatible state, instructions, and criteria before dispatching to TypeSafe.
- Review-control fixtures now cover invalid schema, enum, and boolean diagnostics.

## Verification

- Reproduced the four reported failures before the fix, then passed 31 focused tests across typed-output and Jev tool suites.
- `npm run guardrails:check` passed the durable v2 contract.
