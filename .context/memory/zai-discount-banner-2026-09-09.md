---
date: 2026-09-09
updated: 2026-09-10
domains: [extensions, testing, workflow]
topics: [zai-discount-banner, omp, model-registry, campaign-window, b-iterate]
related:
  - .context/2026-09-09.zai-discount-banner/plan-zai-discount-banner.md
  - .context/2026-09-09.zai-discount-banner/iterate-zai-discount-banner.md
priority: medium
status: active
subject: 2026-09-09.zai-discount-banner
artifacts:
  - extensions/zai-discount-banner.ts
  - extensions/zai-discount-banner.test.ts
  - .context/2026-09-09.zai-discount-banner/iterate-zai-discount-banner.md
  - .context/2026-09-09.zai-discount-banner/draft-commit.md
  - .context/2026-09-09.zai-discount-banner/plan-zai-discount-banner.md
  - .context/2026-09-09.zai-discount-banner/research-zai-discount-banner.md
  - .context/2026-09-09.zai-discount-banner/research/sources-zai-discount-windows.md
  - .context/2026-09-09.zai-discount-banner/index.md
  - .context/backlog/items/zai-discount-banner-extension.md
---

# z.ai Discount Banner Review Iteration

## Objective

Resolve the five in-plan defects found by `/b-review` before re-reviewing the z.ai Flash campaign banner.

## Resolved Findings

- Replaced the OMP-incompatible `getProviderAuthStatus()` requirement with `getAvailable()`, the shared Pi/OMP surface whose models already have configured authentication.
- Restricted campaign eligibility to exact `glm-5.3-flash` models on exact `zai` or `zai-coding-plan` providers; standard GLM-5.3 no longer receives Flash campaign messaging.
- Made wrapping 23:00-09:00 occurrences use their start date for campaign bounds. The first early morning remains inactive, while the final September 20 occurrence continues through September 21 08:59 SGT.
- Registered the `turn_end` fallback when managed timers are absent or their registration throws, with duplicate registration prevented.
- Replaced `unknown` test-context dereferences with named Vitest mock contracts; language-server diagnostics are clean for both changed files.

## Verification

- Runtime-shaped smoke: authenticated Flash renders; standard GLM-5.3 clears; September 3 01:00 is inactive; September 21 08:59 is active; September 21 09:00 is inactive — all checks `true`.
- Focused suite: `npx vitest run extensions/zai-discount-banner.test.ts` — 30/30 passed.
- Light deterministic unit gate: `npx vitest run` — 28 files, 506/506 passed.
- Lint gate: skipped because `guardrails.json` records `lint_cmd: null`.
- Full guardrails remain for `/b-review`; the preceding review twice found an unrelated pre-existing complexity-baseline failure, while this banner's maximum CCN was 9.

## Checkpoint

`/b-save` recorded this session on 2026-09-10. The review iteration is complete, but the plan, subject, and backlog item remain active because the required second `/b-review` has not passed and the known repository-wide complexity failure remains unresolved.

## Remaining Workflow

Re-run `/b-review` against `plan-zai-discount-banner.md`. If review passes and the complexity failure is fixed or explicitly overridden, run `/b-commit`.
