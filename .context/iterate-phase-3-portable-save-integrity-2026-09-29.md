---
status: completed
date: 2026-09-29
updated: 2026-09-29
subject: 2026-09-28.sql-memory-buck-loop
topics: [review, iteration, sql-memory, portable-save]
informs: []
addresses: phase-3-sql-save-truthful-completion.md
completed: 2026-09-29
from_review: b-review
---

# Iteration: Phase 3 portable SQL save integrity

## Source
- Reviewed after: `/b-iterate`
- Phase: `phase-3-sql-save-truthful-completion.md`
- Baseline: `7705adf` plus the current staged and unstaged Phase 3 work.
- Shared SQL recall returned zero active project matches; phase and source are the acceptance evidence.

## Critical Issues

### 1. Portable correction can strand an active successor
- **File**: `skills/b-save/SKILL.md:42-45`
- **Problem**: The portable `sql_memory` procedure performs an INSERT and a subsequent UPDATE as two individually committed tool calls. Its preliminary project check does not require the predecessor to still be active, and the UPDATE has no project/active predicate or row-count requirement. If the old row was already superseded or the second call fails, an active successor persists without a matching predecessor transition. A retry may reuse that orphan by source key. The transactional correction in `extensions/buck-loop/sql-save.ts:157-190` protects only the alternate save path, not this portable one.
- **Proposed fix**: Give the portable save child a stage-scoped atomic correction operation using the existing gated SQL executor, with an active same-project predecessor claim and rollback on insert/link failure. Preserve source-key retry semantics; test already-superseded and failed-link cases against a disposable PostgreSQL target through the portable path. Do not claim that two `sql_memory` calls form a transaction.

### 2. Portable receipt is instructed to precede same-project read-back
- **File**: `skills/b-save/SKILL.md:41-45`
- **Problem**: The skill tells the child to write the receipt as soon as IDs exist, without a same-project active-row read-back. The phase requires that read-back before receipt creation. The supervisor checks the receipt later, but that does not make the persisted receipt's creation-order claim true, and another consumer may see an unverified receipt.
- **Proposed fix**: Require an explicit bound read-back for each returned/reused ID joined to the directive's project, including the active-row predicate, before writing a `kind: rows` receipt. A failed or missing read-back must not produce a receipt; cover it with a portable save scenario.

## Warnings

### 1. Live deployed-child proof belongs to Phase 4
- **File**: `phase-4-policy-docs-live-proof.md:22-27`
- **Problem**: Focused disposable-PostgreSQL save/resume tests ran, but this review did not exercise the deployed OMP child executing portable `b-save` and a full `/buck-loop` command. Phase 4 explicitly owns that end-to-end proof.
- **Suggested approach**: Exercise the deployed child and supervisor against disposable PostgreSQL in Phase 4; do not count focused tests as that proof.

## Verification
- `npm run guardrails:check`: durable v2 pass; unit, global ratchet (88.2% vs 84%), complexity, patch gates pass; functional and lint skipped.
- `npx vitest run extensions/buck-loop/__tests__/sql-save.test.ts extensions/buck-loop/__tests__/loop.test.ts skills/b-save-improved/scripts/save-apply.test.ts`: 89 passed in 3 files with the configured disposable SQL test URL.

## Resolution

- Save-stage `sql_memory` now exposes `op: "correct"`: gated single transaction claims the active same-project predecessor, inserts/reuses the successor, and links it; failures roll back. Disposable PostgreSQL covers retry, superseded target, and injected link failure.
- Portable `/b-save` now requires a bound active same-project read-back per ID before creating a rows receipt. The alternate save path also reads back before receipt creation; a missing row leaves the attempt unverified.
- Phase 4 still owns deployed OMP-child and full loop proof.

## Recommended Workflow

Start with `/b-iterate` against this artifact, then re-run `/b-review` on Phase 3. The supervisor chooses the next loop state.
