---
title: Run /b-init-guardrails on this repo to record a durable check contract
status: active
priority: low
created: 2026-08-25
updated: 2026-08-25
completed: null
related:
  - .context/2026-08-25.omp-plan-artifact-extension/plan-omp-plan-artifact-extension.md
  - skills/b-guardrails-check/SKILL.md
---

# Run `/b-init-guardrails` on this repo

The buck-workflow repo currently has no `guardrails.json` at the root, so
`/b-guardrails-check` reports `contract: "none"` against every review and
`/b-review` cannot enforce a deterministic check contract.

The 2026-08-25 `b-review` for `omp-plan-artifact-extension` had to fall
back to running `npx vitest run extensions/plan-artifact.test.ts` and
`npx tsc --noEmit` ad-hoc, plus a baseline-comparison claim about the
full suite ("31 pre-existing failures unchanged before/after"). That
comparison is not durable — only a recorded guardrails contract makes
the verification statement re-runnable.

## Action

Run `/b-init-guardrails` to detect the existing stack (Bun + vitest +
TypeScript + pi-coding-agent extension system) and write a durable
`guardrails.json` with brownfield ratchet values. After this lands,
`/b-guardrails-check` will return `contract: "durable"` and `/b-review`
will use it as the deterministic check contract on subsequent reviews
of buck-workflow itself.

## Why low priority

The repo has no `npm publish` gate pending and tests are run ad-hoc;
existing reviews rely on direct evidence. Promotion to medium if/when
the npm-publish backlog item (`first-npm-publish.md`) becomes active.