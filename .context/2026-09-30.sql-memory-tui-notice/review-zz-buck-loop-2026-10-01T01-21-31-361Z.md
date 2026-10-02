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
| 1. Formatter and unit tests | 🔄 partial | Table, newline body, connection-string body, and the 50-character denial/failure cap pass in `notice.test.ts`. `writeNotice` still interpolates category raw (`notice.ts:32-39`). Probe: category `postgres://user:pass@db/x` renders `Memory wrote · postgres://user… · "hello"`; category `dec\nision` embeds a newline. |
| 2. Execute paths store `details.notice`; model content stays JSON | ✅ complete | `index.ts:96-120`, `264-293`. `index.test.ts` asserts JSON `content` and a separate `details.notice`. |
| 3. `renderCall` / `renderResult` | ✅ complete | `index.ts:296-303`. Collapsed render test returns one notice line; expanded render still contains `"rows"`. |
| 4. Success activity message from `details.notice`, with `onResult` fallback | ✅ complete | `omp-models.ts:64-74` reads `details.notice`. `run-step.ts:450-476` emits from the callback and drops the duplicate subscribe event. Vitest asserts one success line. |
| 5. Supervisor `sqlMemoryRows` / correction writes | 🔄 partial | `sqlMemoryRows`, `sqlMemorySaveTransaction`, and `correctSqlMemory` emit when a sink is passed (`index.ts:129-143`, `174-178`, `244-247`). `saveSqlFacts` passes `onActivity` (`sql-save.ts:115-116`). `b-save-improved` passes `activity.ingest`. `finishSqlSave` / `reconcileSqlSave` pass `deps.onActivity` (`loop.ts:691`, `696`). `openSqlSave` still calls `probeSql()` with no sink (`loop.ts:669`). |
| 6. Docs paragraph | ✅ complete | `docs/sql-memory.md:36-40` states the line contract, redaction, sink silence, and the 50-character cap. |
| 7. Focused tests and guardrails | ✅ complete | Vitest: 88 passed, 1 skipped. Guardrails v2 `status: pass`. |

Decision closure: the three plan assumptions are validated (no settings flag, no extra model call, model `content` remains JSON). None are unresolved blockers. Renderer revert stays available because `renderCall` / `renderResult` are local. The `onResult` fallback is implemented and tested. The leak mitigation is not fully evidenced: category skips `safeValue`.

### Review Axes
- Spec axis worst finding: `writeNotice` puts an unsanitized category on the collapsed write line, so a URL prefix or newline reaches the parent card.
- Standards axis worst finding: sequential fallback (no background `task` tool). `notice.ts:12` copies `sql-save.ts:18` but drops the `^url$` anchor and matches the value, so a body containing `url` becomes `redacted` (`see the docs url for the protocol` → `Memory wrote · decision · "redacted"`).
- Cross-axis ranking: none.

### Verification Status
- Goal achieved: partial
- User goal: partially met — normal reads and writes show one line; a hostile category still breaks that line.
- Scope adhered: yes
- Out-of-scope changes: none in the feature diff

### Guardrails Verdict
- Contract: durable
- Contract version: 2
- Status: pass
- Gates: unit_test_gate=pass, functional_test_gate=skipped, lint_gate=skipped, patch_gate=advisory, global_ratchet=pass, complexity_gate=pass

### User Goal Analysis
- Goal: Operators see one compact line when `sql_memory` reads or writes, with a short synopsis.
- Met: Collapsed parent card is one notice line for normal calls. Child buck-loop success emits `✓ sql_memory: <notice>`. Supervisor save, correction, and readback emit when a sink is passed. Model content stays JSON. Denial, failure, and pool shutdown are capped and redacted.
- Partial: Category is not redacted or newline-stripped. The save-open connectivity probe stays silent.
- Missing: nothing else in the acceptance table.
- Verdict: partially met

Live parent-session and live `/buck-loop` smoke were not run (no interactive TUI in this review). Renderer and activity behavior are evidenced by vitest and a formatter probe, not by a screen.

### Documentation Impact
- No documentation impact beyond the paragraph this plan already required. That paragraph is present.
- Recommended: none

### How-to Impact
- No how-to impact. The notice is automatic; no new operator action.
- Recommended: none

### Issue Classification
- In-plan issues (implementation defects → `/b-iterate`): category bypasses the one-line and secret contract; save-open `probeSql()` does not receive the existing sink. Artifact: `.context/2026-09-30.sql-memory-tui-notice/iterate-sql-memory-tui-notice.md`
- Out-of-plan issues (scope discoveries → fresh `/b-plan`): none

### Verdict
Needs work — the collapsed write line can still show a connection-string prefix or a newline when category is unsanitized.

### Recommended Next Step
`/b-iterate`, then re-run `/b-review` against this plan.

Summary
In-plan issues: 2 · Out-of-plan issues: none
Warnings: save-open connectivity probe stays silent; ordinary synopses containing `url` are over-redacted.
Suggested next step: `/b-iterate`
