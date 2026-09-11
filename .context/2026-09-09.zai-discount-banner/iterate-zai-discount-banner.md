---
status: completed
date: 2026-09-09
updated: 2026-09-09
subject: 2026-09-09.zai-discount-banner
topics: [review, iteration, omp-extension, zai]
informs: []
addresses: plan-zai-discount-banner.md
completed: 2026-09-09
from_review: b-review
---

# Iteration: z.ai Discount Banner

## Source

- Reviewed after: `/b-build`
- Plan: `plan-zai-discount-banner.md`
- Spec: none

## Critical Issues

### 1. OMP auth gate requires an unsupported registry method

- **File**: `extensions/zai-discount-banner.ts:104-109`
- **Problem**: OMP 18.1.16 passes its own `ModelRegistry` in the extension context. That runtime exposes `getAvailable()` and `hasConfiguredAuth()` but not `getProviderAuthStatus()`. `zaiAuthenticated()` therefore returns `false`, so `resolveBanner()` returns `null` during an active window even when authenticated `zai/glm-5.3-flash` is available. The tests manufacture the upstream Pi-only method and mask the OMP failure.
- **Proposed fix**: Derive both authentication and model availability from the cross-runtime `getAvailable()` surface, which returns authenticated models. Do not require `getProviderAuthStatus()`. Add a regression case using an OMP-shaped registry with only `getAvailable()`.

### 2. Overnight campaign bounds use the wrong calendar date

- **File**: `extensions/zai-discount-banner.ts:65-74`
- **Problem**: Both halves of the 23:00-09:00 window validate the current SGT date. The early-morning half belongs to the previous day's window start. Current behavior marks 2026-09-03 01:00 active even though that occurrence began on September 2, then marks 2026-09-21 01:00 inactive even though the September 20 23:00 occurrence was active. This contradicts the vendor's "23:00 to 09:00 the following day" rule.
- **Proposed fix**: For wrapping windows, compare the late-night branch's current date and the early-morning branch's previous SGT date against the inclusive campaign start-date range. Add explicit tests for September 3 01:00 inactive and September 21 08:59 active, with September 21 09:00 inactive.

### 3. Standard GLM-5.3 incorrectly satisfies the Flash-only gate

- **File**: `extensions/zai-discount-banner.ts:101-124`
- **Problem**: `/^glm-5\.3/i` accepts `glm-5.3`, and the test at `extensions/zai-discount-banner.test.ts:165` codifies that false positive. The campaign source explicitly says standard GLM-5.3 receives normal quota; only GLM-5.3-Flash receives the campaign benefit. A base-model-only registry can therefore show incorrect quota guidance.
- **Proposed fix**: Match the exact supported Flash campaign model/provider identifiers rather than every `glm-5.3*` model and every `zai*` provider. Change the regression tests so `zai/glm-5.3` is rejected and `zai/glm-5.3-flash` is accepted.

## Warnings

### 1. A throwing managed-timer registration does not install the promised fallback

- **File**: `extensions/zai-discount-banner.ts:172-186`
- **Problem**: The `catch` says it falls through to event-driven refresh, but control does not enter the `else`; no `turn_end` handler is registered. `before_agent_start` still provides partial refresh coverage, but the plan's timer-failure fallback is not implemented.
- **Suggested approach**: Extract an idempotent fallback registration and call it when `setInterval` is absent or throws. Add a test for a throwing `setInterval`.

### 2. The new test helper has strict TypeScript errors

- **File**: `extensions/zai-discount-banner.test.ts:49,251,313`
- **Problem**: The helper types `ctx` as `Record<string, unknown>` and then dereferences `ctx.ui` and `ctx.setInterval`. Language-server diagnostics report three TS18046 errors under the repository's strict `tsconfig.json`.
- **Suggested approach**: Give the mock context a concrete test interface and return typed `setWidget` / `setInterval` spies instead of dereferencing `unknown` fields.

## Resolution

- Replaced the unsupported OMP auth-status call with authenticated `getAvailable()` model detection shared by Pi and OMP.
- Corrected wrapping occurrence bounds: September 3 early morning is excluded; the September 20 occurrence continues through September 21 08:59 SGT.
- Restricted eligibility to exact `glm-5.3-flash` on exact `zai` or `zai-coding-plan` providers.
- Added an idempotent `turn_end` fallback for absent or throwing managed-timer registration.
- Added named mock-context types; language-server diagnostics are clean.

## Verification

- Runtime-shaped smoke: all five auth/model/boundary checks returned `true`.
- Focused suite: `npx vitest run extensions/zai-discount-banner.test.ts` — 30/30 passed.
- Light deterministic unit gate: `npx vitest run` — 28 files, 506/506 passed.
- Lint gate skipped: `guardrails.json` records `lint_cmd: null`.

## Recommended Workflow

Re-run `/b-review` against `plan-zai-discount-banner.md`.
Do not run `/b-save` until review passes and the repository-wide complexity result is resolved or explicitly overridden.
