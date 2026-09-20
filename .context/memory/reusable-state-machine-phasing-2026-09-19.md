---
date: 2026-09-19
domains: [architecture, workflow, extensions]
topics: [state-machine, phasing, buck-loop, backlog]
related:
  - .context/2026-09-19.reusable-state-machine/plan-reusable-state-machine.md
  - .context/2026-09-19.reusable-state-machine/plan-reusable-state-machine-phases.md
  - .context/backlog/items/reusable-state-machine-core.md
priority: medium
status: completed
subject: 2026-09-19.reusable-state-machine
artifacts:
  - plan-reusable-state-machine-phases.md
  - phase-1-generic-evaluator-contract.md
  - phase-2-buck-machine-migration.md
  - phase-3-architecture-documentation-and-proof.md
---

# Reusable state-machine phasing

Split the reusable pure state-machine evaluator plan into three sequential, independently verifiable phases:

1. **Generic Evaluator Contract** — medium, `/b-build`; creates and proves the synchronous domain-neutral core without changing Buck callers.
2. **Buck Machine Migration** — hard, `/b-build-hard`; expresses Buck policy over the core, migrates every caller, preserves supervisor ownership, and deletes the legacy table.
3. **Architecture Documentation and Proof** — medium, `/b-build`; updates ADR/docs and runs focused tests, the full Buck suite, LSP/repository checks, a non-Buck smoke, and durable guardrails.

The dependency chain is strictly HARD: Phase 1 → Phase 2 → Phase 3. There are no safe parallel opportunities because the Buck adapter compiles against the landed core and final documentation/proof depends on the completed migration. `omp_execution` remains `none` for all phases.

Created per-phase backlog items. Only Phase 1 is in the active queue; Phases 2 and 3 are under Upcoming Phases. The umbrella backlog item now points to the phases overview.

Lifecycle handling: `initialize` correctly refused because the existing subject was already active under legacy metadata. The legal `activate` intent then canonicalized the active subject at lifecycle revision 1; no direct lifecycle edit or fallback mutation was used.

Verification: a targeted structural check passed for all required frontmatter, three summary rows, acceptance criteria, inherited user goals, dependency edges, backlog placement, and index links. Marksman diagnostics are clean for the phases overview and subject index. Lifecycle inspection reports canonical `active` with the three incomplete phases as expected blockers. This session touched only `.context/**` Markdown, so the deterministic code guardrails gate was skipped.

Next: start `.context/2026-09-19.reusable-state-machine/phase-1-generic-evaluator-contract.md` with `/b-build`.
