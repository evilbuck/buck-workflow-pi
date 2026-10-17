---
status: completed
date: 2026-09-29
updated: 2026-09-29
subject: 2026-09-28.sql-memory-buck-loop
topics: [review, iteration, sql-memory, recall]
informs: []
addresses: phase-2-recall-bounded-judgment.md
completed: 2026-09-29
from_review: b-review
---

# Iteration: Phase 2 recall and bounded judgment

## Source
- Reviewed after: `/b-build`
- Phase: `phase-2-recall-bounded-judgment.md`
- Verification: durable guardrails passed on 2026-09-29 (unit and global ratchet required gates passed; functional and lint skipped). A live `sql_memory` query using the portable instruction's function returned `function plaintext_to_tsquery(unknown, unknown) does not exist`; the prior successful bounded project query returned zero active rows, distinct from that error. Source inspection confirms the parent's `plainto_tsquery` is not in the SQL tool allowlist. No configured nested OMP child was exercised in this review.


## Resolution (b-review closeout, 2026-09-29)

Both critical issues and the warning are fixed and verified:

1. `plainto_tsquery('english', $2)` is now the single contract across `skills/_shared/recall-project-memories.md`, the byte-identical Codex plugin copy, `extensions/buck-loop/project-memory.ts` `RECALL_SQL`, and the `sql-gate` allowlist (`PLAINTO_TSQUERY` allowed; the nonexistent `plaintext_to_tsquery` denied, both directions tested in `extensions/sql-memory/sql-gate.test.ts:67-79`).
2. `recallProjectMemories` returns a typed `RecallOutcome`; `extensions/buck-loop/loop.ts:593-595` throws on `failure` so the stage blocks before any child spawn (`extensions/buck-loop/__tests__/loop.test.ts:1121-1128` asserts `runStep` never runs), while `success-empty` still proceeds with the distinct zero-match handoff.
3. Jev relevance is one bounded `noul` question per shortlist candidate; answers are validated against the exact legal ID set with a full-count check, threshold-filtered at 0.7, and any invalidity, Jev failure, or empty selection retains the deterministic SQL shortlist. Single-candidate shortlists skip Jev entirely (unit-tested, including multi-relevant ordering and invented-ID rejection).

Live proof closed the remaining gap: seeded the empty shared store (one user, one project `git@github.com:evilbuck/buck-workflow-pi.git`, two memories with `main`-branch provenance) and ran the production `recallProjectMemories()` against it — `success-rows` returned both rows with ID/body/category/project/branch/SHA while the current branch was `feat/sql-memory-tool`, proving branch/SHA are provenance-only and never recall filters. Focused suites 98/98; durable guardrails v2 pass (coverage 88.5 vs baseline 84).

## Critical Issues

### 1. Recall SQL contract names a nonexistent function
- **Files**: `skills/_shared/recall-project-memories.md:7`, `plugins/buck-workflow/skills/_shared/recall-project-memories.md:7`, `extensions/buck-loop/project-memory.ts:55-62`, `extensions/sql-memory/sql-gate.ts:20-26`
- **Problem**: Portable skills are instructed to call PostgreSQL `plaintext_to_tsquery`, which the gate allows but PostgreSQL does not implement. Parent recall instead uses valid PostgreSQL `plainto_tsquery`, which the SQL tool gate denies when a child follows the parent query shape. A live portable-style read failed; an empty shortlist cannot be inferred from that failure.
- **Proposed fix**: Align canonical instruction, Codex copy, and the SQL gate on PostgreSQL's real `plainto_tsquery`; keep it bound and restricted to allowlisted tables. Prove a project-scoped active-only query through the actual `sql_memory` tool and add a focused gate test for the function.

### 2. Parent recall failures are fed to the child as normal handoff
- **Files**: `extensions/buck-loop/project-memory.ts:34-52`, `extensions/buck-loop/loop.ts:589-605`, `extensions/buck-loop/__tests__/project-memory.test.ts:111-116`
- **Problem**: On SQL query error `recallProjectMemories` returns a diagnostic string. `runNestedSkill` treats that string as ordinary handoff and starts the child. With `SQL_MEMORY_URL` configured, that silently downgrades configured recall rather than blocking the stage, contradicting the plan's configured-mode failure contract. The focused test only checks diagnostic wording, not whether the stage stops.
- **Proposed fix**: Return a typed success/empty/unavailable/failure result or throw on configured query/identity/pool failure; make `runNestedSkill` refuse to spawn the child when configured recall fails. Preserve an explicit successful zero-row outcome. Add a loop-level regression that verifies the child was not invoked after a query error and that empty success still runs normally.

## Warnings

### 1. Relevance judgment does not implement the phase's `noul` contract
- **File**: `extensions/buck-loop/project-memory.ts:85-103`
- **Problem**: The phase acceptance criterion says optional parent Jev `noul` relevance over legal shortlist IDs; the implementation asks one `choice` among the IDs and `none`. One choice can select only one relevant memory, discarding other relevant candidates even when the shortlist contains several. The sole invalid-ID test asserts the wrong contract.
- **Suggested approach**: Judge each candidate with bounded `noul` relevance (or a batch with one legal yes/no per ID), validate the result against the exact shortlist, preserve SQL order and deterministic fallback on failure, and test multiple relevant memories as well as invalid/missing output.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically. Then re-run `/b-review` against the same phase. Inside an OMP execution session, this artifact is not done until it is completed, review passes, and `/b-save` has recorded durable state.
