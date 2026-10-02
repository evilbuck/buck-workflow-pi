---
date: 2026-10-01
domains: [sql-memory, testing]
topics: [remember, iteration, complexity, recall-denial]
related: []
priority: high
status: completed
subject: 2026-10-01.sql-memory-remember-op
artifacts:
  - .context/2026-10-01.sql-memory-remember-op/iterate-sql-memory-remember-op.md
  - .context/2026-10-01.sql-memory-remember-op/plan-sql-memory-remember-op.md
  - .context/2026-10-01.sql-memory-remember-op/draft-commit.md
  - extensions/sql-memory/index.ts
  - extensions/sql-memory/remember.test.ts
  - extensions/sql-memory/tool.test.ts
  - extensions/sql-memory/remember.ts
  - extensions/sql-memory/identity.ts
  - extensions/sql-memory/notice.ts
---

# sql-memory remember iteration

Two passes against `iterate-sql-memory-remember-op.md`. Both are closed. Subject stays active until review passes.

First pass: SQL query failures call `fixForSqlError` and pass through driver `hint`/`code`/`table`/`column`. Unknown-category rejections use `fixFor("category")`. `previousId` builds a correction and calls `correctSqlMemory`. Readback throws when the active row is missing. Detached HEAD stores null/null. Origin redaction reuses `redactRemoteCredentials`.

Second pass: `correctionStore.answer` was lizard CCN 17, over the hard ceiling, and the only new complexity violation. Split into `lookup`, `claim`, `insertSuccessor`, and `link`. Measured CCN: lookup 9, claim 4, insertSuccessor 3, link 4, answer 5. Not added to the complexity baseline. Recall-role denial `fix` is `Use the recall protocol.` and must not tell the caller to call `remember`.

Verification: `extensions/sql-memory/remember.test.ts` and `tool.test.ts` — 13 passed. `npm run guardrails:check` status pass. Unit pass. Lint skipped (disabled). Patch pass. Ratchet 87.9% vs 84% baseline. Complexity gate pass, `new_violations` empty, hotspots unchanged at 30. Do not apply the coverage ratchet rewrite from this check.

Next: `/b-review` against `plan-sql-memory-remember-op.md`, then `/b-save`, then `/b-commit`. Out-of-plan: `max(seq)+1` race stays a follow-up plan; no `(project, seq)` unique constraint. Do not stage unrelated `2026-09-30.buck-loop-tui-preview` edits with this subject.
