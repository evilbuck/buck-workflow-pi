---
date: 2026-10-27
status: completed
---
# Verification evidence

## Reproduction
`bun /tmp/buck-sql-save-smoke.ts` before the fix: exit 1, PostgreSQL `P0001`, `memory content and provenance are immutable; insert a successor memory`, raised by the actual `public.reject_memory_content_update()` trigger. The smoke used connection-local temporary copies of the real schema; no production rows were changed.

The existing stateful test was corrected to reject context mutation like PostgreSQL. `node node_modules/vitest/vitest.mjs run extensions/sql-memory/remember.test.ts` then failed its attempt-binding test with the exact immutable-provenance error (9 passed, 1 failed).

## Focused regressions after repair
`node node_modules/vitest/vitest.mjs run extensions/sql-memory/remember.test.ts extensions/sql-memory/sql-gate.test.ts extensions/buck-loop/__tests__/sql-save.test.ts`: exit 0, 74 passed, 1 skipped. Tag reads work in the save policy; direct child writes to tags and memory_tags remain denied.

## Real PostgreSQL smoke after repair
`bun /tmp/buck-sql-save-smoke.ts`: exit 0. Observed:
- Fresh memory save and identical retry return the same id.
- Correction and correction retry preserve predecessor context and successor linkage.
- A later save attempt reuses the active corrected id without another memory row.
- Wrong-project and unrelated-attempt binding queries return no rows.
- The supervisor reconstructs a completed receipt from an empty child ids list and verifies it.
- Exactly two memory rows exist in the temporary fixture (predecessor and corrected successor).
- The real PostgreSQL immutability trigger remains enabled throughout.

## Authoritative guardrails
The initial `npm run guardrails:check` exited 1 only for pre-existing uncommitted `machine.ts::next` complexity (11 vs limit 10). The user selected **Fix hotspot too**. Guarded choice-transition construction was extracted unchanged into `choiceTransition`; the independent reviewer confirmed behavioral equivalence.

Final `npm run guardrails:check`: exit 0, status pass. Unit gate pass; global coverage ratchet pass (89.3% vs 84% baseline); complexity pass with no new or hard-ceiling violations. Functional and lint gates skipped; patch gate advisory. No guardrails baseline or enforcement was changed.

The first MCP execution lost its result at the 30-second transport timeout despite an explicit 330-second tool timeout; a durable-capture rerun obtained each verdict. Temporary capture and smoke scripts were removed after verification.

## Runtime state
Other-tab log ends at `2026-10-28T00:51:56.219Z`, blocked with `SQL save failed before a verified receipt: Memory failed · memory content and provenance are…`. The running pane loads the main checkout through its configured extension path and the `~/.omp/plugins/node_modules/@buckleyrobinson/buck-workflow` symlink, not the worktree's extension source. Exact saved session: `~/.omp/agent/sessions/-.worktrees-buck-workflow-pi-feat.git-cleanup-skill/2026-10-26T12-36-33-969Z_01a17836-6831-76f5-ac20-132e893edad5.jsonl`, resolved from its `pts/7` terminal-session checkpoint.

The user explicitly selected **Leave restart to me**. No process was restarted and no Buck loop was resumed. Restarting OMP is required to load the on-disk repair. No projection, receipt, checkpoint, or production memory row has been manually altered by this repair.

## Diagnostics limitation
LSP diagnostics for `remember.ts` repeatedly return `Operation aborted`; no clean diagnostic claim is made. `sql-save.ts` reports an existing typing error at line 122: `MigrationPool` does not declare `end()`; the repair changes its binding query at line 275, not pool ownership.

## Review iteration follow-up
The pass 2 finding was valid: a completed rows receipt could be accepted without current-attempt tag membership. Empty membership now leaves rows receipts unverified; a membership-query error blocks verification, including for no-fact receipts. The direct `b-save-improved` save path now binds its saved ids before issuing its receipt, using the same reserved tag and active project read-back.

Focused Vitest: 32 passed, 1 database integration skipped. A standalone Bun smoke with an active same-project id but no membership returned `{"status":"unverified"}`. `npm run guardrails:check` passed: unit, global coverage ratchet (89.3% versus 84%), and complexity gates passed; patch advisory, lint and functional skipped. No real-database integration was run for this follow-up. The review-iteration run state and checkpoint remain unchanged.
