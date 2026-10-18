## Plan Path Review: sql-memory-tui-notice

### Plan Source
- File: `.context/2026-09-30.sql-memory-tui-notice/plan-sql-memory-tui-notice.md`
- Goal: One shared notice line on the parent tool card and the buck-loop activity line when `sql_memory` runs.
- Baseline: `e3ffb37` on `feat/notifier-sql_memory-use`. Review is the staged implementation, not a later commit.

### Evidence Sources
- Git status: staged formatter, renderer, activity forwarding, supervisor sink wiring, docs, and tests. Unrelated unstaged backlog edits were excluded.
- Recent commits: no implementation commit yet. Work is uncommitted on `e3ffb37`.
- Modified files: `extensions/sql-memory/notice.ts`, `notice.test.ts`, `index.ts`, `index.test.ts`, `extensions/omp-models.ts`, `omp-models.test.ts`, `extensions/buck-loop/run-step.ts`, `run-step.test.ts`, `loop.ts`, `sql-save.ts`, `extensions/b-save-improved/index.ts`, `docs/sql-memory.md`.
- Plan affected files verified: all listed paths are in the staged diff. Step 5 also touched `loop.ts`, `sql-save.ts`, and `b-save-improved/index.ts`.

### Completion Matrix

| Step | Status | Evidence |
|------|--------|----------|
| 1. Formatter and unit tests | ✅ complete | `notice.ts` runs category, body, query, and error through `safeValue`. Probe: URL category renders `Memory wrote · redacted · "hello"`; `dec\nision` renders `Memory wrote · dec ision · "hello"` with no newline. Denial lines are 50 characters. |
| 2. Execute paths store `details.notice`; model content stays JSON | ✅ complete | `index.ts` `executeSql`, migrate, correct, and the work-error return all set `details.notice`. `index.test.ts` asserts `content` is `{"id":"successor"}`. |
| 3. `renderCall` / `renderResult` | ✅ complete | `renderCall` for `SELECT secret FROM memories` rendered `Memory sql…` and did not contain the statement. Collapsed `renderResult` test is one notice line; expanded output still contains `"rows"`. Host fallback applies only when a renderer is absent. |
| 4. Success activity message from `details.notice`, with `onResult` fallback | ✅ complete | `omp-models.ts` `asToolEnd` keeps `details.notice` on success. `run-step.ts` emits from `onResult` and drops the duplicate subscribe event. Vitest asserts one success line. |
| 5. Supervisor `sqlMemoryRows` / correction writes | ✅ complete | `saveSqlFacts` and `b-save-improved` pass the sink. `openSqlSave` calls `probeSql(undefined, onActivity)`. A refused local probe emitted exactly one `toolEnd`: `Memory failed · connect ECONNREFUSED 127.0.0.1:1`. No-sink `sqlMemoryRows` stays silent. |
| 6. Docs paragraph | ✅ complete | `docs/sql-memory.md` states the line contract, redaction, sink silence, category normalization, and the 50-character cap. |
| 7. Focused tests and guardrails | ✅ complete | Vitest: 89 passed, 1 skipped. Guardrails v2 `status: pass`. |
| Blocking assumptions | ✅ complete | No settings flag, no extra model call, and model `content` remains JSON. None are unresolved blockers. |
| Material rollback | ✅ complete | `renderCall` / `renderResult` are local; omitting them restores the host card. The `onResult` fallback is implemented and tested. |

### Review Axes
- Spec axis worst finding: none
- Standards axis worst finding: sequential fallback (no background `task` tool). `notice.ts` copies `sql-save.ts`'s secret pattern but drops the `^url$` anchor and matches the value, so ordinary text is redacted (`see the docs url for the protocol` → `Memory wrote · decision · "redacted"`; `connection refused` → `Memory failed · redacted`).
- Cross-axis ranking: none

### Verification Status
- Goal achieved: yes
- User goal: met — reads, writes, denials, and failures show one bounded line; the model still receives JSON.
- Scope adhered: yes
- Out-of-scope changes: none in the feature diff

### Guardrails Verdict
- Contract: durable
- Contract version: 2
- Status: pass
- Gates: unit_test_gate=pass, functional_test_gate=skipped, lint_gate=skipped, patch_gate=advisory, global_ratchet=pass, complexity_gate=pass

### User Goal Analysis
- Goal: Operators see one compact line when `sql_memory` reads or writes, with a short synopsis.
- Met: Collapsed parent card is one notice line. Child success emits `✓ sql_memory: <notice>`. A 50-character notice plus that prefix is 64 columns and survives `sanitizeLine`. Supervisor save, correction, probe, and readback emit when a sink is passed. Model content stays JSON.
- Partial: nothing in the acceptance table.
- Missing: nothing in the acceptance table.
- Verdict: met

Interactive parent TUI and a live `/buck-loop` session were not launched. The card and activity contracts were exercised through the renderer, the activity sanitizer, and a real `probeSql(undefined, sink)` call.

### Documentation Impact
- No documentation impact beyond the paragraph this plan already required. That paragraph is present.
- Recommended: none

### How-to Impact
- No how-to impact. The notice is automatic; no new operator action.
- Recommended: none

### Issue Classification
- In-plan issues (implementation defects → `/b-iterate`): none
- Out-of-plan issues (scope discoveries → fresh `/b-plan`): none

### Verdict
Pass with warnings — the planned notice is in place. The warning is over-redaction of ordinary synopsis text, not a missed acceptance criterion.

### Recommended Next Step
`/b-save` → `/b-commit`

Summary
In-plan issues: none · Out-of-plan issues: none
Warnings: synopses containing `url`, `password`, or `connection` are replaced with `redacted`.
Suggested next step: `/b-save` → `/b-commit`

Review stayed read-only, so there were no assignment files to stage.
