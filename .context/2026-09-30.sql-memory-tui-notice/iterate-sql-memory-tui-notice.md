---
status: completed
date: 2026-09-30
updated: 2026-09-30
subject: 2026-09-30.sql-memory-tui-notice
topics: [review, iteration]
informs: []
addresses: plan-sql-memory-tui-notice.md
completed: 2026-09-30
from_review: b-review
---

# Iteration: sql-memory-tui-notice

## Source
- Reviewed after: `/b-iterate`
- Plan: `plan-sql-memory-tui-notice.md`
- Spec: none

## Critical Issues

### 1. Category bypasses the one-line and secret contract
- **File**: `extensions/sql-memory/notice.ts` (`writeNotice`)
- **Problem**: Body, query, and error go through `safeValue` (newline strip plus URL, SQL, and secret redaction). Category is interpolated raw and only length-capped. Reproduced: category `postgres://user:pass@db/x` renders `Memory wrote · postgres://user… · "hello"`; category `dec\nision` embeds a newline. The parent collapsed card prints that string directly, so the formatter contract (one line, no connection string) fails on a write the tool accepts.
- **Proposed fix**: Run category through the same `safeValue` path before `short`. A redacted or empty category is omitted or shown as `redacted`. The returned notice still has no newline and stays within 50 characters. Add formatter tests for a URL category and a newline category.

## Warnings

### 1. Save-open connectivity probe stays silent
- **File**: `extensions/buck-loop/loop.ts` (`openSqlSave` calls `probeSql()`); `extensions/buck-loop/sql-save.ts` (`probeSql`)
- **Problem**: Step 5 requires supervisor `sqlMemoryRows` calls to emit when an activity sink is present. `finishSqlSave`, `reconcileSqlSave`, and `saveSqlFacts` pass the sink. `openSqlSave` still calls `probeSql()` with no sink even though `executeSkill` already has `deps.onActivity`. That SELECT stays silent.
- **Suggested approach**: Pass `deps.onActivity` into that probe only. Callers that omit the sink stay silent. Do not emit a second line from the later `verifySqlSave` readback.

## Prior resolution (verified this review, do not reopen)

- Supervisor row queries, atomic correction calls, and save transactions accept an optional activity sink. Save and resume/readback callers pass their existing sink; no-sink calls stay silent.
- Transaction success notices wait for commit; rollback emits only the failure notice.
- Child pool-shutdown errors use the shared formatter. Denial and failure notices fit the 50-character budget.

## Resolution and fresh evidence

- Category now passes through `safeValue` before truncation. URL categories render `redacted`; embedded category whitespace is normalized; empty categories are omitted. Regression coverage includes a long category plus body within the 50-character limit.
- `executeSkill` passes `deps.onActivity` through `openSqlSave` to `probeSql`. The probe's default query uses that optional sink; custom query and no-sink callers retain their existing behavior. Receipt readback is unchanged; no extra event was added there.
- Focused Vitest run: 5 files passed, 124 tests passed, 5 skipped (`notice`, `index`, `run-step`, `loop`, `sql-save`).
- `npm run guardrails:check`: durable v2 pass; required unit, global ratchet, and complexity gates passed; coverage 87.7% against 84%; patch advisory; lint and functional disabled/skipped.
- Live SQL smoke: default connectivity probe emitted exactly one successful `toolEnd` with `Memory recall · 1 row`; a no-sink probe verified without another event. A real parent tool SELECT rendered one collapsed line, and expanded rendering retained JSON rows. URL/newline category formatter outputs were `Memory wrote · redacted · "hello"` and `Memory wrote · dec ision · "hello"`.
- Smoke harness removed after verification. Renderer exercised directly; no interactive parent TUI or live `/buck-loop` session was launched.
- The current-session pointer belongs to the unrelated model-config subject; its historical memory was read, not rewritten. This artifact records this assignment's durable state; supervisor owns subsequent review and SQL save.
- Fixes completed; review and save remain supervisor-owned. No loop-state decision or commit was made.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against the same plan.
Inside an OMP execution session, the iterate artifact is not done until it is completed, review passes, and `/b-save` has recorded durable state.
For larger rework, use `/b-build` or `/b-build-hard`.
