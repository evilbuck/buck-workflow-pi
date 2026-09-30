---
date: 2026-09-29
domains: [extensions, sql-memory, testing]
topics: [buck-loop, bounded-recall, jev, project-identity]
related: [../2026-09-28.sql-memory-buck-loop/phase-2-recall-bounded-judgment.md, sql-memory-buck-loop-phase-2-recall-2026-09-29.md]
priority: high
status: active
subject: 2026-09-28.sql-memory-buck-loop
artifacts: [../2026-09-28.sql-memory-buck-loop/phase-2-recall-bounded-judgment.md]
---

# SQL memory Buck-loop Phase 2 runtime checkpoint

## Result

Added `extensions/buck-loop/project-memory.ts` and wired parent-side bounded SQL recall into non-commit nested stage handoffs. Project identity prefers credential-redacted origin, then absolute git common dir; current branch/full SHA are provenance. Query uses bound values, active project-wide rows, deterministic SQL ranking/tie order, row/body limits, and distinguishes no configuration, identity failure, zero matches, and SQL error. Multiple rows may be narrowed to a legal SQL-candidate ID by parent Jev; invalid/missing answers and Jev failures retain the SQL-ranked shortlist.

The prior diagnosed shared query result — successful query with zero active matches — is a valid empty shortlist, not a missing-store or query failure. Added focused contract tests for unavailable-vs-empty distinction, redacted project identity and branch/SHA provenance, active-only bounded SQL, deterministic shortlist retention after an invented Jev ID, and common-git-dir fallback.

Phase remains incomplete: no actual configured nested OMP child was run, and the required guardrail unit/global-ratchet gate fails because canonical `skills/_shared` differs from the Codex plugin bundle. Do not mark acceptance complete until required verification and the planned live proof pass.

## Verification

- `npx vitest run extensions/buck-loop/__tests__/project-memory.test.ts --reporter=verbose`: 5/5 pass.
- `npx vitest run extensions/buck-loop/__tests__ --reporter=dot`: 267/267 pass.
- `npm run guardrails:check`: fail; required unit/global-ratchet gate reports pre-existing Codex plugin canonical-copy parity (`scripts/codex-plugin.test.ts`: `_shared` differs). Complexity passes; patch coverage is advisory and unavailable because the test command failed.
- The reported empty shared SQL query is accepted as ground truth; no repeat query was needed.

## Files changed by this assignment

- `extensions/buck-loop/project-memory.ts` (runtime implementation from the previous attempt; already staged before this continuation)
- `extensions/buck-loop/loop.ts` (recall integration from the previous attempt; already staged before this continuation; file also contains unrelated user changes)
- `extensions/buck-loop/__tests__/project-memory.test.ts` (new focused recall contract tests)
- `extensions/buck-loop/__tests__/loop.test.ts` (previous attempt's retry-handoff expectation adjustment; already staged; file also contains unrelated user changes)
- `extensions/buck-loop/__tests__/run-step.test.ts` (previous attempt's test env isolation; already staged)
