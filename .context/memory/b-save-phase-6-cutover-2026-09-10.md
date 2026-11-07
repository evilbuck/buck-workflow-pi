---
date: 2026-09-10
domains: [workflow, extensions, docs]
topics: [b-save, cutover, deprecated-b-save, guardrails, phase-6]
related:
  - extensions/b-save/index.ts
  - skills/deprecated-b-save/SKILL.md
priority: high
status: completed
subject: 2026-09-10.b-save-state-machine-analysis
artifacts:
  - extensions/b-save/index.ts
  - skills/b-save/SKILL.md
  - skills/deprecated-b-save/SKILL.md
---

# Phase 6: parity cutover

`/b-save` is the engine (`extensions/b-save` wired from `extensions/index.ts`). `/deprecated-b-save` is the old prompt. `/b-save-improved` is removed. Guardrails: 443 tests, patch coverage 90% vs origin/master. Live proof is disposable `--run-id` resume plus registration tests, not an interactive OMP TUI session.
