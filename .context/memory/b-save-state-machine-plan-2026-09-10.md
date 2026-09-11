---
date: 2026-09-10
domains: [workflow, architecture, extensions]
topics: [b-save, b-save-improved, state-machine, deterministic-checkpoint, omp-sdk, command-migration]
related:
  - .context/2026-09-10.b-save-state-machine-analysis/plan-b-save-state-machine.md
  - .context/2026-09-10.b-save-state-machine-analysis/research-b-save-state-machine.md
  - .context/discussions/b-save-state-machine.md
  - .context/backlog/items/b-save-state-machine.md
priority: high
status: completed
subject: 2026-09-10.b-save-state-machine-analysis
artifacts:
  - plan-b-save-state-machine.md
  - research-b-save-state-machine.md
  - index.md
---

# Deterministic b-save state-machine plan

## Outcome

Created an execution-ready plan for replacing `/b-save-improved` with the researched OMP-first deterministic state machine.

## User decision

The final product keeps two commands:

- `/b-save` becomes the new deterministic state-machine checkpoint.
- The current prompt-driven `/b-save` is preserved as `/deprecated-b-save` for compatibility and fallback.

`/b-save-improved` remains available until parity is proven, then is removed during the same atomic command cutover.

## Plan boundaries

- The engine persists resumable, hashed run state and applies `.context/**` changes through a recoverable journal.
- Models return typed, evidence-bound proposals with no mutation authority or ambient capabilities.
- OMP public APIs are the hard boundary; OMP patches, forks, and required upstream changes are prohibited.
- Hindsight delivery is enabled only if a public-SDK experiment proves a trusted pre-execution guarded-retain capability. Otherwise the effect reports `unsupported` without invalidating the durable checkpoint.
- Harness-neutral engine adapters are deferred; non-OMP users retain the renamed prompt workflow.

## Durable state

- Plan: `.context/2026-09-10.b-save-state-machine-analysis/plan-b-save-state-machine.md`
- Backlog: `.context/backlog/items/b-save-state-machine.md`
- Research now links to the plan, and the subject is active.
- The plan exceeds the b-plan phasing threshold and should run through `b-phase` before implementation.

## Verification

- Marksman diagnostics passed for the plan, subject index, research, and backlog item.
- `npm run context:validate` completed with 0 errors and 88 pre-existing warnings.
- `.context/backlog/todo.md` retained one pre-existing Marksman warning for the uncommitted `b-pr-manager` link; the new b-save backlog link produced no warning.
- No code was changed; deterministic code guardrails were not applicable.
