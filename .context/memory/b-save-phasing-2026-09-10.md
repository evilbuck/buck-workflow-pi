---
date: 2026-09-10
domains: [workflow, planning, extensions]
topics: [b-save, b-phase, phasing, state-machine, omp-goal-mode]
related:
  - .context/2026-09-10.b-save-state-machine-analysis/plan-b-save-state-machine.md
  - .context/2026-09-10.b-save-state-machine-analysis/plan-b-save-state-machine-phases.md
  - .context/memory/b-save-state-machine-plan-2026-09-10.md
  - .context/backlog/items/b-save-state-machine.md
priority: high
status: completed
subject: 2026-09-10.b-save-state-machine-analysis
artifacts:
  - plan-b-save-state-machine-phases.md
  - phase-1-boundaries-and-contract.md
  - phase-2-run-model-and-snapshot.md
  - phase-3-bounded-semantic-roles.md
  - phase-4-evaluation-and-apply.md
  - phase-5-effects-and-command-ux.md
  - phase-6-parity-cutover-docs.md
---

# b-save state-machine plan phased into six sessions

## Outcome

`/skill:b-phase` split the 11-step deterministic b-save plan into 6 sequential phases, each a self-contained build → review → save → commit session.

## Phase map

1. **Boundaries & contract freeze** (steps 1–2, hard) — SDK Hindsight guarded-retain proof + frozen two-command contract; locks the Phase 5 effects decision.
2. **Run model & deterministic snapshot** (steps 3–4, hard) — types.ts, machine.ts, snapshot.ts; preflight logic ported by invariant.
3. **Bounded semantic roles** (step 5, medium) — extend `runOmpModelSession` in place; scribe/auditor/classifier with zero ambient capability.
4. **Evaluation & journaled apply** (steps 6–7, hard) — twelve responsibility rules + recoverable `.context/**` apply.
5. **Effects & command UX** (steps 8–9, medium) — `ctx.memory` delivery, guarded-or-unsupported Hindsight, command adapter; `extensions/index.ts` registration deferred to Phase 6.
6. **Parity, cutover & docs** (steps 10–11, hard) — parity checklist gates the atomic rename to `/b-save` + `/deprecated-b-save`, removal of `/b-save-improved`, docs sweep, guardrails.

## Decisions

- **HARD chain throughout**; no inter-phase parallelism, so `orchestrate`/`workflow` add nothing. Recommended `omp_execution: goal` stamped on Phase 1 only, `omp_goal_budget: 80000` (16k × 4 hard + 8k × 2 medium).
- `extensions/index.ts` registration deliberately deferred to Phase 6 so the current `/b-save` prompt and `/b-save-improved` keep working until parity — avoids premature command shadowing.
- Plan/subject status were already `active`; no flip needed (skill step 5c no-op).
- Six per-phase backlog items created; only Phase 1 activated in `todo.md`, phases 2–6 in a commented "upcoming" block per b-phase step 6.

## Verification

- `npm run context:validate` after writing: 0 errors (warnings pre-existing/unrelated).
- Marksman diagnostics clean on the subject folder and backlog items.
- Docs-only session (all changes under `.context/`), so the deterministic guardrails gate is skipped by contract.

## State

Uncommitted by design: the working tree also carries sibling sessions' uncommitted edits (b-pr-manager subject, shared `todo.md`/`memory/index.md`); left for the user's next `/b-commit` to sweep as one batch.
