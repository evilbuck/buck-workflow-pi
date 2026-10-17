---
status: completed
date: 2026-09-29
updated: 2026-09-29
subject: 2026-09-28.sql-memory-buck-loop
topics: [review, iteration, sql-memory, cross-references]
informs: []
addresses: phase-3-sql-save-truthful-completion.md
completed: 2026-09-29
from_review: b-review
---

# Iteration: Phase 3 SQL cross-references

## Source
- Reviewed after: `/b-iterate`
- Phase: `phase-3-sql-save-truthful-completion.md`
- Baseline: `7705adf` plus the existing staged and unstaged Phase 3 work; shared SQL recall returned zero active matches, so the current phase and source are the evidence.

## Critical Issues

### 1. Alternate SQL save writes UUIDs as Markdown memory links for bold-line plans
- **Files**: `extensions/b-save-improved/index.ts:711-718`; `skills/b-save-improved/scripts/save-apply.ts:223-233`
- **Problem**: SQL mode passes `{ key: "sql_memory_ids", value: <UUID> }` into `applyCrossrefs`. For a plan containing `**memory:**`, `planMemoryRefStyle` returns `bold-line`, and that branch ignores `ref.key`, appending `[<UUID>](<UUID>)` to the old memory line. The new SQL ID is not recorded as `sql_memory_ids`; the link points to a nonexistent relative Markdown file. The phase requires SQL receipt/ID cross-references instead of Markdown memory paths. The SQL integration fixture covers only a YAML plan without the legacy bold line.
- **Proposed fix**: In SQL mode, always append `sql_memory_ids:` in the plan/spec frontmatter regardless of the existing `memory` reference style; preserve historical bold-line links without adding phantom links. Keep file mode's bold-line behavior. Cover a legacy bold-line plan and spec in the SQL-mode apply test, including replay idempotence.

## Warnings

None.

## Verification
- `env -u SQL_MEMORY_URL npm run guardrails:check` and `npm run guardrails:check` with configured SQL: durable v2 pass, unit and global coverage ratchet pass (88.2% vs 84%), complexity pass, patch pass; functional and lint skipped.
- Current-state source check: `applyCrossrefs`'s bold-line branch builds a `**memory:**` Markdown link from `ref.value` even when `ref.key` is `sql_memory_ids`; `planMemoryRefStyle` recognizes that legacy style (`skills/_shared/scripts/context-helpers.ts:680-687`).
- Sequential standards pass (no background task tool): TypeScript and universal quality guides plus the diff-relevant duplicate-code and primitive-obsession catalog; the bold-line special case is the worst quality finding because it discards the caller's typed key and writes a different representation.

## Resolution

- `applyCrossrefs` honors non-`memory` reference keys even when the plan or spec has a historical `**memory:**` line. SQL IDs go into `sql_memory_ids` frontmatter; existing Markdown links stay unchanged.
- Disposable PostgreSQL integration exercised legacy bold-line plan and spec, replay idempotence, and absence of a new memory file or index entry: 27/27 `save-apply` tests passed.

## Recommended Workflow

Start with `/b-iterate` against this file, then re-run `/b-review` against Phase 3. The supervisor owns the next loop state.
