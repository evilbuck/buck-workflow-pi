---
status: completed
date: 2026-09-29
updated: 2026-09-29
subject: 2026-09-28.sql-memory-buck-loop
topics: [review, iteration, sql-memory, buck-loop]
informs: []
addresses: phase-3-sql-save-truthful-completion.md
completed: 2026-09-29
from_review: b-review
---

# Iteration: Phase 3 SQL save and truthful completion

## Source
- Reviewed after: `/b-build-hard`
- Phase: `phase-3-sql-save-truthful-completion.md` (currently marked completed; the implementation does not yet meet its criteria)
- Plan: `plan-sql-memory-buck-loop.md`
- Baseline: `7705adf` plus the existing staged and unstaged phase work on `feat/sql-memory-tool`

## Critical Issues

### 1. The alternate save path discards new memories and writes dangling Markdown references
- **Files**: `extensions/b-save-improved/index.ts:472-498,687-707`; `skills/b-save-improved/scripts/save-apply.ts:167-213,520-531`
- **Problem**: With `SQL_MEMORY_URL`, apply skips the memory and index writes but no SQL insert or receipt replaces them. Payload assembly still creates `../memory/<filename>` cross-references, and apply writes them to plans/specs. A successful `/b-save-improved` therefore loses the proposed memory body and leaves links to a file that was never created. Its schema still requires the phantom `memory.path` and `index_entry`.
- **Proposed fix**: Implement the SQL-backed insert/read-back and subject receipt for this entry point (or explicitly delegate to the same functional SQL save path); use SQL receipt/IDs for cross-references, remove the phantom Markdown dependency in SQL mode, and test a complete SQL-mode save. Preserve file-mode behavior.

### 2. Resume of a verified interrupted save re-runs the child instead of advancing
- **Files**: `extensions/buck-loop/loop.ts:244-259,610-617`; `extensions/buck-loop/persist.ts:156-176,230-240`; `extensions/buck-loop/machine.ts:114-125,327-343`
- **Problem**: `reconcileSqlSave` checks a receipt on resume but does not put that verification in `snapshot.workFacts`. `persist.resume()` ordinarily restores `sessionOutcome: pending`, so `next()` takes `saving-session-pending` and launches another save even when the current receipt and rows were verified; at the loop limit it blocks instead. A `committing` resume similarly re-runs commit. This breaks the promised crash/resume behavior.
- **Proposed fix**: On `saving` resume, restore a confirmed save work fact only after receipt and same-project row verification; keep unrelated states unchanged. Exercise crash after receipt, resume before commit, and missing/stale receipt or DB outage with full loop tests.

### 3. Credential-bearing Git origins enter a persisted receipt and child prompt
- **File**: `extensions/buck-loop/sql-save.ts:53-76,122-130,223-229`
- **Problem**: `projectOrigin` returns `git remote get-url origin` verbatim, unlike `project-memory.ts:86-96`, which redacts embedded URL credentials. `prepareSaveAttempt` writes that string into `.context/workflow/sql-save-attempt.json`; the directive and receipt reuse it. The secret-key check looks at JSON field *names*, not credentials embedded in the `project` value.
- **Proposed fix**: Apply the same credential-redaction identity resolver as recall before writing any attempt or directive, reject leaking values, and test an HTTPS origin containing username/password without persisting or displaying them.

### 4. The deterministic contract fails
- **Files**: `extensions/buck-loop/__tests__/loop.test.ts:975-979,1145-1159`; `extensions/buck-loop/loop.ts:244-259`; `extensions/buck-loop/sql-save.ts:146-156`
- **Problem**: `npm run guardrails:check` returned `status: fail`: required unit gate failed (19 reported failures, including the resume scenario and zero-row recall loop scenario), required global coverage ratchet failed because coverage command exited 1, and required complexity gate found `resumeRun` at 12 and `confirmReceipt` at 36 (hard ceiling). Patch gate is advisory; lint and functional gates are skipped.
- **Proposed fix**: Correct behavior and contracts without deleting or weakening tests; refactor the two hotspots, then rerun the durable guardrails contract and report all gate values. The successful zero-match recall is not itself a save postcondition: the zero-row test needs to exercise a real save receipt or assert the actual blocked state rather than claiming `done` from a stub-only save.

## Warnings

### 1. Phase-3 live save evidence has not been established
- **Files**: `phase-3-sql-save-truthful-completion.md:63-67`; `extensions/buck-loop/__tests__/sql-save.test.ts:34-117`
- **Problem**: Receipt tests use an injected query stub and a fake URL; they do not prove insert, supersede, apostrophes, same-project read-back, no-fact, failure, and crash/resume against the disposable `pgvector/pg18` database. The disposable container was available during review, but no full save-path run was observed.
- **Suggested approach**: Exercise the specified throwaway database and OMP child/loop path, recording SQL rows, receipt and blocked/committed state; avoid the real shared DB.

## Resolution

- `/b-save-improved` now persists the scribe's reusable record in SQL, deduplicates a retry by source key, verifies the same-project receipt before metadata apply, and writes `sql_memory_ids` instead of phantom Markdown links. Apply refuses SQL mode without a receipt.
- Resume restores confirmed saving work only after receipt/read-back, and a completed commit is recognized from the Git postcondition. Missing/stale receipts and database failures remain fail-closed.
- Save attempt origin is credential-redacted before persistence or child directive. The activity sink is forwarded to nested work again.
- Disposable PostgreSQL tests exercised apostrophes, source-key reuse, subject receipt/read-back, no-fact, alternate apply without a Markdown body, and interrupted-save resume-to-commit. A deployed OMP child was not exercised in this iteration; Phase 4 owns the full operator-facing live proof.
- Durable guardrails v2 passed: 1196 unit tests, 88% coverage versus 84% baseline, no new complexity violations; functional/lint disabled and patch advisory.

## Recommended Workflow

Start with `/b-iterate` against this file. Reopen the phase's status/acceptance claims until the above are fixed; rerun `/b-review` against the same phase. Do not commit this phase as complete while the required guardrails gate fails. After a passing review, `/b-save` records durable state and `/b-commit` checkpoints it.
