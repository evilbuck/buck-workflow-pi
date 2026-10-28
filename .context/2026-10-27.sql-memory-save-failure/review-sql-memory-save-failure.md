---
date: 2026-10-27
status: completed
---
# SQL memory save repair review

Acceptance contract: `plan-sql-memory-save-failure.md`. Scope is this session's attempt-binding repair plus the explicitly approved `machine.ts::next` complexity refactor; the checkout's pre-existing changes are preserved, not recertified as part of this review.

| Acceptance | Evidence |
|---|---|
| Real immutable-content trigger accepts saves | Live PostgreSQL smoke exits 0 with the production trigger function on connection-local temporary tables. |
| Retry ids remain stable across attempts | Smoke and stateful regression reuse the corrected active id; only predecessor and successor memory rows exist. |
| Corrections preserve provenance/linkage | Both checks assert unchanged predecessor context and the correct superseded_by link. |
| Supervisor uses current-attempt membership | Smoke reconstructs and verifies a completed receipt from an empty child ids list; wrong-project/unrelated-attempt queries return no rows. |
| Child tag writes stay denied | Save SQL policy permits membership reads, while INSERT into tags and memory_tags remains denied; focused policy tests pass. |
| Approved complexity repair preserves transitions | Existing guarded choose-transition construction extracted to choiceTransition; independent source review confirms unchanged evaluation order, errors, choices, values and diagnostics. |
| Required deterministic checks pass | Final npm run guardrails:check exits 0: unit, coverage ratchet and complexity pass; lint/functional skipped; patch advisory. Coverage 89.3%, baseline 84%. |

## Independent standards axis
Reviewer `ReviewSqlAttemptBinding` found no repair-introduced correctness/security issues in the SQL binding patch. A second narrow review found no behavioral differences from the approved choice-transition extraction. Review was read-only; the parent owns all executed verification.

## Documentation
`docs/buck-workflow.md` documents tag membership, immutable context, supervisor receipt derivation, and read-only child tag access. `docs/CHANGELOG.md` records the fix. No new user action or how-to contract was introduced by the implementation.

## Runtime boundary
The other pane loads the main checkout through the configured extension path and plugin symlink, not its worktree's source files. Its already-running process has old code in memory. The user explicitly chose **Leave restart to me**; no process was restarted, no loop was resumed, no checkpoint or receipt was manually changed, and no commit was created.

Verdict: Pass for the on-disk repair. User-owned runtime restart remains required to load it.
