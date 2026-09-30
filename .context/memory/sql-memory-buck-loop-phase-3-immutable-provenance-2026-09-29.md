---
date: 2026-09-29
domains: [extensions, sql-memory, testing]
topics: [buck-loop, sql-save, immutable-correction, phase-provenance]
related: [../2026-09-28.sql-memory-buck-loop/iterate-phase-3-immutable-save-and-phase-context-2026-09-29.md]
priority: high
status: completed
subject: 2026-09-28.sql-memory-buck-loop
artifacts: [iterate-phase-3-immutable-save-and-phase-context-2026-09-29.md]
---

# Phase 3 immutable save and provenance iteration

- Shared SQL recall returned zero active project matches; review artifact and Phase 3 supplied the requirements.
- Save-stage raw SQL policy now denies immutable `memories` updates, permitting only correction assignments (`invalid_at = now()` and `superseded_by = $n`). Portable correction continues through the atomic `correct` tool operation.
- Save attempt records the active phase path (or explicit null). Both alternate save inserts and portable correction contexts retain that provenance without changing source-key retry identity; a new phase rotates the key. Canonical and plugin save instructions match.
- Files modified: `extensions/sql-memory/sql-gate.ts`, `extensions/sql-memory/sql-gate.test.ts`, `extensions/sql-memory/index.ts`, `extensions/sql-memory/index.test.ts`, `extensions/buck-loop/sql-save.ts`, `extensions/buck-loop/loop.ts`, `extensions/buck-loop/__tests__/sql-save.test.ts`, `skills/b-save/SKILL.md`, `plugins/buck-workflow/skills/b-save/SKILL.md`, the iterate artifact, draft commit, this memory, and memory index.
- Verification: 121 focused Vitest tests passed; disposable PostgreSQL test inspected rows from distinct phases and denied a direct immutable SQL update. Durable guardrails v2 passed: unit, ratchet (88.2% vs 84%), complexity; lint/functional disabled. `npx tsc --noEmit` failed with broad test/tooling type errors, including unrelated loop-test callbacks; no new diagnostics in changed production files were visible in its output.
- Next: supervisor reruns `/b-review` against Phase 3; Phase 4 still owns deployed child/full-loop proof.
