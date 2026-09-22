---
title: Fix buck-loop context-free choice stalls
status: active
priority: high
created: 2026-09-19
updated: 2026-09-22
completed: null
related:
  - .context/2026-09-19.buck-loop-stall-diagnosis/research-buck-loop-stall.md
  - .context/2026-09-22.buck-loop-block-warning-diagnosis/research-buck-loop-block-warning.md
  - .context/2026-09-21.jev-decision-opportunities/plan-jev-buck-loop-chooser.md
  - .context/2026-09-21.jev-decision-opportunities/plan-jev-buck-loop-chooser-phases.md
  - extensions/buck-loop/choice.ts
  - extensions/buck-loop/scan.ts
  - extensions/buck-loop/loop.ts
---

# Fix buck-loop context-free choice stalls

Two incidents proved that prose-only review routing is insufficient: a clean review can omit a required section, become unparseable, and let an evidence-poor chooser select `block`.

## Acceptance

- `b-review` cannot finish without every human routing section and a schema-valid `buck.review/v1` block.
- Buck-loop derives routes from typed review facts; omitted How-to Impact and `None. Stale ...` are regression fixtures.
- Recoverable model choices are exactly `fix | continue` and receive the full artifact plus validator/verifier diagnostics.
- Every recovery choice is TypeSafe-verified and durably audited before use.
- Public `handleLoop` coverage proves both recorded incidents repair and reach the correct route.
- Protected-branch, corrupt-state, retry, iterate, and loop ceilings remain deterministic hard stops.
