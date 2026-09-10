---
title: Cover serve-presentations.ts lines 289-304 (patch gate at 89%)
status: active
priority: medium
created: 2026-09-10
updated: 2026-09-10
completed: null
related:
  - scripts/serve-presentations.ts
  - scripts/serve-presentations.test.ts
  - guardrails.json
---

# Cover `serve-presentations.ts` uncovered lines (patch gate failure)

The durable guardrails contract's patch gate (`diff-cover` vs
`origin/master`, fail-under 90) fails at **89%**: 10 uncovered lines in
`scripts/serve-presentations.ts` (lines 289-292, 295-296, 299, 301,
303-304), introduced by commit `0d1dbf7` on `feat/matt-pocock-adapt`.

Surfaced during mattpocock-adoption Phase 1 closeout (2026-09-10);
classified out-of-plan for that phase (pre-existing branch state, zero
coverable lines from the phase itself) and routed here per the
b-review issue-routing rules.

## Action

Extend `scripts/serve-presentations.test.ts` to cover the missing
lines (289-304 region) so the patch gate returns to ≥ 90%. Until then
every `/b-guardrails-check` on this branch reports `patch_gate: fail`.
