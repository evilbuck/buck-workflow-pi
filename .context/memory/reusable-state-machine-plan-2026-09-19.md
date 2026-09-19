---
date: 2026-09-19
domains: [architecture, extensions]
topics: [buck-loop, state-machine, planning, decoupling]
related:
  - .context/2026-09-19.reusable-state-machine/plan-reusable-state-machine.md
  - .context/backlog/items/reusable-state-machine-core.md
priority: medium
status: completed
subject: 2026-09-19.reusable-state-machine
artifacts:
  - plan-reusable-state-machine.md
  - index.md
---

# Reusable state-machine planning

Validated that `buck-loop/table.ts` is pure and deterministic but its state, fact, choice, effect, retry, priority, and safety vocabulary is Buck-specific. Corrected the earlier claim that a new domain would require only `table.ts` and `types.ts`: `loop.ts`, `persist.ts`, `scan.ts`, and `choice.ts` also depend on the concrete vocabulary.

Planned a narrow reusable seam: a synchronous declarative evaluator with `advance`, `choose`, and `send`. It owns dispatch, target validation, ambiguity detection, legal-choice derivation, and stale-choice rejection. Buck keeps all domain guards/outputs plus scanning, persistence, model calls, clocks, and effect execution. A generic async supervisor was explicitly rejected to avoid recreating XState-like orchestration.

The plan is `.context/2026-09-19.reusable-state-machine/plan-reusable-state-machine.md`; the backlog item is `.context/backlog/items/reusable-state-machine-core.md`. Recommended next step: `/skill:b-phase` because the migration crosses more than five files and a load-bearing state graph.

Concurrent buck-loop, hook, and guardrail work landed as commit `478dc6b` immediately before the planning commit. That commit is the implementation baseline; future work must re-read current source rather than reconstructing the earlier working tree.

Verification: Marksman reports no diagnostics for the new subject, plan, or backlog item. `npm run context:validate` still exits 1 on the pre-existing `.context/memory/mattpocock-adoption-2026-09-10.md` invalid `status: in-progress`; the new artifacts added no validator findings.
