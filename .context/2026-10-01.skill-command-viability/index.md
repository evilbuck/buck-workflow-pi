---
status: active
lifecycle_schema: 1
lifecycle_revision: 2
lifecycle_last_transition: activate
date: 2026-11-16
subject: 2026-10-01.skill-command-viability
topics: [viability-cleanup, skill-consolidation, b-save, git-commit, b-create-styleguide, b-memory-import, b-capture, b-grill, b-grill-me, b-grill-with-docs, domain-docs, consolidation]
memory: [viability-cleanup-phase-2-fold-duplicates-2026-11-16.md, viability-cleanup-phase-3-unify-b-grill-2026-11-16.md]
---
# Skill and command viability

Jev ranking and the walk-through cleanup plan.

- [research-low-viability.md](research-low-viability.md)
- [plan-viability-cleanup.md](plan-viability-cleanup.md)
- [plan-viability-cleanup-phases.md](plan-viability-cleanup-phases.md)

## What shipped

- **F1 (`design-brief` → `b-create-styleguide`)**: Deleted `skills/design-brief/` and `plugins/buck-workflow/skills/design-brief/`, preserved `skills/_shared/design-brief.jsonc`, updated `skills/b-design-palette/SKILL.md`, and removed `design-brief` from `scripts/codex-plugin.test.ts`.

## Verification

- `npm run guardrails:check` passed (`status: pass`, coverage 88.3% vs 84% baseline, complexity 27 hotspots vs 30 baseline, 0 new violations).

## Related

Memory: `.context/memory/viability-cleanup-phase-2-fold-duplicates-2026-11-16.md`
