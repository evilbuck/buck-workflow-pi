---
status: completed
date: 2026-10-01
updated: 2026-10-01
subject: 2026-10-01.sql-memory-remember-op
topics: [review, iteration, sql-memory, remember]
informs: []
addresses: plan-sql-memory-remember-op.md
completed: 2026-10-01
from_review: b-review
---

# Iteration: sql-memory-remember-op

## Source
- Reviewed after: `/b-iterate` (re-review of `plan-sql-memory-remember-op.md`)
- Plan: `plan-sql-memory-remember-op.md`
- Prior iteration closed 2026-10-01. Those defects are fixed in the current tree: `fixForSqlError` is called, `previousId` goes through `correctSqlMemory`, readback throws, detached HEAD is null/null, and origin redaction reuses `redactRemoteCredentials`. Recorded in `.context/memory/sql-memory-remember-op-iterate-2026-10-01.md`.

## Critical Issues

### 1. Required complexity gate fails
- **File**: `extensions/sql-memory/remember.test.ts`
- **Problem**: Plan verification requires `npm run guardrails:check` to pass. The durable v2 contract failed: `complexity_gate` is `required` and `fail`. `answer` inside `correctionStore` (`remember.test.ts:67-101`) has cyclomatic complexity 17. New-function max is 10; hard ceiling is 15. Unit, ratchet, and patch gates passed. This is the only new violation.
- **Proposed fix**: Split `answer` into small handlers (claim, successor insert, link, lookup) so every new function is ≤ 10. Re-run `npm run guardrails:check` and do not finish until `complexity_gate` is `pass`. Do not add `answer` to the complexity baseline.

## Warnings

### 1. Recall-role `fix` still offers `remember`
- **File**: `extensions/sql-memory/index.ts`
- **Problem**: Scope requires the recall denial `fix` to say use the recall protocol, not `remember`. `index.ts:363` says "Use the recall protocol or call remember only from the save stage or the direct tool." The denial itself is correct (`tool.test.ts:63-71`).
- **Suggested approach**: Point the fix at the recall protocol only. Assert the fix does not tell the caller to call `remember`.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against `plan-sql-memory-remember-op.md`.
Do not fold the concurrent `max(seq)+1` race into this iteration. The plan specified that allocation, and there is no `(project, seq)` unique constraint (`migrations/001_initial_schema.sql:51`). That race stays a follow-up `/b-plan`.

## Resolution

Closed 2026-10-01. `correctionStore` handlers are `lookup` (CCN 9), `claim` (4), `insertSuccessor` (3), `link` (4), and `answer` (5). None were added to the complexity baseline. Recall-role `fix` is `Use the recall protocol.` `tool.test.ts` asserts that string and that the fix does not contain `remember`. `npm run guardrails:check` status `pass`; `complexity_gate` `pass`; `new_violations` empty.
