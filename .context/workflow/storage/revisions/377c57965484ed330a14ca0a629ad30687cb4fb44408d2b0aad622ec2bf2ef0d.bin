## Plan Path Review: sql-memory-tui-notice

### Plan Source
- File: `.context/2026-09-30.sql-memory-tui-notice/plan-sql-memory-tui-notice.md`
- Goal: One shared notice line on the parent tool card and the buck-loop activity line when `sql_memory` runs.
- Baseline: `e3ffb37` on `feat/notifier-sql_memory-use`. Review is the staged implementation diff, not later commits.

### Evidence Sources
- Git status: staged notice formatter, tool renderer, activity forwarding, docs, and tests. Unrelated unstaged backlog edits were not part of this diff.
- Recent commits: no implementation commit yet. Work is uncommitted on top of `e3ffb37`.
- Modified files: `extensions/sql-memory/notice.ts`, `notice.test.ts`, `index.ts`, `index.test.ts`, `extensions/omp-models.ts`, `omp-models.test.ts`, `extensions/buck-loop/run-step.ts`, `run-step.test.ts`, `docs/sql-memory.md`.
- Plan affected files verified: all listed paths exist in the staged diff. Supervisor callers were not wired.

### Completion Matrix

| Step | Status | Evidence |
|------|--------|----------|
| 1. Formatter and unit tests | 🔄 partial | `extensions/sql-memory/notice.ts:42-51` and `notice.test.ts` cover the table, newlines, and a connection string. Denial and failure lines are 52 characters; with the 14-character `✓ sql_memory: ` prefix they are 66, over the 64-column widget. |
| 2. Execute paths store `details.notice`; model content stays JSON | ✅ complete | `extensions/sql-memory/index.ts:79-82`, `96-104`, `220-246`. `index.test.ts` asserts JSON `content` and a separate `details.notice`. |
| 3. `renderCall` / `renderResult` | ✅ complete | `index.ts:2`, `249-256`. Collapsed render test returns one notice line; expanded render still contains `"rows"`. |
| 4. Success activity message from `details.notice`, with `onResult` fallback | ✅ complete | `extensions/omp-models.ts:64-74` reads `details.notice`. `run-step.ts:449-476` emits from the callback and drops the duplicate subscribe event. Vitest asserts one success line. |
| 5. Supervisor `sqlMemoryRows` / correction writes | ❌ missing | `sqlMemoryRows` (`index.ts:113-117`) drops the notice. `sqlMemorySaveTransaction` (`120-142`) never formats one. `b-save-improved` has `activity.ingest` at `saveSqlFacts` and does not pass it. `loop.ts` `finishSqlSave` / `reconcileSqlSave` do not pass `deps.onActivity` into `verifySqlSave`. |
| 6. Docs paragraph | ✅ complete | `docs/sql-memory.md:36-38` states what the line shows and that it never includes SQL, connection strings, or passwords. |
| 7. Focused tests and guardrails | ✅ complete | Vitest: 85 passed, 1 skipped. Guardrails v2 `status: pass`. The plan's `bun test` command fails on pre-existing `vi.hoisted` (vitest-only); `package.json` runs these files under vitest. |

Decision closure: the three plan assumptions are validated (no settings flag, no extra model call, model `content` remains JSON). None are unresolved blockers. Renderer revert stays available because `renderCall` / `renderResult` are local. The `onResult` fallback is implemented and tested. The leak rollback is not fully evidenced: pool teardown still emits the raw driver message (`run-step.ts:521`).

### Review Axes
- Spec axis worst finding: supervisor `sqlMemoryRows` and correction writes never emit a notice, even when `activity.ingest` or `deps.onActivity` is already in the caller.
- Standards axis worst finding: sequential fallback (no background `task` tool). `extensions/sql-memory/notice.ts:12` copies the secret pattern from `extensions/buck-loop/sql-save.ts:18` but drops the `^url$` anchor and matches the value, so any synopsis containing `url`, `password`, or `connection` becomes `redacted`.
- Cross-axis ranking: none.

### Verification Status
- Goal achieved: partial
- User goal: partially met — parent card and child tool ends show the line; supervisor writes do not.
- Scope adhered: yes
- Out-of-scope changes: none in the feature diff

### Guardrails Verdict
- Contract: durable
- Contract version: 2
- Status: pass
- Gates: unit_test_gate=pass, functional_test_gate=skipped, lint_gate=skipped, patch_gate=pass, global_ratchet=pass, complexity_gate=pass

### User Goal Analysis
- Goal: Operators see one compact line when `sql_memory` reads or writes, with a short synopsis.
- Met: Collapsed parent card is one notice line. Child buck-loop success emits `✓ sql_memory: <notice>`. Model content stays JSON. Secrets in the formatter path are redacted.
- Partial: Denial and failure notices exceed the 64-column budget. Pool shutdown can still show a raw driver error.
- Missing: Supervisor reads and correction writes through `sqlMemoryRows` / `saveSqlFacts` stay silent.
- Verdict: partially met

Live parent-session and live `/buck-loop` smoke were not run (no interactive TUI in this review). Renderer and activity behavior are evidenced by vitest, not by a screen.

### Documentation Impact
- No documentation impact beyond the paragraph this plan already required. That paragraph is present.
- Recommended: none

### How-to Impact
- No how-to impact. The notice is automatic; no new operator action.
- Recommended: none

### Issue Classification
- In-plan issues (implementation defects → `/b-iterate`): supervisor SQL writes do not emit; pool teardown skips the formatter; denial/failure lines exceed 64 columns. Artifact: `.context/2026-09-30.sql-memory-tui-notice/iterate-sql-memory-tui-notice.md`
- Out-of-plan issues (scope discoveries → fresh `/b-plan`): none

### Verdict
Needs work — supervisor writes never emit the notice the plan required.

### Recommended Next Step
`/b-iterate`, then re-run `/b-review` against this plan.

Summary
In-plan issues: 3 · Out-of-plan issues: none
Warnings: pool teardown can leak a raw driver error; denial/failure lines are 66 columns against a 64-column widget.
Suggested next step: `/b-iterate`
