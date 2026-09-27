---
status: completed
date: 2026-09-26
updated: 2026-09-26
subject: 2026-09-25.buck-models-doctor
topics: [review, iteration]
informs: []
addresses: plan-buck-models-doctor.md
completed: 2026-09-26
from_review: b-review
---

# Iteration: buck-models doctor

## Source
- Reviewed after: `/b-build`
- Plan: `plan-buck-models-doctor.md`
- Spec: none

## Critical Issues

### 1. Audit both scopes without collapsing equal profile names or inherited stages
- **File**: `extensions/buck-models/doctor.ts:180-245,269-283,335-350`
- **Problem**: `seen[name]` drops the global profile whenever the project has the same name; the project inventory substitutes inherited global stages for configured project stages. A project `shared.build=provider/project` plus global `shared.build=provider/global`, `shared.review=provider/review` produces 2 occurrences instead of 3 and omits `provider/global`. With `global.active=shared`, the only displayed `[project] shared` also lacks `*active*`. This violates all-profile, location, totals, and active-marker criteria.
- **Proposed fix**: Inventory each saved scope/profile/stage independently, retaining overridden global rows and counts; separately annotate effective runtime ownership/fallthrough. Mark the actual active profile visibly even when its active-name source differs from its effective stage owner, and cover same-name overlapping scopes in pure and command tests.

### 2. Match runtime active-name lookup across scopes
- **File**: `extensions/buck-models/doctor.ts:124-147`
- **Problem**: A nonblank global `active=work` and a project-only `work` profile are reported `unknown` because global candidate validation checks only the global config. `resolveBuckStage` accepts the name from either config and runs the project stage (`extensions/omp-models.ts:399-410,439-452,486-507`). Reproduced with a one-stage fixture: doctor `health=unknown`, runtime `ok=true`.
- **Proposed fix**: Use the same cross-scope name lookup as runtime; add parity coverage for global active selecting a project-only name.

### 3. Unhealthy active name must not receive INFO when no profiles exist
- **File**: `extensions/buck-models/doctor.ts:249-255`
- **Problem**: `project.active=ghost` with zero profiles renders `INFO: 0...` and `Active: ghost — UNKNOWN`, despite the plan requiring warning for unhealthy selection. Reproduced from `buildDoctorReport`.
- **Proposed fix**: Evaluate active health before the empty-inventory special case; preserve an empty-scope result for genuinely missing files and test unknown-active/no-profile severity.

### 4. Fail closed and await doctor read/registry failures
- **File**: `extensions/buck-models/index.ts:77-79,249-294,390-395`
- **Problem**: `readDoctorLoad` calls `load` on both paths and then reads existing files again; an unreadable config throws from `readFileSync`, and `getAvailable()` can throw. `dispatchArgs` discards `runDoctor`'s promise with `void`, so these errors are unhandled after the command handler resolves instead of an error notification. This violates unreadable-config/registry-error requirements.
- **Proposed fix**: Read each file once through an invalid-aware loader, catch IO and registry failures, send an error notification without a healthy report, and await doctor execution in the command handler. Add tests for read failure and registry exception.

### 5. Required guardrails gate is failing
- **File**: `extensions/buck-models/model-picker.ts:113-141`
- **Problem**: `npm run guardrails:check` returned `status: fail` with `complexity_gate: fail` (`handleInput` complexity 16, hard ceiling violation). Other gates: unit pass, global ratchet pass, patch pass, functional/lint skipped. This picker was already untracked/dirty before the doctor build (the plan records in-flight edits), so attribution to doctor is not established; the required gate still blocks completion under the plan's verification criterion.
- **Proposed fix**: Coordinate with the owner of the in-flight picker edits to bring `handleInput` under the required complexity ceiling without weakening the contract; rerun the durable check on a coherent tree before closing this plan.

## Warnings

### 1. OMP TUI smoke evidence absent
- **File**: `plan-buck-models-doctor.md:82-83`
- **Problem**: The 29 focused tests pass with an extension-handler harness and unchanged fixture files, but no observed live OMP UI doctor notification or scope-picker interaction was supplied or exercised in this review.
- **Suggested approach**: Run the two planned commands inside a real OMP session against a controlled fixture and record the displayed classifications, active marker, and before/after checksums.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against the same plan.
Inside an OMP execution session, the iterate artifact is not done until it is completed, review passes, and `/b-save` has recorded durable state.
For larger rework, use `/b-build` or `/b-build-hard`.
