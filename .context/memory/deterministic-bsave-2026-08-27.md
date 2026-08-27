---
date: 2026-08-27
domains: [extensions, testing, workflow]
topics: [b-save-improved, deterministic-checkpoint, scribe-auditor, parity, guardrails-override]
subject: 2026-08-26.deterministic-bsave
artifacts:
  - extensions/b-save-improved/index.ts
  - extensions/b-save-improved/__tests__/wire.test.ts
  - skills/b-save-improved/SKILL.md
  - skills/b-save-improved/scripts/save-apply.ts
  - skills/b-save-improved/scripts/save-apply.test.ts
  - skills/b-save-improved/scripts/save-preflight.ts
  - skills/b-save-improved/scripts/save-preflight.test.ts
  - .context/2026-08-26.deterministic-bsave/plan-bsave-improved-parity.md
  - .context/2026-08-26.deterministic-bsave/review-bsave-improved-parity.md
related:
  - .context/memory/bsave-improved-parity-review-2026-08-27.md
  - .context/memory/guardrails-override-complexity-2026-08-27.md
  - .context/2026-08-26.deterministic-bsave/index.md
priority: medium
status: completed
---

# b-save-improved parity hardening: deterministic scribe/auditor checkpoint

## What

Closed parity gaps between the `b-save-improved` skill and its `extensions/b-save-improved` runtime, under subject `.context/2026-08-26.deterministic-bsave`.

## Changes

- `extensions/b-save-improved/index.ts` (+67 lines): wire-level behavior extended to match skill contract.
- `skills/b-save-improved/scripts/save-apply.ts` (+125 lines): apply-step logic expanded; 103 lines of new tests in `save-apply.test.ts`.
- `skills/b-save-improved/scripts/save-preflight.ts`: small preflight adjustment with test sync.
- `extensions/b-save-improved/__tests__/wire.test.ts`: +179 lines of wire coverage.
- `skills/b-save-improved/SKILL.md`: +14 lines documenting the updated contract.

## Artifacts

- Plan: `.context/2026-08-26.deterministic-bsave/plan-bsave-improved-parity.md`
- Review: `.context/2026-08-26.deterministic-bsave/review-bsave-improved-parity.md`
- Review memory: `.context/memory/bsave-improved-parity-review-2026-08-27.md`
- Guardrails override (complexity): `.context/memory/guardrails-override-complexity-2026-08-27.md` — a complexity-gate override was recorded this session rather than silently passing.

## Notes

- Net delta: 10 files, +490/−41.
- Session was code-touching; check contract (guardrails.json) applied. Complexity override documented per the override protocol in the global AGENTS.md quality gate.
- Backlog item `complexity-burn-down` gained an item file (`.context/backlog/items/complexity-burn-down.md`) and a todo.md line; it remains open.
