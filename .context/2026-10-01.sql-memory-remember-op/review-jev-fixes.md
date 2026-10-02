---
status: completed
date: 2026-10-01
subject: 2026-10-01.sql-memory-remember-op
topics: [sql-memory, review, judgment, verification]
addresses: plan-sql-memory-remember-op.md
iteration: iterate-jev-warning-severity.md
---

# Review: Jev-directed fixes

**Verdict: Pass.** The Jev-classified in-plan runtime defect and verification gaps are resolved. Independent standards review approves with no reachable bug or regression.

## Scope

Contract: `plan-sql-memory-remember-op.md` and `iterate-jev-warning-severity.md`. Baseline: pre-fix working source on HEAD `90b5f1ad61286c0da3f93e90b28be0444c94aea8`. Unrelated TUI-preview subject changes preserved. This is a follow-up to already-built remember/error-fix work, not a new writer or concurrency redesign.

## Completion matrix

| Requirement | Status | Current evidence |
|---|---|---|
| Active database category enforcement | complete | remember.ts validates active rows before identity upserts. Before fix: remember suite 2 failed / 7 passed; after fix: 9 passed. Candidate seeded slug rejected and new active slug accepted. |
| Fix lists current legal slugs, including empty list | complete | RememberCategoryError and index.ts failureFix; tool tests and PostgreSQL smoke. No static allowlist or model catalog query. |
| Actual fresh retries and distinct-body separation | complete | Stateful source-key lookup test fixture; two actual identical calls persist one row and return one id; different bodies retain distinct keys and rows. PostgreSQL smoke confirms. |
| Actual correction retry and immutable predecessor | complete | Repeated calls create one successor; predecessor body unchanged, invalid_at set and superseded_by links successor. Claim/insert/link remain in existing correctSqlMemory transaction. PostgreSQL smoke confirms. |
| Missing email/origin and throwing git runner zero writes | complete | Three actual remember-entry tests assert rejection and zero queries/users/projects/memories. |
| Retry-collapse documentation | complete | Tool column card, docs/sql-memory.md, canonical/bundled b-save explain identical subject/phase/body/previousId reuse and distinct/correction choices. |
| Original steps 1–2: column card, incident fixes, notices | complete | Existing columns/index/notice tests pass in SQL-memory suite; focused index/notice/plugin tests pass. |
| Original steps 3–4: remember identity, roles, readback, correction | complete | SQL-memory suite and changed-path real PostgreSQL smoke pass; source diagnostics clean. |
| Original steps 5–6: skill cutover, parity, documentation | complete | Full-directory diff empty; plugin suite passes; no INSERT INTO memories or information_schema in b-save. |
| Original step 7: deterministic contract; supervisor unaffected | complete | Guardrails pass; actual supervisor sql-save suite 11 passed / 1 skipped; writer unchanged. |
| A-1: JSON is correction channel | validated, nonblocking | Prior incident evidence retained; index/tool tests and smoke validate JSON fix channel. |
| A-2: author is email | validated, nonblocking | Fixture inserted-row assertions cover fixed email/origin; identity tests and real git-backed smoke pass. |
| A-3: direct-tool availability | validated, nonblocking | Existing direct-tool tests pass; recall denial preserved. |
| A-4: bundled skill parity | validated, nonblocking | Full-directory diff empty and codex-plugin test passes. |
| Material risk: wrong/missing identity; additive/correction fallback | validated | Zero-query failure tests and inserted provenance assertions; real previousId correction preserves immutable body. Raw SQL fallback remains covered by existing index tests. |
| Material risk: model ignores remember; incident-fix fallback | validated | 42703, catalog denial, UUID/text fix and real denial-notice tests pass. Model obedience remains intentionally unguaranteed. |
| Material risk: facts collapse; distinct/correction fallback | validated | Stateful and PostgreSQL fresh/distinct/correction checks; tool/skill/docs explain body/phase/previousId choices. |
| Material risk: stale bundle; recopy fallback | validated | Canonical recopy followed by directory parity and plugin tests. |

## Verification

- `npx vitest run extensions/sql-memory`: 8 files, **114 passed, 1 skipped**.
- Focused index/notice/codex-plugin run: 3 files, **25 passed, 1 skipped**. Initial command also named a nonmatching supervisor path; the actual supervisor suite was run separately.
- `npx vitest run extensions/buck-loop/__tests__/sql-save.test.ts`: **11 passed, 1 skipped**.
- LSP diagnostics: remember.ts, remember.test.ts, index.ts, columns.ts, tool.test.ts: **OK**.
- `diff -rq skills/b-save plugins/buck-workflow/skills/b-save`: empty. No INSERT INTO memories or information_schema matches in canonical b-save.
- Real `sqlMemoryTool.execute` against PostgreSQL: candidate-category zero writes; newly active category accepted; fresh retry one row; distinct bodies separate source keys; correction retry one successor; immutable predecessor/linkage; no-active-slugs fix. **All seven scenarios passed.** Three test memories existed only in connection-local TEMP tables; all relation names were verified to resolve to pg_temp before tool calls. Connection close removed them; no persistent memories written. First inline invocation had a shell quoting parse error before DB connection; corrected invocation passed. No throwaway files created.

### Guardrails verdict

`npm run guardrails:check`: **pass**, durable v2. Required unit, global ratchet and complexity gates pass. Coverage **87.9%**, baseline 84%. No new or hard-ceiling complexity violations; 30 existing hotspots unchanged. Functional/lint disabled and skipped. Patch advisory reports pass with numeric measurement null; do not infer measured patch coverage. No baselines or enforcement changed.

## Independent review axes

- Spec axis worst finding: **none** within accepted scope.
- Standards axis: independent task `Jev fix standards review`, **Approve**, no new reachable bugs/regressions. Reported a hypothetical null-slug cast nit despite primary-key non-null schema and an optional future caching observation. Neither warrants added validation, caching, or scope: current schema guarantees slug text and fresh querying is the requested status contract.
- Cross-axis ranking: none.

## Documentation and exclusions

SQL-memory guide and canonical/bundled save skill updated; no further architecture/convention/how-to impact. Concurrent max(seq)+1 allocation remains the separately deferred out-of-plan concern. This evidence proves sequential retries, not concurrency-safe uniqueness. Dismissed previousId-bypass, unused-subject and docs-contradiction claims were not implemented as fixes; no new driver-secret leak was demonstrated.

## Next action

Implementation and review complete; draft commit refreshed. Formal `/b-save` checkpoint then `/b-commit` remain operator actions. No commit created by this request. Subject lifecycle remains unchanged.
