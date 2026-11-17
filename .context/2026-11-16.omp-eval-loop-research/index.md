---
status: active
lifecycle_schema: 1
lifecycle_revision: 2
lifecycle_last_transition: activate
---

# 2026-11-16.omp-eval-loop-research

## Plans
- [plan-omp-eval-loop.md](plan-omp-eval-loop.md) — Replace `/buck-loop` extension with OMP TypeScript `eval` runner (`workflowz` + `%load`), `before_subagent_spawn` stage model routing, and OMP 18.x docs
- [plan-omp-eval-loop-phases.md](plan-omp-eval-loop-phases.md) — Phased execution plan (4 phases)

## Phases
- [phase-1-subagent-model-routing.md](phase-1-subagent-model-routing.md) — Phase 1: Subagent model routing for `eval` spawns
- [phase-2-eval-loop-runner.md](phase-2-eval-loop-runner.md) — Phase 2: TypeScript `eval` Buck loop runner & bridge tests
- [phase-3-command-prompt-cutover.md](phase-3-command-prompt-cutover.md) — Phase 3: Command & prompt entrypoints and extension cutover
- [phase-4-docs-and-skill-updates.md](phase-4-docs-and-skill-updates.md) — Phase 4: Documentation & workflow skill updates for OMP 18.x

## Research
- [research-omp-eval-loop.md](research-omp-eval-loop.md) — Canonical research & live validation of OMP `eval` (`"py"` and `"js"`/TypeScript) and `workflowz` mode vs `extensions/buck-loop/`
- [research/notes-omp-eval.md](research/notes-omp-eval.md) — Rolling source notes
- [research/sources-omp-eval.md](research/sources-omp-eval.md) — Source citations

