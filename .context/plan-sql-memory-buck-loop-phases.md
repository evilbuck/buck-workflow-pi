---
status: active
date: 2026-09-28
subject: 2026-09-28.sql-memory-buck-loop
topics: [phasing, sql-memory, buck-loop, jev, memory-cutover]
source_plan: plan-sql-memory-buck-loop.md
phases: 4
format: discrete
---

# Phased Plan: SQL memory in buck-loop

> Derived from [plan-sql-memory-buck-loop.md](plan-sql-memory-buck-loop.md)

## Overview

- **Total phases**: 4
- **Rationale**: plan crosses DB tool, OMP runtime, portable skills, and bootstrap/docs layers with hard sequential dependencies (slices A–D).
- **Estimated total effort**: ~4 focused sessions; Phases 1 and 3 need the strongest reasoning model.
- **Difficulty mix**: 2 hard, 2 medium

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Tool contract and child seam | completed | hard | none | [phase-1-tool-contract-child-seam.md](phase-1-tool-contract-child-seam.md) |
| 2: Recall and bounded judgment | completed | medium | none | [phase-2-recall-bounded-judgment.md](phase-2-recall-bounded-judgment.md) |
| 3: SQL save and truthful completion | completed | hard | none | [phase-3-sql-save-truthful-completion.md](phase-3-sql-save-truthful-completion.md) |
| 4: Policy/docs and live proof | completed | medium | none | [phase-4-policy-docs-live-proof.md](phase-4-policy-docs-live-proof.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | Recall instructions call the `sql_memory` tool admitted by Phase 1; gate/stage policy must exist first |
| Phase 2 → Phase 3 | HARD | Save path reuses the bounded-op/binding surface and stage policy; supervisor postcondition needs the tool seam |
| Phase 3 → Phase 4 | HARD | Docs/bootstrap describe the completed save cutover; live proof requires all three prior slices |

## Dependency Diagram

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
```

**Legend:** `──→` = HARD dependency (blocking)

## Parallel Opportunities

None — fully sequential chain. Phase 4's doc edits are technically independent, but must not describe unshipped behavior, so it stays last.

## Execution Order

1. Complete Phase 1, verify acceptance criteria
2. Update phase file: `status: completed`, check acceptance criteria
3. Update this overview: change status to `completed` in summary table
4. Queue Phase 2, repeat...

## Execution Workflow

Use this overview as the durable navigation map for an OMP execution session. For each phase:
1. Read the first non-completed phase from the Phase Summary table.
2. Read that discrete phase file and execute only its scope using the listed `buck_hint`.
3. Run `/b-review` against the phase file after implementation.
4. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. If review surfaces **out-of-plan issues** (new scope beyond this phase), do not iterate — route them to a separate `/b-plan` → `/b-build` follow-up; they do not block this phase. If `/b-review` flags documentation impact, run `/b-docs` before `/b-save`.
5. Run `/b-save` so memory, draft commits, phase state, and review/iteration artifacts are durable.
6. Run `/b-commit` to checkpoint durable state.
7. If interrupted mid-cycle, leave the phase file `status: in-progress`; the session resumes from that phase and any active `iterate-*.md` artifact.

**Commit invariant**: one phase completion equals one commit. Do not batch multiple completed phases into a single commit; run `/b-save` → `/b-commit` after each phase, before queueing the next.

## Execution Checklist

- [ ] Phase 1: Tool contract and child seam — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 2: Recall and bounded judgment — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 3: SQL save and truthful completion — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 4: Policy/docs and live proof — build → review → iterate if in-plan issues → docs if doc impact → save → commit
