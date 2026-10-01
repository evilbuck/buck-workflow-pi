---
status: active
date: 2026-10-01
subject: 2026-10-01.state-machine-redesign
topics: [phasing, state-machine, buck-loop, code-review-iteration, refactor, cutover]
source_plan: plan-state-machine-module-cutover.md
phases: 4
format: discrete
---

# Phased Plan: Self-contained state machine module and full cutover

> Derived from [plan-state-machine-module-cutover.md](plan-state-machine-module-cutover.md)

## Overview

- **Total phases**: 4
- **Rationale**: 18 steps across two production consumers; each cutover commit must be independently green and revertible (isolate the buck port from the review port).
- **Estimated total effort**: ~4 focused sessions
- **Difficulty mix**: 1 medium (module), 1 hard (buck port), 1 medium (review port), 1 medium (delete/docs)
- **User Goal (inherited by every phase)**: a developer can read a machine's states, edges, guards, effects, and operator-only moves in one place and add a new state without learning three rule kinds; buck-loop runs on it unchanged; the module lifts into another project as-is.

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Module Finalization | completed | medium | none | [phase-1-module-finalization.md](phase-1-module-finalization.md) |
| 2: Port buckMachine | completed | hard | none | [phase-2-port-buck-machine.md](phase-2-port-buck-machine.md) |
| 3: Port reviewMachine | completed | medium | none | [phase-3-port-review-machine.md](phase-3-port-review-machine.md) |
| 4: Delete Old Engine and Update Docs | pending | medium | none | [phase-4-delete-and-document.md](phase-4-delete-and-document.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | buck adapter imports the finalized module; module tests must exist first (also protects the Phase 4 coverage ratchet) |
| Phase 1 → Phase 3 | SOFT | review adapter imports the finalized module; independent suites allow it to start after Phase 1 |
| Phase 2 → Phase 3 | SOFT | sequenced for isolated revertible commits, not a build-order need |
| Phase 2,3 → Phase 4 | HARD | old engine deletable only after both consumers are ported and green |

## Dependency Diagram

```
Phase 1 ──→ Phase 2 ──┐
    │                 ├─→ Phase 4
    └──→ Phase 3 ─────┘
```

**Legend:** `──→` = blocking for the deletion; `- -→` = sequencing preference only.

## Assumption Ownership (Decision Closure 4b)

| Assumption | Validating phase | Validation path |
|---|---|---|
| A-1 (no persisted-format change) | Phase 2 | empty diff on types/loop/choice.ts; persist+loop tests unmodified |
| A-3 (wording derivable from facts) | Phase 2 | ported truth table pins to/effect/why for every former rule |
| A-6 (rule-for-edge mapping) | Phase 3 | truth-table tests pin to + output.rule for all 13 legacy rules |
| A-5 (no unknown consumers) | Phase 4 | re-run consumer search before deletion |

## Parallel Opportunities

- **Phase 2 ∥ Phase 3** in principle (independent consumers, disjoint files) — but run sequentially to keep one revertible cutover commit per consumer, per the plan's risk model.

## Execution hazard (Phases 2–3)

Both phases edit a loop's own supervisor. Run them **outside `/buck-loop`** or restart OMP after each; verify in a fresh process, never via `/reload`.

## Execution Workflow

Use this overview as the durable navigation map for an OMP execution session. For each phase:
1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. Run `/b-review` against the phase file after implementation.
4. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
5. Run `/b-save` so memory, draft commits, phase state, and review/iteration artifacts are durable.
6. Run `/b-commit` to checkpoint durable state.
7. If interrupted mid-cycle, leave the phase file `status: in-progress`; the session resumes from that phase and any active `iterate-*.md` artifact.

**Commit invariant**: one phase completion equals one commit. Do not batch multiple completed phases into a single commit.

## Execution Checklist

- [ ] Phase 1: Module Finalization — build → review → iterate if in-plan issues → docs if doc impact → save → commit
  - Implementation, accepted re-review and verified SQL save completed 2026-10-01; phase status synchronized. Commit checkpoint remains pending in this checkout.
- [ ] Phase 2: Port buckMachine — build-hard → review → iterate if in-plan issues → docs if doc impact → save → commit
  - Implementation and required guardrails completed 2026-10-01; review/save/commit remain pending. See `build-phase-2.md`.
- [ ] Phase 3: Port reviewMachine — build → review → iterate if in-plan issues → docs if doc impact → save → commit
  - Implementation and required guardrails completed 2026-10-01; review/save/commit remain pending. See `build-phase-3.md`.
- [ ] Phase 4: Delete Old Engine and Update Docs — build → review → iterate if in-plan issues → docs if doc impact → save → commit
