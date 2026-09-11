---
title: Adopt mattpocock/skills capability gaps (b-diagnose, review fan-out, 5 new skills)
status: completed
priority: medium
created: 2026-09-10
updated: 2026-09-10
completed: 2026-09-10
related:
  - .context/2026-09-10.mattpocock-adoption/plan-mattpocock-findings-remediation.md
  - .context/2026-09-10.mattpocock-adoption/plan-mattpocock-findings-remediation-phases.md
  - .context/2026-09-10.mattpocock-adoption/phase-2-design-vocabulary-and-diagnose.md
  - .context/2026-09-10.mattpocock-adoption/phase-3-loop-composition-patches.md
  - .context/2026-09-10.mattpocock-adoption/phase-4-independent-new-members.md
  - .context/2026-09-10.mattpocock-adoption/phase-5-tracker-init-and-triage.md
  - .context/2026-09-10.mattpocock-skills-overlap/research-mattpocock-skills-overlap.md
  - presentations/2026-09-10.mattpocock-skills-overlap/index.html
---

# Adopt mattpocock/skills capability gaps

Tiers 1–3 of `plan-mattpocock-findings-remediation.md`, blocked on Tier 0 shipping first
(`mattpocock-audit-defects.md` = Phase 1). ~19 h. **Phased 2026-09-10** — see
`plan-mattpocock-findings-remediation-phases.md` for the dependency matrix and parallel
opportunities.

| Tier | Phase | Deliverables |
|---|---|---|
| 1 | [Phase 2](../../2026-09-10.mattpocock-adoption/phase-2-design-vocabulary-and-diagnose.md) — hard | `codebase-design` reference → `b-diagnose` (the repo has **no** debugging skill; the bootstrap routes to a role with no skill behind it) |
| 2 | [Phase 3](../../2026-09-10.mattpocock-adoption/phase-3-loop-composition-patches.md) — medium | `b-review` parallel standards axis + no-reranking; `b-build` seams gate + tautological-test anti-pattern |
| 3 | [Phase 4](../../2026-09-10.mattpocock-adoption/phase-4-independent-new-members.md) — medium, `orchestrate` | `b-handoff`, `writing-for-agents`, `b-wizard` — independent, parallelizable |
| 3 | [Phase 5](../../2026-09-10.mattpocock-adoption/phase-5-tracker-init-and-triage.md) — hard | `b-init-tracker` → `b-triage` — sequential, HARD on Phase 1's D2 config shape |

Tier 4 is no longer "not yet itemized" — Phase 1 files one backlog item per deferred deliverable:
`b-phase` ready frontier + expand–contract, `b-prototype`, `b-grill` round-frontier mode,
`b-auto-fix` frontier concurrency, `code-smells` depth axis, `b-which` catalog-generated router,
`b-retro`, `wayfinder` (gated on `b-triage`).

Main risk: 7 new skills × 6 delivery surfaces ≈ 42 catalog touchpoints across two long markdown
tables with a documented clobber history. Promote `b-which` if Tier 3 lands.
