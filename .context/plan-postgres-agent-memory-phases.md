---
status: active
date: 2026-09-28
subject: 2026-09-28.postgres-agent-memory
topics: [phasing, postgres, agent-memory, sql-tool]
source_plan: plan-postgres-agent-memory.md
phases: 3
format: discrete
---

# Phased Plan: Remote Postgres agent memory

> Derived from [plan-postgres-agent-memory.md](plan-postgres-agent-memory.md) and [grill-session-postgres-agent-memory.md](grill-session-postgres-agent-memory.md) (20/20 resolved, `boundaries_found`).

## Overview

- **Total phases**: 3
- **Rationale**: Grill threshold boundary assessment found three concern boundaries inside v1 — data contract, runtime surface, usage patterns — each independently verifiable.
- **Estimated total effort**: 3 sessions (one per phase)
- **Difficulty mix**: 1 medium, 1 hard, 1 easy

## Phase Summary

| Phase | Status | Difficulty | omp_execution | File |
|-------|--------|------------|---------------|------|
| 1: Schema and Migrations | completed | medium | none | [phase-1-schema-migrations.md](phase-1-schema-migrations.md) |
| 2: Extension and SQL Tool | completed | hard | none | [phase-2-extension-sql-tool.md](phase-2-extension-sql-tool.md) |
| 3: Recall Patterns and Docs | completed | easy | none | [phase-3-recall-patterns-docs.md](phase-3-recall-patterns-docs.md) |

## Dependency Matrix

| From → To | Type | Reason |
|-----------|------|--------|
| Phase 1 → Phase 2 | HARD | The tool's statement gate and migration runner target tables that only exist after migration 001. |
| Phase 2 → Phase 3 | SOFT | Recall patterns and docs can be drafted against the schema, but live verification needs the registered tool. |

## Dependency Diagram

```
Phase 1 ──→ Phase 2 - -→ Phase 3
```

**Legend:**
- `──→` = HARD dependency (blocking)
- `- -→` = SOFT dependency (can stub/mock)

**Dependency details:**
- Phase 2 HARD-depends on Phase 1: `schema_migrations`, `memories`, and the immutability trigger must exist before the runner and DML gate can be tested.
- Phase 3 SOFT-depends on Phase 2: example queries verify live only when `sql_memory` is registered.

## Parallel Opportunities

None. Three-phase HARD→SOFT chain.

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
5. Run `/b-save` to consolidate memory, draft commits, phase state, and review/iteration artifacts.
6. Run `/b-commit` to checkpoint durable state before moving to the next phase.
7. If interrupted mid-cycle, leave the phase file `status: in-progress`; the session resumes from that phase and any active `iterate-*.md` artifact.

**Commit invariant**: one phase completion equals one commit. Do not batch multiple completed phases into a single commit; run `/b-save` → `/b-commit` after each phase, before queueing the next.

## Execution Checklist

- [ ] Phase 1: Schema and Migrations — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 2: Extension and SQL Tool — build → review → iterate if in-plan issues → docs if doc impact → save → commit
- [ ] Phase 3: Recall Patterns and Docs — build → review → iterate if in-plan issues → docs if doc impact → save → commit

## Notes

- External phase 2 (user-declared, outside this plan): move the rest of `.context/` to Postgres after v1 proves out.
- Skills must not open Postgres (locked repo rule). All SQL lives in the extension.
- Use a dedicated schema/database — never Hindsight's tables.
