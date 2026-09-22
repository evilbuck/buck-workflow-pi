---
status: active
lifecycle_schema: 1
lifecycle_revision: 2
lifecycle_last_transition: activate
---

# Jev decision opportunities

Research + Path B plan. Jev via `@typesafe-ai/sdk` in the buck-loop chooser. OMP `judge()` backend unverified — not in this plan.

## Artifacts

- [research-jev-decision-opportunities.md](research-jev-decision-opportunities.md) — canonical summary
- [research/notes-jev.md](research/notes-jev.md) — TypeSafe + scout notes
- [research/sources-jev.md](research/sources-jev.md) — citations
- [plan-jev-buck-loop-chooser.md](plan-jev-buck-loop-chooser.md) — Path B chooser cutover

## Headline

P0: replace `extensions/buck-loop/choice.ts` (`runOmpModelSession` + JSON parse) with `@typesafe-ai/sdk` Choice plus a confidence gate. Nested workers, machines, and generation stay LLM/code.

Never wrap Jev in `runOmpModelSession`.
