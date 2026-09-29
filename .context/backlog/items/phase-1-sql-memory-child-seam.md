---
title: "Phase 1: Tool contract and child seam"
status: active
priority: high
created: 2026-09-28
updated: 2026-09-29
completed: null
related:
  - .context/2026-09-28.sql-memory-buck-loop/phase-1-tool-contract-child-seam.md
  - .context/2026-09-28.sql-memory-buck-loop/plan-sql-memory-buck-loop.md
  - .context/2026-09-28.sql-memory-buck-loop/research-phase-1-operator-block.md
---

# Phase 1: Tool contract and child seam

Hard, `/b-build-hard`. Admit a scoped `sql_memory` tool into isolated buck-loop children via restricted SDK `customTools`, with stage policy on the shared gate/executor and bounded pool lifetime. Live OMP proof is a hard prerequisite.

Supersedes the earlier generic item [sql-memory-buck-loop-child-seam.md](sql-memory-buck-loop-child-seam.md) as the plan's first executable unit.

Progress (2026-09-29): The deployed OMP child and actual `runStep` stage adapter both returned SELECT proof=7 against disposable PostgreSQL. Role-policy SQL behavior and all six phase criteria were verified. Four review/iterate cycles repaired concrete defects, the fifth review passed, and documentation plus `/b-save` completed. Keep this item active until the commit settles.

Workflow follow-through: blocked-completed-phase resume entered review without rebuilding, holding build count at 3/12. The loop stopped safely at the commit checkpoint because seven source/docs changes remained unstaged; there was no unbounded retry. Phase 2 has not built yet.
