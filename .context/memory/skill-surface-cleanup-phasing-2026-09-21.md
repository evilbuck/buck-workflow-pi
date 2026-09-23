---
date: 2026-09-21
domains: [planning, skills, extensions]
topics: [phasing, skill-surface-cleanup, b-save, code-review, grill-me-dialog]
related: []
priority: medium
status: completed
subject: 2026-09-21.skill-command-extension-audit
artifacts:
  - plan-skill-surface-cleanup-phases.md
  - phase-1-dead-unwired-extensions.md
  - phase-2-bsave-and-code-review.md
---

# Skill surface cleanup — phasing

`/skill:b-phase` on `plan-skill-surface-cleanup.md`. Two medium `/b-build` phases; `omp_execution` omitted.

- Phase 1: delete three unwired extension modules, rewrite grill Document Mode off `grill-me_dialog`, shrink complexity inventory, live docs, archive `test-b-grill-auto-extension`, recopy Codex grill skills.
- Phase 2: absorb-then-thin `/b-save`, recopy Codex `b-save`, move `code-review` per-PR files under `.context/`, document `/code-review` dual.

Dependency: NONE (disjoint files). Prefer Phase 1 first so complexity/coverage fail fast. Do not add bundled `b-grill-auto` or `code-review`.
