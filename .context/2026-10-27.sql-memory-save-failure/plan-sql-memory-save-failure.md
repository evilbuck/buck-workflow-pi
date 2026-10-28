---
date: 2026-10-27
memory:
  - sql-memory-save-binding-2026-10-27.md
status: completed
research:
  - research-sql-memory-save-failure.md
---
# Repair SQL save attempt binding

## Root cause and feedback loop
Before the fix, `bun /tmp/buck-sql-save-smoke.ts` exercised real `rememberWithIdentity` with temporary tables cloned from the configured PostgreSQL schema and the real `public.reject_memory_content_update()` trigger. It exited 1 with `memory content and provenance are immutable; insert a successor memory` (`P0001`). After the repair, the expanded smoke exited 0 and verified the supervisor's reconstructed receipt. No production rows were changed; temporary tables disappeared at disconnect, and the smoke script was removed.

Ranked hypotheses: (1) post-save attempt binding mutates immutable context; (2) retries use an already superseded predecessor; (3) runtime/source mismatch. The real-trigger failure and `bindSaveAttempt`'s `UPDATE memories SET context` identify (1). Correction-target and model-written query errors are secondary to repeated save failures.

## Decision
Use existing relational memory tags for attempt membership, with a reserved deterministic `sql-memory-save:<attemptId>` tag. `remember` attaches an active, read-back-verified, same-project memory to that tag. The supervisor joins `memory_tags`, `tags`, `memories`, and `projects` to reconstruct receipt ids. Do not mutate memory context, weaken the immutable trigger, duplicate memory rows for a new attempt, introduce a migration, bypass receipt verification, or change checkpoint transitions.

## Implementation
1. Make the stateful SQL fixture enforce immutable context and cover save/correction/new-attempt retries.
2. Replace context mutation with idempotent tag insertion and membership insertion; verify membership before success.
3. Migrate supervisor binding queries and existing consumer tests to relational membership.
4. Verify fresh saves, identical retries, corrections, rebinding an existing row to a later attempt, and receipt reconstruction against real PostgreSQL using isolated temporary tables.
5. User-approved scope expansion: extract guarded choice-transition construction from `machine.ts::next` to remove the required complexity violation (11 vs limit 10) without changing transitions, diagnostics, or guardrails baselines.

## Acceptance
- [x] Save succeeds with the real immutable-content trigger enabled.
- [x] Identical calls reuse an active memory id, including across attempts.
- [x] Correction retries preserve predecessor content, provenance, and successor linkage.
- [x] Supervisor derives current-attempt ids from database membership; unrelated projects/subjects are excluded.
- [x] Focused tests and authoritative guardrails pass, including the approved `machine.ts::next` complexity fix.
- [x] Documentation records the tag-based binding contract; temporary smoke code is removed.

## Existing work
The checkout started with 19 modified files, including loop recovery, SQL tool schema, receipt binding, tests, skills, and docs. Preserve those changes. No commit, reset, user-state rewrite, or neighboring-loop restart is implied by this repair.

## Runtime handoff
The user chose **Leave restart to me**. The neighboring OMP process remains untouched and its loop remains blocked. Restart that OMP session to load the repair, then explicitly resume the loop when desired. Verification and independent review are recorded in `research-verification.md` and `review-sql-memory-save-failure.md`.
